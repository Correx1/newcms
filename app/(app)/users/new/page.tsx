"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Send, Loader2, UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { toast } from "sonner"

export default function NewUserPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [role, setRole] = useState("staff")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [company, setCompany] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [submitting, setSubmitting] = useState(false)

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <h2 className="text-2xl font-bold">Unauthorized</h2>
        <p className="text-muted-foreground mt-2">Only administrators can create user accounts.</p>
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
          role,
          phone:     phone     || undefined,
          company:   company   || undefined,
          job_title: jobTitle  || undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? "Failed to create user")
        return
      }

      toast.success(`Invite sent to ${email}! They will receive an email to set up their password.`)

      // Navigate to the right list page
      if (role === "client") router.push("/clients")
      else router.push("/staff")

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
          <Link href="/dashboard/admin">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Create User Account</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The user will receive an email invite to set up their password and access their dashboard.
          </p>
        </div>
      </div>

      <Card className="shadow-sm border-border/50">
        <form onSubmit={handleSubmit}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" /> New User Invite
            </CardTitle>
            <CardDescription>
              An invite email will be sent. Once they click the link, they&apos;ll set their own password and land on their role-specific dashboard.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  placeholder="E.g. Emily Chen"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2 col-span-2 sm:col-span-1">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="emily@agency.com"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Select required value={role} onValueChange={val => setRole(val ?? role)}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select a role..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="bg-background"
              />
            </div>

            {role === "client" && (
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  placeholder="E.g. Acme Corp"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="bg-background"
                />
              </div>
            )}

            {role === "staff" && (
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title</Label>
                <Input
                  id="job_title"
                  placeholder="E.g. Frontend Developer"
                  value={jobTitle}
                  onChange={e => setJobTitle(e.target.value)}
                  className="bg-background"
                />
              </div>
            )}
          </CardContent>

          <CardFooter className="flex justify-end gap-2 border-t border-border/50 pt-4">
            <Button variant="outline" type="button" onClick={() => router.back()} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting
                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                : <Send className="mr-2 h-4 w-4" />}
              Send Invite
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
