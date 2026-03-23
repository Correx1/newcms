import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/projects/complete
 *
 * Marks a project as completed with deliverables summary + links + files.
 * Uses service-role key to bypass RLS — but validates the caller is
 * either the project's assigned staff or an admin before updating.
 *
 * Body: {
 *   projectId: string
 *   deliverables_summary: string
 *   deliverables_links: string[]
 *   deliverables_files: { name, url, type, uploadedAt }[]
 * }
 */
export async function POST(request: Request) {
  try {
    // 1. Verify caller is authenticated
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

    const body = await request.json()
    const { projectId, deliverables_summary, deliverables_links, deliverables_files } = body

    if (!projectId || !deliverables_summary) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 2. Get caller's role
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // 3. For staff: verify they are actually assigned to this project
    if (callerProfile.role === 'staff') {
      const { data: assignment } = await admin
        .from('project_assignments')
        .select('project_id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single()

      if (!assignment) {
        return NextResponse.json({ error: 'Forbidden: not assigned to this project' }, { status: 403 })
      }
    } else if (callerProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // 4. Update the project — use admin client so RLS doesn't interfere
    const { error: updateError } = await admin
      .from('projects')
      .update({
        status: 'completed',
        client_feedback: null,           // clear previous rejection feedback
        deliverables_summary,
        deliverables_links: deliverables_links ?? [],
        deliverables_files: deliverables_files ?? [],
      })
      .eq('id', projectId)

    if (updateError) {
      console.error('[projects/complete] update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[projects/complete] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
