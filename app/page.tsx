"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Image from "next/image"
import { Loader2, ShieldCheck } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState("")
  
  // Toggle between Password Login and Magic Link flows
  const [loginMode, setLoginMode] = useState<"password" | "magic_link">("password")
  const [sentMagicLink, setSentMagicLink] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrorMsg("")

    if (loginMode === "password") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        setErrorMsg(error.message)
      }
      // Success is handled automatically by AuthContext onAuthStateChange generating router.push()
    } else {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${location.origin}/auth/callback?next=/setup-password`
        }
      })
      if (error) {
        setErrorMsg(error.message)
      } else {
        setSentMagicLink(true)
      }
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8 md:p-8">
    

      <div className="w-full max-w-sm sm:max-w-md animate-in fade-in zoom-in duration-500 flex flex-col items-center">
        
        <div className="text-center mb-6">
          <Image src="/logo.png" alt="Agency CRM Logo" width={100} height={100} className="w-16 h-16 object-contain mx-auto mb-4" />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">Sign in to your secure portal</p>
        </div>

        <Card className="w-full border-border/50 shadow-xl shadow-primary/5 dark:shadow-none bg-card/50 backdrop-blur-xl transition-all">
          {sentMagicLink ? (
             <div className="p-8 pb-10 text-center flex flex-col items-center">
                <ShieldCheck className="h-12 w-12 text-emerald-500 mb-4" />
               
                <Button variant="outline" className="mt-6 w-full" onClick={() => setSentMagicLink(false)}>Back to Login</Button>
             </div>
          ) : (
            <form onSubmit={handleLogin} className="flex flex-col h-full">
              <div className="p-6 pb-2 text-center">
                <CardTitle className="text-xl">Sign In</CardTitle>
              </div>
              
              <CardContent className="space-y-5 px-6 pb-6 pt-4 flex-1">
                {errorMsg && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md border border-destructive/20 text-center font-medium">
                    {errorMsg}
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@agency.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                    className="bg-background/50 h-11"
                  />
                </div>
                
                {loginMode === "password" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <button type="button" onClick={() => setLoginMode("magic_link")} className="text-xs text-primary hover:underline font-medium">Forgot Password?</button>
                    </div>
                    <Input 
                      id="password" 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your secure password" 
                      required 
                      className="bg-background/50 h-11"
                    />
                  </div>
                )}
                
                <div className="pt-2">
                  <Button type="submit" className="w-full text-base h-11" disabled={loading}>
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (loginMode === "password" ? "Sign In" : "Send Magic Link")}
                  </Button>
                </div>
                
                {/* {loginMode === "password" ? (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    Prefer passwordless? <button type="button" onClick={() => setLoginMode("magic_link")} className="text-primary hover:underline font-medium">Use Magic Link</button>
                  </p>
                ) : (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    Have a password? <button type="button" onClick={() => setLoginMode("password")} className="text-primary hover:underline font-medium">Sign in traditionally</button>
                  </p>
                )} */}
              </CardContent>
            </form>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-8">
          By signing in, you agree to our Terms of Service and Privacy Policy. Securely encrypted by Supabase.
        </p>
      </div>
    </div>
  )
}
