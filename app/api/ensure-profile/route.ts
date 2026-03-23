import { NextResponse } from 'next/server'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/ensure-profile
 * Creates (or silently skips if already exists) a profiles row for the
 * currently-authenticated user, bypassing RLS using the service-role key.
 *
 * Called from:
 *  - auth-context when SIGNED_IN fires and profile is null
 *  - setup-password page after password is set
 */
export async function POST(request: Request) {
  try {
    // 1. Verify the caller is a legitimately authenticated Supabase user
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { /* ignore from Server Component */ }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse optional body overrides (name, role from magic-link metadata)
    const body = await request.json().catch(() => ({}))
    const name: string = body.name
      ?? user.user_metadata?.full_name
      ?? user.user_metadata?.name
      ?? user.email?.split('@')[0]
      ?? 'User'
    // Default to 'staff' to match the schema trigger default
    const role: string = body.role
      ?? user.user_metadata?.role
      ?? 'staff'

    // 3. Use admin client (service role) to bypass RLS and upsert the profile
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      // Fallback: try with the anon key — will only succeed if INSERT policy exists
      const { error } = await supabase
        .from('profiles')
        .upsert(
          { id: user.id, email: user.email!, name, role },
          { onConflict: 'id', ignoreDuplicates: true }
        )
      if (error) {
        console.error('[ensure-profile] anon upsert failed:', error.message)
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true, fallback: true })
    }

    const admin = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await admin
      .from('profiles')
      .upsert(
        { id: user.id, email: user.email!, name, role },
        { onConflict: 'id', ignoreDuplicates: true }
      )

    if (error) {
      console.error('[ensure-profile] admin upsert failed:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[ensure-profile] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
