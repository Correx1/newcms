import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Paths that require an authenticated session
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/projects',
  '/invoices',
  '/clients',
  '/staff',
  '/users',
]

// Paths that bypass middleware completely (auth utilities)
const BYPASS_PATHS = ['/auth/callback', '/setup-password', '/api/']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  })

  const pathname = request.nextUrl.pathname

  // Always bypass auth utility paths — never redirect these
  if (BYPASS_PATHS.some((p) => pathname.startsWith(p))) {
    return supabaseResponse
  }

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

  // getUser() also refreshes the session cookie when needed
  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))
  const isLoginPage = pathname === '/'

  // Not authenticated → block protected routes, redirect to login
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Authenticated → redirect away from login page to dashboard
  // Only do this if they have a valid profile — otherwise let the
  // client-side auth-context handle profile creation and redirect
  if (user && isLoginPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role) {
      // Has a profile — send them straight to their dashboard
      return NextResponse.redirect(new URL(`/dashboard/${profile.role}`, request.url))
    }

    // ⚠️ No profile yet: do NOT redirect to /setup-password here.
    // Let the request through to the login page; auth-context will
    // call /api/ensure-profile to create the row and then redirect.
    return supabaseResponse
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
