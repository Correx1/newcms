/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// Admin-only route to log a payment and update project amount_paid
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params
    const projectId = params.id
    
    // We must use the service role key to bypass RLS since we need reliable
    // cross-table updates for finances, but we verify the admin role first.
    const supabaseAdmin = createAdminClient()

    // Verify session from cookies
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
      return NextResponse.json({ error: 'Unauthorized payload' }, { status: 401 })
    }

    // Verify admin role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized: Admins only' }, { status: 403 })
    }

    // Parse body
    const body = await request.json()
    const { amount, payment_date, notes } = body

    if (!amount || isNaN(Number(amount))) {
      return NextResponse.json({ error: 'Valid payment amount is required' }, { status: 400 })
    }

    const numericAmount = Number(amount)

    // 1. Insert into payment_logs
    const { error: insertError } = await supabaseAdmin
      .from('payment_logs')
      .insert({
        project_id: projectId,
        amount: numericAmount,
        payment_date: payment_date || new Date().toISOString(),
        notes: notes || null,
        recorded_by: user.id
      })

    if (insertError) {
      console.error('Payment log insert error:', insertError)
      return NextResponse.json({ error: 'Failed to record payment log' }, { status: 500 })
    }

    // 2. Compute new total paid
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('payment_logs')
      .select('amount')
      .eq('project_id', projectId)

    if (logsError) {
      console.error('Payment sum error:', logsError)
      return NextResponse.json({ error: 'Failed to compute total paid' }, { status: 500 })
    }

    const totalPaid = logs.reduce((sum, log) => sum + Number(log.amount), 0)

    // 3. Update project amount_paid
    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ amount_paid: totalPaid })
      .eq('id', projectId)

    if (updateError) {
      console.error('Project update error:', updateError)
      return NextResponse.json({ error: 'Payment logged but failed to update project total' }, { status: 500 })
    }

    return NextResponse.json({ success: true, totalPaid })

  } catch (err: any) {
    console.error('Server error handling payment:', err)
    return NextResponse.json({ error: 'Internal server boundary error' }, { status: 500 })
  }
}
