/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id: projectId } = await context.params

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cs) {
            try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Verify access: admin can see all, staff must be assigned, client must own it
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: project, error } = await admin
      .from('projects')
      .select(`
        *,
        client:profiles!projects_client_id_fkey(name, company),
        assignments:project_assignments(
          id, user_id, earnings, amount_paid,
          profiles(id, name, role),
          staff_payment_logs(id, amount, payment_date, notes)
        ),
        payment_logs(id, amount, payment_date, notes, recorded_by:profiles(name))
      `)
      .eq('id', projectId)
      .single()

    if (error || !project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    // Access control
    if (profile.role === 'client' && project.client_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (profile.role === 'staff') {
      const isAssigned = (project.assignments || []).some((a: any) => a.user_id === user.id)
      if (!isAssigned) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json({ project })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
