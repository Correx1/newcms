import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/admin/profiles/[id]
 *
 * Returns a specific profile and all their projects matching the ID.
 * Uses the service-role key — bypasses RLS completely.
 * Verifies the calling user is an admin or the user themselves.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const params = await context.params;
    const profileId = params.id
    if (!profileId) {
      return NextResponse.json({ error: 'Missing profile ID param' }, { status: 400 })
    }

    // 1. Verify caller session
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

    // 2. Confirm user is admin OR requesting their own profile
    const admin = createAdminClient()
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || (callerProfile.role !== 'admin' && user.id !== profileId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 3. Fetch specific profile with JOIN to projects directly and assignments
    const { data, error } = await admin
      .from('profiles')
      .select(`
        *,
        projects:projects!projects_client_id_fkey (*),
        assignments:project_assignments (
          projects (*)
        )
      `)
      .eq('id', profileId)
      .single()

    if (error) {
      console.error('[admin/profiles/[id]] query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ profile: data })
  } catch (err) {
    console.error('[admin/profiles/[id]] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
