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

export default function SetupPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [success, setSuccess] = useState(false)

  const [sessionReady, setSessionReady] = useState(false)

  // Wait for Supabase to initialize the session from the URL hash or cookie.
  // getSession() fires immediately before hash tokens are parsed → false null.
  // onAuthStateChange is the correct way to know when a session is truly ready.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
        // Invite token was exchanged (SIGNED_IN) or recovery link fired.
        // The session now belongs to the invited user — allow the form.
        setSessionReady(true)
      } else if (event === 'INITIAL_SESSION') {
        if (session) {
          // There is an active session already. Two possibilities:
          // 1. An already-logged-in user navigated here directly → redirect away.
          // 2. A brand-new invite user arrived via hash tokens → SIGNED_IN will
          //    fire next and setSessionReady(true). Don't redirect in this case.
          //
          // Distinguish by checking if there are auth hash tokens in the URL.
          // New invite links contain #access_token=... in the URL fragment.
          const hasAuthHash = typeof window !== 'undefined' &&
            (window.location.hash.includes('access_token') ||
             window.location.hash.includes('type='))

          if (!hasAuthHash) {
            // No hash → already-logged-in user. Redirect to root.
            // Middleware will route them to their correct dashboard using
            // the profiles table (not user_metadata which can be stale).
            router.replace("/")
          }
          // If hash is present, SIGNED_IN fires next — do nothing here.
        } else {
          // No session and no hash → invalid or expired invite link.
          router.replace("/")
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase, router])

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
      // 1️⃣ Set the password purely, relying on native SDK timeouts
      const { error: updateError } = await supabase.auth.updateUser({ password })
      
      if (updateError) {
        setErrorMsg(updateError.message)
        return
      }

      // 2️⃣ Get current user info
      const { data: { user } } = await supabase.auth.getUser()

      // 3️⃣ Ensure profile row exists — calls server API that bypasses RLS
      if (user) {
        const res = await fetch('/api/ensure-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: user.user_metadata?.full_name ?? user.user_metadata?.name,
            role: user.user_metadata?.role,
          }),
          credentials: 'include',
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.error('[setup-password] ensure-profile failed:', body.error)
          // Non-fatal: still redirect; auth-context will retry on load
        }
      }

      // 4️⃣ Force a session token refresh so cookies are fully written to the
      //    browser BEFORE we do a full-page reload. Without this, the page
      //    reload can race against Supabase's async cookie write and the
      //    middleware/auth-context may find no valid session → redirect to login.
      await supabase.auth.refreshSession()

      // 5️⃣ Read role from the profiles table — source of truth.
      //    We just called ensure-profile so the row is guaranteed to exist.
      //    Never fall back to user_metadata.role or a hardcoded string here.
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single()

      const role = profileRow?.role as string | undefined

      if (!role || !['admin', 'staff', 'client'].includes(role)) {
        // Profile was not created (ensure-profile rejected the role).
        // Exile — do not grant dashboard access under any circumstances.
        window.location.href = 'https://noplin.com'
        return
      }

      setSuccess(true)
      setTimeout(() => {
        window.location.href = `/dashboard/${role}`
      }, 800)
    } finally {
      // Always clear loading — even if updateUser hung or threw unexpectedly
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-6 md:p-6">
 

      <div className="w-full max-w-sm sm:max-w-md animate-in fade-in zoom-in duration-500 flex flex-col items-center">
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="Agency CRM Logo" width={120} height={120} className="w-24 h-24 object-contain mx-auto mb-4" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Set up your password</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">Please choose a strong password</p>
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
                    <Button type="submit" className="w-full text-base h-11" disabled={loading || !sessionReady}>
                      {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : !sessionReady ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Initializing…</> : "Save Password"}
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
