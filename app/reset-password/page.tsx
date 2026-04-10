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

  useEffect(() => {
    const initRecovery = async () => {
      const hash = window.location.hash
      const params = new URLSearchParams(window.location.search)
      const isCallbackRecovery = params.get("via") === "recovery"

      // 🔥 Handle hash-based recovery (email link)
      if (hash.includes("type=recovery")) {
        await supabase.auth.signOut()

        const { error } = await supabase.auth.exchangeCodeForSession(window.location.href)

        if (error) {
          console.error("Recovery exchange failed:", error.message)
          router.replace("/")
          return
        }

        setSessionReady(true)
        return
      }

      // 🔥 Handle server-side recovery (?via=recovery)
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace("/")
        return
      }

      if (isCallbackRecovery) {
        setSessionReady(true)
        return
      }

      // 🔥 Normal logged-in user → redirect away
      const role = session.user?.user_metadata?.role || "client"
      window.location.href = `/dashboard/${role}`
    }

    initRecovery()
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
      const { error: updateError } = await supabase.auth.updateUser({ password })

      if (updateError) {
        setErrorMsg(updateError.message)
        return
      }

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
          <Image
            src="/logo.png"
            alt="Noplin CMS Logo"
            width={120}
            height={120}
            className="w-24 h-24 object-contain mx-auto mb-4"
          />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Reset your password
          </h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            Enter a new, strong password below
          </p>
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
                        "Reset Password"
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