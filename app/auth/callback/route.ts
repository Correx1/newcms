/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Newer Supabase SSR token_hash + type flow (used by email magic links & recovery)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') // 'signup' | 'magiclink' | 'recovery' | 'email_change' | 'invite'

  // Where to go after a successful exchange (caller can override via ?next=)
  const next = searchParams.get('next') ?? '/'

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignore when called from Server Component
          }
        },
      },
    }
  )

  // ── PKCE code flow (OAuth / email link with PKCE) ──────────────────────────
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.session) {
      // For first-time sign-ups (no password set yet) route to setup-password
      const isNewUser = data.user?.created_at !== undefined &&
        new Date(data.user.created_at).getTime() > Date.now() - 60_000 * 5

      const destination = next !== '/'
        ? next
        : isNewUser ? '/setup-password' : '/'

      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  // ── Token-hash flow (email magic link / OTP / recovery) ───────────────────
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as any,
    })

    if (!error) {
      // For pure magic links used as sign-up, send to setup-password
      const isSignup = type === 'signup' || type === 'magiclink' || type === 'email'
      const destination = next !== '/'
        ? next
        : isSignup ? '/setup-password' : '/'

      return NextResponse.redirect(`${origin}${destination}`)
    }
  }

  // ── Fallback error ─────────────────────────────────────────────────────────
  return NextResponse.redirect(`${origin}/?error=auth-callback-failed`)
}
