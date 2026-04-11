/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import React, { createContext, useContext, useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export type Role = "admin" | "staff" | "client" | null

export interface User {
  id: string
  name: string
  email: string
  role: Role
  company?: string
  jobTitle?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  /** True whenever there is an active Supabase session, even if the profile
   *  couldn't be loaded (e.g. DB error). Used in layout to prevent redirect
   *  loops when the profile fetch fails. */
  hasSession: boolean
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function dashboardPath(role: string) {
  return `/dashboard/${role}`
}

/** Create profile row via server-side API (bypasses RLS) */
async function ensureProfile(name?: string, role?: string): Promise<void> {
  try {
    await fetch('/api/ensure-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role }),
      credentials: 'include',
    })
  } catch {
    // Non-fatal — the profile might already exist
  }
}

// ── Session timeout configuration ─────────────────────────────────────────
const INACTIVITY_MS  = 2 * 60 * 60 * 1000   // 2 hours idle → auto sign-out
const WARN_BEFORE_MS = 5 * 60 * 1000         // Warn 5 minutes before idle logout
const CHECK_EVERY_MS = 60 * 1000             // Check every 60 s
const ACTIVE_TS_KEY  = 'noplin_active_ts'    // sessionStorage: last user interaction
const WARNED_TS_KEY  = 'noplin_warned_ts'    // sessionStorage: when warning was shown

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // ── Main auth subscription ────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true

    // Returns User if found | null if row missing (PGRST116) | 'error' on DB errors
    async function fetchProfile(userId: string, email: string): Promise<User | null | 'error'> {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') return null   // no row — safe to create
        console.error('[auth] fetchProfile error:', error.code, error.message)
        return 'error'
      }

      if (!profile) return null

      return {
        id: userId,
        email,
        name: profile.name ?? email,
        role: profile.role,
        company: profile.company,
        jobTitle: profile.job_title,
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        if (!mounted) return

        // ── Signed out ────────────────────────────────────────────────────
        if (event === "SIGNED_OUT") {
          setUser(null)
          setHasSession(false)
          setLoading(false)
          // Clear session timeout trackers so the timer doesn't fire post-logout
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem(ACTIVE_TS_KEY)
            sessionStorage.removeItem(WARNED_TS_KEY)
          }
          router.push("/")
          return
        }

        // ── Password recovery ─────────────────────────────────────────────
        if (event === "PASSWORD_RECOVERY") {
          setLoading(false)
          // If already on /reset-password, let the page own its own flow —
          // do NOT push away, or the button will spin and redirect immediately.
          const onResetPage = typeof window !== 'undefined' &&
            window.location.pathname === '/reset-password'
          if (!onResetPage) {
            router.push("/reset-password")
          }
          return
        }

        // ── Has a session: INITIAL_SESSION | SIGNED_IN | TOKEN_REFRESHED ──
        if (session?.user) {
          setHasSession(true)

          // Record the first activity timestamp for this tab so the idle
          // timer has a baseline to measure inactivity against.
          if (typeof window !== 'undefined' && !sessionStorage.getItem(ACTIVE_TS_KEY)) {
            sessionStorage.setItem(ACTIVE_TS_KEY, Date.now().toString())
          }

          // When the user is on /setup-password or /reset-password, skip ALL
          // profile fetching and redirects. fetchProfile() running concurrently
          // with updateUser() steals the Supabase Web Lock → updateUser() hangs.
          // The page owns its own flow completely; we just confirm there's a session.
          if (event === "SIGNED_IN" || event === "PASSWORD_RECOVERY" || event === "USER_UPDATED") {
            const onPasswordPage = typeof window !== 'undefined' && (
              window.location.pathname === '/setup-password' ||
              window.location.pathname === '/reset-password'
            )
            if (onPasswordPage) {
              if (mounted) setLoading(false)
              return
            }
          }

          const { id, email } = session.user

          let result = await fetchProfile(id, email ?? "")

          // Only attempt auto-creation when the row genuinely doesn't exist
          if (result === null) {
            await ensureProfile(
              session.user.user_metadata?.full_name ?? session.user.user_metadata?.name,
              session.user.user_metadata?.role
            )
            result = await fetchProfile(id, email ?? "")
          }

          const mapped = result !== 'error' ? result : null

          if (mounted) {
            setUser(mapped)
            setLoading(false)

            if (event === "SIGNED_IN") {
              if (mapped) {
                router.push(dashboardPath(mapped.role!))
              } else if (result === null) {
                // Profile could not be created — ensure-profile rejected the request
                // because the user has no valid role in their metadata.
                // Sign them out immediately and redirect to the main site.
                await supabase.auth.signOut()
                if (typeof window !== 'undefined') {
                  window.location.href = 'https://noplin.com'
                }
              }
              // result === 'error': transient DB failure — don't boot, let them retry

            } else if (event === "INITIAL_SESSION" && mapped) {
              // Page refresh: if the user landed on the login page, send them home
              if (typeof window !== 'undefined' && window.location.pathname === '/') {
                router.replace(dashboardPath(mapped.role!))
              }
            }
            // TOKEN_REFRESHED: silently update user, no redirect needed
          }

        } else {
          // INITIAL_SESSION with no session → not logged in
          if (mounted) {
            setUser(null)
            setHasSession(false)
            setLoading(false)
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, router])

  // ── Session timeout: idle-only ────────────────────────────────────────────
  // Active users are NEVER forced out — only users idle for 2 h are signed out.
  // 5 minutes before the idle limit hits, a warning toast fires giving the user
  // a chance to stay logged in. Activity events reset the inactivity clock.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateActivity = () => {
      sessionStorage.setItem(ACTIVE_TS_KEY, Date.now().toString())
      // If user acts after the warning was shown, dismiss it
      sessionStorage.removeItem(WARNED_TS_KEY)
    }

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }))

    const timer = setInterval(async () => {
      const activeTs = sessionStorage.getItem(ACTIVE_TS_KEY)
      if (!activeTs) return  // Session not yet tracked

      const now      = Date.now()
      const inactive = now - parseInt(activeTs, 10)

      if (inactive > INACTIVITY_MS) {
        // Time's up — sign out
        sessionStorage.removeItem(ACTIVE_TS_KEY)
        sessionStorage.removeItem(WARNED_TS_KEY)
        try {
          await Promise.race([
            supabase.auth.signOut(),
            new Promise<void>((_, r) => setTimeout(() => r(new Error('timeout')), 3000)),
          ])
        } catch {
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith('sb-')) localStorage.removeItem(k)
          })
        } finally {
          window.location.href = '/'
        }
        return
      }

      // Warn 5 minutes before idle logout (only warn once per idle window)
      const timeLeft  = INACTIVITY_MS - inactive
      const alreadyWarnedAt = sessionStorage.getItem(WARNED_TS_KEY)

      if (timeLeft <= WARN_BEFORE_MS && !alreadyWarnedAt) {
        sessionStorage.setItem(WARNED_TS_KEY, now.toString())
        // Dynamically import toast to avoid bundling sonner in all contexts
        import('sonner').then(({ toast }) => {
          toast.warning('Your session is about to expire', {
            description: 'You will be logged out in 5 minutes due to inactivity.',
            duration: 4 * 60 * 1000, // show for 4 minutes
            action: {
              label: 'Stay logged in',
              onClick: () => {
                sessionStorage.setItem(ACTIVE_TS_KEY, Date.now().toString())
                sessionStorage.removeItem(WARNED_TS_KEY)
              },
            },
          })
        })
      }
    }, CHECK_EVERY_MS)

    return () => {
      clearInterval(timer)
      events.forEach((e) => window.removeEventListener(e, updateActivity))
    }
  }, [supabase])

  const logout = async () => {
    try {
      // Race signOut against a 3-second timeout.
      // If the Supabase Web Lock is held by a background token refresh,
      // signOut() will hang indefinitely. The timeout wins in that case:
      // we clear storage manually and force a hard redirect, so the user
      // is always logged out regardless of the lock state.
      await Promise.race([
        supabase.auth.signOut(),
        new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error('signOut timeout')), 3000)
        ),
      ])
    } catch {
      // signOut timed out or failed — clear everything manually
      try {
        // Remove all Supabase auth keys from localStorage
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-')) localStorage.removeItem(key)
        })
        sessionStorage.removeItem(ACTIVE_TS_KEY)
        sessionStorage.removeItem(WARNED_TS_KEY)
      } catch { /* storage unavailable in some private-browsing modes */ }
    } finally {
      // Hard navigation clears any in-memory state and hits the login page clean
      window.location.href = '/'
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, hasSession, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
