/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clientId } = await params

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

    const adminClient = createAdminClient()
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Verify Target Client Identity
    const { data: targetClient, error: clientFetchError } = await adminClient
      .from('profiles')
      .select('email, name')
      .eq('id', clientId)
      .single()

    if (clientFetchError || !targetClient) {
      return NextResponse.json({ error: 'Client not found entirely' }, { status: 404 })
    }

    if (targetClient.email.includes('@noplincms.local') || targetClient.email.startsWith('silent_')) {
      return NextResponse.json({ error: 'Cannot dispatch invite to an unregistered dummy placeholder email. Edit the client first to provide a real email address.' }, { status: 400 })
    }

    const { data: authData, error: getUserError } = await adminClient.auth.admin.getUserById(clientId)
    if (getUserError || !authData?.user) {
      return NextResponse.json({ error: 'Underlying Auth user not found' }, { status: 404 })
    }
    const authUser = authData.user

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const inviteRedirectTo = `${origin}/setup-password`  // for first-time unconfirmed users
    const resetRedirectTo  = `${origin}/reset-password`  // for confirmed users resetting their password

    // If email is unconfirmed, they haven't accepted their initial invite yet. Resend Invite "Set Password" template.
    if (!authUser.email_confirmed_at) {
      const { error: resendError } = await adminClient.auth.resend({
        type: 'signup',
        email: targetClient.email,
        options: { emailRedirectTo: inviteRedirectTo }
      })

      if (resendError) {
        console.error('[client-invite] resend invite error:', resendError.message)
        // Fallback to reset logic if the resend API boundary flips
        await adminClient.auth.resetPasswordForEmail(targetClient.email, { redirectTo: resetRedirectTo })
      }
    } else {
      // They are fully active. Send the "Reset Password" template.
      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(targetClient.email, { redirectTo: resetRedirectTo })
      
      if (resetError) {
        console.error('[client-invite] reset password error:', resetError.message)
        return NextResponse.json({ error: resetError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true, message: `Access link comprehensively navigated and dispatched to ${targetClient.email}` })
  } catch (err: any) {
    console.error('[client-invite] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
