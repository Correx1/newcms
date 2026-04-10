import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// ── All routes inside the (app) group that require an authenticated session ──
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/projects',
  '/invoices',
  '/clients',
  '/staff',
  '/staff-earnings',
  '/users',
  '/leads',
  '/messages',
  '/notifications',
  '/settings',
  '/billing',
  '/earnings',
  '/tasks',
]

// ── Auth utility pages — bypass middleware entirely ───────────────────────
// These pages exchange tokens and manage their own session state.
const AUTH_BYPASS_PATHS = [
  '/auth/callback',
  '/setup-password',
  '/reset-password',
]

// ── API paths that are genuinely public (no Supabase session required) ────
// Webhook handlers and similar must be listed here explicitly.
// Everything else under /api/ requires a valid session.
const PUBLIC_API_PATHS: string[] = [
  // e.g. '/api/webhooks/stripe',
]

// ── Roles that may access the application ────────────────────────────────
const VALID_ROLES = ['admin', 'staff', 'client']

// ── Where to send users with no valid CMS profile ────────────────────────
const FALLBACK_URL = 'https://noplin.com'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  })

  const pathname = request.nextUrl.pathname

  // 1. Auth utility pages — never interfere with these
  if (AUTH_BYPASS_PATHS.some((p) => pathname.startsWith(p))) {
    return supabaseResponse
  }

  // Create the SSR Supabase client (cookie-backed, verifies JWT server-side)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // getUser() makes a server-to-server call to verify the JWT — cannot be spoofed
  const { data: { user } } = await supabase.auth.getUser()

  // 2. API routes — middleware-level blanket auth gate ───────────────────────
  // Each individual route still does its own role check, but this ensures no
  // unauthenticated request even reaches the route handler.
  // Public API paths (webhooks etc.) are explicitly whitelisted above.
  if (pathname.startsWith('/api/')) {
    const isPublic = PUBLIC_API_PATHS.some((p) => pathname.startsWith(p))
    if (!isPublic && !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    // Authenticated — let the route handle its own role-based authorization
    return supabaseResponse
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  const isLoginPage = pathname === '/'

  // 3. Unauthenticated on a protected page route → login ────────────────────
  if (!user && isProtected) {
    const loginUrl = new URL('/', request.url)
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 4. Authenticated user: validate profile for routing decisions ────────────
  // Profile lookup only when needed: login page or protected route.
  if (user && (isLoginPage || isProtected)) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const hasValidRole = !!(profile?.role && VALID_ROLES.includes(profile.role))

    // Login page — redirect to their dashboard
    if (isLoginPage) {
      if (hasValidRole) {
        return NextResponse.redirect(
          new URL(`/dashboard/${profile!.role}`, request.url)
        )
      }
      // No profile yet (new invite, password setup pending) — let client handle
      return supabaseResponse
    }

    // Protected page — authenticated but no valid CMS role → exile
    if (isProtected && !hasValidRole) {
      return NextResponse.redirect(FALLBACK_URL)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // All paths except Next.js internals and static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
