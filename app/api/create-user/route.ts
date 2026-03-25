import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/create-user
 * Admin-only: Creates a new user account and sends them an invite email.
 * The email link routes to /auth/callback?next=/setup-password so the user
 * lands on the password setup page and then their role-specific dashboard.
 *
 * Body: { email, name, role, phone?, company?, job_title? }
 */
export async function POST(request: Request) {
  try {
    // 1. Verify caller is an authenticated admin
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
            } catch { /* ignore */ }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify caller is admin via profiles table
    const adminClient = createAdminClient()
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // 2. Parse request body
    const body = await request.json()
    const { email, name, role, phone, company, job_title, sendInvite = true } = body

    if (!name || !role) {
      return NextResponse.json({ error: 'name and role are required' }, { status: 400 })
    }

    if (sendInvite && !email) {
      return NextResponse.json({ error: 'Email is required when sending an invite' }, { status: 400 })
    }

    if (!['admin', 'staff', 'client'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    if (sendInvite) {
      // Build the redirect URL: /auth/callback will exchange the token, then
      // redirect to /setup-password where they set their password.
      const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
      const redirectTo = `${origin}/auth/callback?next=/setup-password`

      // inviteUserByEmail creates the auth.users row (fires our trigger → profile created)
      // and sends the invite email with the correct redirect.
      const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            name,
            role,
            phone:     phone     || null,
            company:   company   || null,
            job_title: job_title || null,
          },
          redirectTo,
        }
      )

      if (inviteError) {
        console.error('[create-user] invite error:', inviteError.message)
        return NextResponse.json({ error: inviteError.message }, { status: 400 })
      }

      return NextResponse.json({
        ok: true,
        userId: inviteData.user?.id,
        message: `Invite email sent to ${email}`,
      })
    } else {
      // 4. Deferred Invite Flow (Silent Creation)
      const placeholderEmail = email?.trim() ? email.trim() : `silent_${crypto.randomUUID()}@noplincms.local`
      const randomPassword = crypto.randomUUID() + crypto.randomUUID()

      const { data: createData, error: createError } = await adminClient.auth.admin.createUser({
        email: placeholderEmail,
        password: randomPassword,
        email_confirm: true,
        user_metadata: {
          name,
          role,
          phone:     phone     || null,
          company:   company   || null,
          job_title: job_title || null,
          is_placeholder_email: !email?.trim()
        }
      })

      if (createError) {
        console.error('[create-user] silent creation error:', createError.message)
        return NextResponse.json({ error: createError.message }, { status: 400 })
      }

      // Explicitly override the profile email to be user-friendly if it was a ghost email
      if (!email?.trim() && createData.user?.id) {
        const { error: profileUpdateError } = await adminClient
          .from('profiles')
          .update({ email: 'No mail provided' })
          .eq('id', createData.user.id)
          
        if (profileUpdateError) {
          console.error('[create-user] failed to label profile with No mail provided:', profileUpdateError.message)
        }
      }

      return NextResponse.json({
        ok: true,
        userId: createData.user?.id,
        message: `User created silently without an invite.`
      })
    }
  } catch (err) {
    console.error('[create-user] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
