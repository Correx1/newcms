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
// Adjust these constants to tune how aggressively sessions are expired.
const MAX_SESSION_MS = 8 * 60 * 60 * 1000   // 8 hours  — absolute limit regardless of activity
const INACTIVITY_MS  = 2 * 60 * 60 * 1000   // 2 hours  — idle sign-out
const CHECK_EVERY_MS = 60 * 1000             // How often to run the expiry check (every 60 s)
const LOGIN_TS_KEY   = 'noplin_login_ts'     // sessionStorage key: when the session started
const ACTIVE_TS_KEY  = 'noplin_active_ts'    // sessionStorage key: last user interaction

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
            sessionStorage.removeItem(LOGIN_TS_KEY)
            sessionStorage.removeItem(ACTIVE_TS_KEY)
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

          // Record when this session was first seen in this browser tab.
          // sessionStorage is cleared on browser/tab close, so re-opening
          // always starts a fresh timer — the intended behaviour.
          if (typeof window !== 'undefined' && !sessionStorage.getItem(LOGIN_TS_KEY)) {
            const ts = Date.now().toString()
            sessionStorage.setItem(LOGIN_TS_KEY, ts)
            sessionStorage.setItem(ACTIVE_TS_KEY, ts)
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

  // ── Session timeout: inactivity + absolute duration ──────────────────────
  // Runs independently from the auth subscription. Checks every 60 s whether
  // the session has exceeded MAX_SESSION_MS (absolute) or INACTIVITY_MS (idle).
  // Activity events (mouse, keyboard, scroll, touch) reset the inactivity clock.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const updateActivity = () =>
      sessionStorage.setItem(ACTIVE_TS_KEY, Date.now().toString())

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }))

    const timer = setInterval(async () => {
      const loginTs  = sessionStorage.getItem(LOGIN_TS_KEY)
      const activeTs = sessionStorage.getItem(ACTIVE_TS_KEY)
      if (!loginTs) return   // No tracked session — nothing to do

      const now        = Date.now()
      const sessionAge = now - parseInt(loginTs,  10)
      const inactive   = now - parseInt(activeTs ?? loginTs, 10)

      if (sessionAge > MAX_SESSION_MS || inactive > INACTIVITY_MS) {
        sessionStorage.removeItem(LOGIN_TS_KEY)
        sessionStorage.removeItem(ACTIVE_TS_KEY)
        await supabase.auth.signOut()
        // The SIGNED_OUT handler above fires next → clears state → router.push("/")
      }
    }, CHECK_EVERY_MS)

    return () => {
      clearInterval(timer)
      events.forEach((e) => window.removeEventListener(e, updateActivity))
    }
  }, [supabase])

  const logout = async () => {
    await supabase.auth.signOut()
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
