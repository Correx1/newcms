import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/admin/profiles?role=client
 * GET /api/admin/profiles?role=staff
 * GET /api/admin/profiles?role=admin
 * GET /api/admin/profiles?roles=staff,admin   (comma-separated)
 *
 * Returns all profiles matching the requested role(s).
 * Uses the service-role key — bypasses RLS completely.
 * Verifies the calling user is an admin first.
 */
export async function GET(request: Request) {
  try {
    // 1. Verify caller is admin using their session cookie
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
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Confirm user is admin in the DB using admin client
    const admin = createAdminClient()
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
    }

    // 3. Parse role filter from query params
    const url = new URL(request.url)
    const rolesParam = url.searchParams.get('roles') ?? url.searchParams.get('role')

    if (!rolesParam) {
      return NextResponse.json({ error: 'Missing role param' }, { status: 400 })
    }

    const roles = rolesParam.split(',').map(r => r.trim()).filter(Boolean)

    // 4. Fetch profiles with JOIN to project_assignments for project count
    let query = admin
      .from('profiles')
      .select(`
        *,
        assignments:project_assignments (
          projects (id, title, status)
        ),
        projects:projects!projects_client_id_fkey (id, title, status)
      `)
      .order('created_at', { ascending: false })

    if (roles.length === 1) {
      query = query.eq('role', roles[0])
    } else {
      query = query.in('role', roles)
    }

    const { data, error } = await query

    if (error) {
      console.error('[admin/profiles] query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profiles: data ?? [] })
  } catch (err) {
    console.error('[admin/profiles] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
