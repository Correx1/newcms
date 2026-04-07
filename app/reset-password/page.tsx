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

export default function ResetPasswordPage() {
  const router = useRouter()
  const supabase = createClient()

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  const [success, setSuccess] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  // Smart session detection — three distinct paths:
  //
  // 1. Callback flow (staff): server already verified the recovery token and
  //    set a session cookie for the target user. URL has ?via=recovery.
  //    → Activate form on INITIAL_SESSION (current session IS the recovery session).
  //
  // 2. Hash flow (client): recovery token is in the URL hash (#type=recovery).
  //    Client-side Supabase will process it and fire PASSWORD_RECOVERY.
  //    → Wait; activate form when PASSWORD_RECOVERY fires.
  //
  // 3. Direct navigation / no recovery token: admin or anyone with an
  //    existing session visited this URL without a recovery link.
  //    → Redirect to their own dashboard immediately.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isCallbackRecovery = params.get('via') === 'recovery'
    const hashHasRecovery = window.location.hash.includes('type=recovery')

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === "PASSWORD_RECOVERY") {
        // Hash-based recovery token was processed. The active session is now
        // the target user's recovery session — safe to activate the form.
        setSessionReady(true)
      } else if (event === "INITIAL_SESSION") {
        if (!session) {
          // No session at all — link is invalid or expired.
          router.replace("/")
        } else if (isCallbackRecovery) {
          // Path 1: server-verified recovery. The cookie already belongs to
          // the target user (not the admin). Activate the form.
          setSessionReady(true)
        } else if (hashHasRecovery) {
          // Path 2: hash token present. Do nothing here — PASSWORD_RECOVERY
          // will fire next and activate the form once the token is exchanged.
        } else {
          // Path 3: no recovery signals. An authenticated user (e.g. admin)
          // opened this URL directly without a recovery link. Send them home.
          const role = session.user?.user_metadata?.role || 'client'
          window.location.href = `/dashboard/${role}`
        }
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase, router])

  const handleReset = async (e: React.FormEvent) => {
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
      // 1️⃣ Update the password
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setErrorMsg(updateError.message)
        return
      }

      // 2️⃣ Get role — prefer profile table, fall back to metadata
      const { data: { user } } = await supabase.auth.getUser()

      let role: string = user?.user_metadata?.role || "client"

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
        if (profile?.role) role = profile.role
      }

      // 3️⃣ Show feedback, then navigate
      setSuccess(true)
      setTimeout(() => {
        window.location.href = `/dashboard/${role}`
      }, 600)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-6 md:p-6">
      <div className="w-full max-w-sm sm:max-w-md animate-in fade-in zoom-in duration-500 flex flex-col items-center">
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="Noplin CMS Logo" width={120} height={120} className="w-24 h-24 object-contain mx-auto mb-4" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Reset your password</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">Enter a new, strong password below</p>
        </div>

        <Card className="w-full border-border/50 shadow-xl shadow-primary/5 dark:shadow-none bg-card/50 backdrop-blur-xl transition-all">
          <form onSubmit={handleReset} className="flex flex-col h-full">
            <div className="p-6 pb-2 text-center">
              <CardTitle className="text-xl">New Password</CardTitle>
            </div>

            <CardContent className="space-y-5 px-6 pb-6 pt-4 flex-1">
              {errorMsg && (
                <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 text-center font-medium">
                  {errorMsg}
                </div>
              )}
              {success ? (
                <div className="bg-emerald-500/10 text-emerald-500 text-sm p-3 rounded-md border border-emerald-500/20 text-center font-medium">
                  Password updated! Taking you to your dashboard…
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
                      {loading
                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        : !sessionReady
                          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Initializing…</>
                          : "Reset Password"}
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
