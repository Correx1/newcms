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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    // ── Helper: fetch profile row from DB ─────────────────────────────────────
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

    // ── Single source of truth: onAuthStateChange ─────────────────────────────
    // INITIAL_SESSION fires immediately on subscribe with the cached session.
    // This is faster than calling getSession() separately and avoids the
    // race condition where both initializeSession + listener update state.

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: any, session: any) => {
        if (!mounted) return

        // ── Signed out ────────────────────────────────────────────────────────
        if (event === "SIGNED_OUT") {
          setUser(null)
          setHasSession(false)
          setLoading(false)
          router.push("/")
          return
        }

        // ── Password recovery ─────────────────────────────────────────────────
        if (event === "PASSWORD_RECOVERY") {
          setLoading(false)
          router.push("/setup-password")
          return
        }

        // ── Has a session: INITIAL_SESSION | SIGNED_IN | TOKEN_REFRESHED ──────
        if (session?.user) {
          setHasSession(true)
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
              // Skip redirect if the user is actively setting their password —
              // the setup-password page controls its own redirect after updateUser().
              const onSetupPage = typeof window !== 'undefined' &&
                window.location.pathname === '/setup-password'
              if (!onSetupPage) {
                // Active sign-in: push to the correct dashboard
                if (mapped) {
                  router.push(dashboardPath(mapped.role!))
                } else if (result !== 'error') {
                  // Profile truly missing and couldn't be created
                  router.push("/setup-password")
                }
              }
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
