/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabaseSession = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cs) {
            try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* ignore */ }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabaseSession.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admins only can log payouts' }, { status: 403 })
    }

    const body = await request.json()
    const { project_id, user_id, amount, payment_date, notes } = body

    if (!project_id || !user_id || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const numericAmount = Number(amount)

    // 1. Fetch exact assignment
    const { data: assignment, error: assignmentError } = await supabaseAdmin
      .from('project_assignments')
      .select('id, amount_paid')
      .eq('project_id', project_id)
      .eq('user_id', user_id)
      .single()

    if (assignmentError || !assignment) {
      return NextResponse.json({ error: 'Staff assignment not found' }, { status: 404 })
    }

    // 2. Insert into staff_payment_logs
    const { error: logError } = await supabaseAdmin
      .from('staff_payment_logs')
      .insert({
         project_assignment_id: assignment.id,
         amount: numericAmount,
         payment_date: payment_date || new Date().toISOString(),
         notes: notes || null,
         recorded_by: user.id
      })

    if (logError) {
       console.error('Staff payment log error:', logError)
       return NextResponse.json({ error: 'Failed to record transaction log' }, { status: 500 })
    }

    // Insert ultra-precise notification for staff
    const { data: projectData } = await supabaseAdmin
      .from('projects')
      .select('title')
      .eq('id', project_id)
      .single()

    const projName = projectData?.title || 'a project'

    await supabaseAdmin.from('notifications').insert({
      user_id: user_id,
      type: 'success',
      title: 'Payout Processed',
      message: `You received a payout of $${numericAmount.toLocaleString()} for your work on "${projName}".`
    })

    // 3. Update staff amount_paid securely by incrementing total
    const newTotal = Number(assignment.amount_paid || 0) + numericAmount

    const { error: updateError } = await supabaseAdmin
      .from('project_assignments')
      .update({ amount_paid: newTotal })
      .eq('id', assignment.id)

    if (updateError) {
      console.error('Staff payout update error:', updateError)
      return NextResponse.json({ error: 'Failed to update total payouts.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, amount_paid: newTotal })

  } catch (err: any) {
    console.error('Server error handling staff payout:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
