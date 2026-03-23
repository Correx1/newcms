"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Save, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

export default function NewClientPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [name, setName]       = useState("")
  const [email, setEmail]     = useState("")
  const [phone, setPhone]     = useState("")
  const [company, setCompany] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <h2 className="text-2xl font-bold">Unauthorized</h2>
        <p className="text-muted-foreground mt-2">You do not have permission to add new clients.</p>
        <Button className="mt-6" onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const res = await fetch("/api/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          name,
          role: "client",
          phone:   phone   || undefined,
          company: company || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Failed to create client account")
        return
      }

      toast.success(`Invite sent to ${email}! They'll receive an email to set their password.`)
      router.push("/clients")
    } catch {
      toast.error("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Add New Client</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Creates a client account and sends them an invite email to set up their password.
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/50">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle>Client Information</CardTitle>
            <CardDescription>Enter the client&apos;s contact and company details.</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="E.g. Jane Doe"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="E.g. Acme Corp"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="bg-background/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="jane@acme.com"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="phone">Phone Number (Optional)</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="bg-background/50"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex justify-end gap-2 border-t border-border/50 pt-4">
            <Button variant="outline" type="button" asChild disabled={submitting}>
              <Link href="/clients">Cancel</Link>
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Save className="mr-2 h-4 w-4" />}
              Create &amp; Send Invite
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
