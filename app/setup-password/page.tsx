/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { Loader2 } from "lucide-react"

const VALID_ROLES = ['admin', 'staff', 'client']

export default function SetupPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword]               = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading]                 = useState(false)
  const [errorMsg, setErrorMsg]               = useState("")
  const [success, setSuccess]                 = useState(false)
  const [sessionReady, setSessionReady]       = useState(false)

  useEffect(() => {
    let cancelled = false

    // ── Step 1: subscribe to auth state events ────────────────────────────────
    // SIGNED_IN fires when:
    //   • The Supabase SDK auto-exchanges a PKCE code found in the URL (?code=)
    //   • Hash-based implicit invite tokens are processed (#access_token=...&type=invite)
    // PASSWORD_RECOVERY is a defensive catch for misconfigured links.
    // Both mean a real invite session has been established — show the form.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: any, _session: any) => {
        if (cancelled) return
        if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
          setSessionReady(true)
        }
      }
    )

    // ── Step 2: handle the URL context synchronously ──────────────────────────
    const initSession = async () => {
      const params = new URLSearchParams(
        typeof window !== 'undefined' ? window.location.search : ''
      )
      const isViaInvite = params.get("via") === "invite"

      if (isViaInvite) {
        // auth/callback already:
        //   1. Signed out any previous session (e.g. admin on same device)
        //   2. Exchanged the PKCE code → wrote the invited user's session to cookies
        //   3. Redirected here with ?via=invite
        // Session is correct, form is safe to show immediately.
        if (!cancelled) setSessionReady(true)
        return
      }

      // Check for hash-based invite tokens (#access_token=...&type=invite).
      // If present, the SDK processes them asynchronously — do NOT call getSession()
      // here, it would return whatever is in cookies (possibly a different/admin user).
      // The SIGNED_IN listener above handles it when the hash resolves.
      const hash = typeof window !== 'undefined' ? window.location.hash : ''
      const hasInviteHash =
        hash.includes('access_token') ||
        hash.includes('type=invite') ||
        hash.includes('type=signup')

      if (hasInviteHash) {
        // SIGNED_IN fires next → setSessionReady(true)
        return
      }

      // Check for a PKCE code in the URL (?code=xxx) that the SDK hasn't
      // exchanged yet. Don't redirect — SIGNED_IN fires after exchange.
      const hasPkceCode = typeof window !== 'undefined' &&
        window.location.search.includes('code=')

      if (hasPkceCode) {
        // SDK will auto-exchange and fire SIGNED_IN → setSessionReady(true)
        return
      }

      // No invite context at all. Check whether there is an active session.
      const { data: { session } } = await supabase.auth.getSession()
      if (cancelled) return

      if (!session) {
        // No session and nothing pending → expired or invalid invite link.
        router.replace("/")
        return
      }

      // An authenticated user navigated here directly (e.g. bookmarked the URL).
      // Session is valid but this isn't an invite flow — redirect to their dashboard.
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single()

      const role = profile?.role
      if (!role || !VALID_ROLES.includes(role)) {
        if (typeof window !== 'undefined') window.location.href = 'https://noplin.com'
        return
      }
      window.location.href = `/dashboard/${role}`
    }

    initSession()

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase, router])

  // ── Form submission ───────────────────────────────────────────────────────
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg("")

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.")
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.")
      setLoading(false)
      return
    }

    try {
      // 1. Set the password for the currently-authenticated invited user.
      //    auth/callback signed out the previous session (admin) and signed in
      //    the invited user before we got here — updateUser acts on that user.
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setErrorMsg(updateError.message)
        return
      }

      // 2. Get the invited user's identity (now confirmed after password set).
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setErrorMsg("Session lost. Please request a new invite link.")
        return
      }

      // 3. Create the profiles row via server API (bypasses RLS).
      //    Passes name + role from the invite metadata Supabase stored.
      const ensureRes = await fetch('/api/ensure-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: user.user_metadata?.full_name ?? user.user_metadata?.name,
          role: user.user_metadata?.role,
        }),
        credentials: 'include',
      })

      if (!ensureRes.ok) {
        const body = await ensureRes.json().catch(() => ({}))
        console.error('[setup-password] ensure-profile failed:', body.error)
        // Treat as fatal: if the profile can't be created the user has no
        // valid role, so we cannot grant dashboard access.
        setErrorMsg(body.error ?? "Failed to create your profile. Contact your administrator.")
        return
      }

      // 4. Refresh the session so cookies are fully written before the
      //    hard navigation. Prevents a race where middleware finds a stale
      //    session and redirects to login on the very first dashboard load.
      await supabase.auth.refreshSession()

      // 5. Read the role from the profiles table — the single source of truth.
      //    Never use user_metadata.role or any hardcoded fallback here.
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      const role = profileRow?.role as string | undefined

      if (!role || !VALID_ROLES.includes(role)) {
        // Profile exists but has no valid role — exile.
        window.location.href = 'https://noplin.com'
        return
      }

      setSuccess(true)
      setTimeout(() => {
        window.location.href = `/dashboard/${role}`
      }, 800)

    } finally {
      setLoading(false)
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-6 md:p-6">
      <div className="w-full max-w-sm sm:max-w-md animate-in fade-in zoom-in duration-500 flex flex-col items-center">
        <div className="text-center mb-6">
          <Image
            src="/logo.png"
            alt="Noplin CMS Logo"
            width={120}
            height={120}
            className="w-24 h-24 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Set up your password
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Please choose a strong password to access your account
          </p>
        </div>

        <Card className="w-full border-border/50 shadow-xl shadow-primary/5 dark:shadow-none bg-card/50 backdrop-blur-xl transition-all">
          <form onSubmit={handleSetup} className="flex flex-col h-full">
            <div className="p-6 pb-2 text-center">
              <CardTitle className="text-xl">Create Password</CardTitle>
            </div>

            <CardContent className="space-y-5 px-6 pb-6 pt-4 flex-1">
              {errorMsg && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 text-center font-medium">
                  {errorMsg}
                </div>
              )}

              {success ? (
                <div className="bg-emerald-500/10 text-emerald-500 text-sm p-3 rounded-md border border-emerald-500/20 text-center font-medium">
                  Password set! Taking you to your dashboard…
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="bg-background/50 h-11"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm_password">Confirm Password</Label>
                    <Input
                      id="confirm_password"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="bg-background/50 h-11"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      className="w-full text-base h-11"
                      disabled={loading || !sessionReady}
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : !sessionReady ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Initializing…
                        </>
                      ) : (
                        "Save Password"
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  )
}
