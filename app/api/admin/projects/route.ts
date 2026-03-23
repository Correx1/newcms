import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/admin/projects
 * Returns all projects with client and assignment info.
 * Admin only — uses service-role key to bypass RLS.
 */
export async function GET(request: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
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

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!callerProfile || callerProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') ?? '100')

    const { data, error } = await admin
      .from('projects')
      .select(`
        id, title, status, deadline, price, created_at,
        client:profiles!projects_client_id_fkey(id, name, company),
        project_assignments(
          user_id,
          profiles(id, name)
        )
      `)
      .order('deadline', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('[admin/projects]', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ projects: data ?? [] })
  } catch (err) {
    console.error('[admin/projects] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
