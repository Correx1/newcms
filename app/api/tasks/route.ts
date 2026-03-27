/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
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

    // Clients cannot have tasks assigned directly to them from this board workflow (read-only for clients)
    // Fetch tasks assigned to this user, joining the project name.
    const admin = createAdminClient()
    const { data: tasks, error } = await admin
      .from('tasks')
      .select('*, projects!tasks_project_id_fkey(id, title), assignee:profiles!tasks_assignee_id_fkey(name, email)')
      .eq('assignee_id', user.id)
      .order('due_date', { ascending: true, nullsFirst: false })

    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()

    if (error) return NextResponse.json({ error: 'Failed to query tasks' }, { status: 500 })

    return NextResponse.json({ tasks: tasks || [], role: profile?.role || '' })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
