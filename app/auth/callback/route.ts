/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code      = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') // 'signup' | 'magiclink' | 'recovery' | 'email_change' | 'invite'

  // SECURITY: only allow relative paths to prevent open redirects (?next=//evil.com)
  const rawNext = searchParams.get('next') ?? '/'
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'

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
          } catch { /* ignore in Server Components */ }
        },
      },
    }
  )

  // ── PKCE code flow ─────────────────────────────────────────────────────────
  // Used by: email invites, magic links, password recovery, email change.
  if (code) {
    // Sign out any existing session BEFORE establishing the new one.
    // Critical for same-device flows: prevents admin session from persisting
    // when a staff/client invite or recovery link is opened on the same device.
    await supabase.auth.signOut()

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.session) {
      // Determine where to send the user.
      // If caller specified ?next=, honour it (already validated above).
      // Otherwise fall back to a sensible default based on whether this is a new user.
      const isNewUser =
        data.user?.created_at !== undefined &&
        new Date(data.user.created_at).getTime() > Date.now() - 60_000 * 5

      const destination = next !== '/'
        ? next
        : isNewUser ? '/setup-password?via=invite' : '/'

      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  // ── Token-hash flow (OTP / email link / recovery) ──────────────────────────
  // Used by: Supabase OTP links, some email verification flows.
  if (token_hash && type) {
    // Sign out for all auth-action types so the incoming session is always clean.
    await supabase.auth.signOut()

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (!error) {
      let defaultDestination = '/'
      if (type === 'recovery') {
        defaultDestination = '/reset-password?via=recovery'
      } else if (['signup', 'magiclink', 'email', 'invite'].includes(type)) {
        defaultDestination = '/setup-password?via=invite'
      }

      const destination = next !== '/' ? next : defaultDestination

      // Safety net: always enforce the correct ?via= flag based on token type,
      // regardless of what any caller encoded in ?next=.
      let finalDestination = destination
      if (type === 'recovery' &&
          finalDestination.includes('/reset-password') &&
          !finalDestination.includes('via=recovery')) {
        finalDestination += (finalDestination.includes('?') ? '&' : '?') + 'via=recovery'
      } else if (['invite', 'signup', 'magiclink', 'email'].includes(type) &&
          finalDestination.includes('/setup-password') &&
          !finalDestination.includes('via=invite')) {
        finalDestination += (finalDestination.includes('?') ? '&' : '?') + 'via=invite'
      }

      return NextResponse.redirect(`${origin}${finalDestination}`)
    }
  }

  // ── Fallback: something went wrong ────────────────────────────────────────
  return NextResponse.redirect(`${origin}/?error=auth-callback-failed`)
}
