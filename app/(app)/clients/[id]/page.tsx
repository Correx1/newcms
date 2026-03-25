/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Building2, Mail, Phone, FolderKanban, CheckCircle2, Clock, Activity, Settings, Loader2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { DetailSkeleton } from "@/components/ui/page-skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { toast } from "sonner"

export default function ClientProfilePage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params?.id as string
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [clientProfile, setClientProfile] = useState<any>(null)
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editName, setEditName] = useState("")
  const [editEmail, setEditEmail] = useState("")
  const [editPhone, setEditPhone] = useState("")
  const [editCompany, setEditCompany] = useState("")
  const [savingEdit, setSavingEdit] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchClientData = async () => {
      try {
        const res = await fetch(`/api/admin/profiles/${clientId}`, {
          credentials: 'include',
          cache: 'no-store'
        })
        
        if (res.ok) {
          const json = await res.json()
          if (mounted && json.profile) {
            setClientProfile(json.profile)
            setEditName(json.profile.name || "")
            setEditPhone(json.profile.phone || "")
            setEditCompany(json.profile.company || "")
            const rawEmail = json.profile.email || ""
            if (rawEmail.includes('@noplincms.local') || rawEmail.startsWith('silent_')) {
              setEditEmail("")
            } else {
              setEditEmail(rawEmail)
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch client details:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchClientData()
    return () => { mounted = false }
  }, [clientId])

  if (loading) return <DetailSkeleton />

  if (!clientProfile) {
    return <div className="p-8 text-center text-muted-foreground font-semibold">Client Map Execution failed structurally. Identity lost.</div>
  }

  const clientProjects = clientProfile.projects || []
  
  // Calculate total mocked value delivered based on prices 
  // (Assuming basic string numbers from price input, safely parsing)
  const totalValue = clientProjects.reduce((acc: number, p: any) => {
    if (p.price && p.status === "completed") {
      const num = parseFloat(p.price.toString().replace(/,/g, ''))
      return acc + (isNaN(num) ? 0 : num)
    }
    return acc
  }, 0)

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case "active": return <Activity className="h-4 w-4 text-blue-500" />
      default: return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingEdit(true)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          phone: editPhone,
          company: editCompany
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Client metadata synchronized successfully")
      setClientProfile({ ...clientProfile, name: editName, email: editEmail, phone: editPhone, company: editCompany })
      setIsEditDialogOpen(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to edit client")
    } finally {
      setSavingEdit(false)
    }
  }

  const handleSendInvite = async () => {
    if (!clientProfile.email || clientProfile.email.includes('@noplincms.local') || clientProfile.email.startsWith('silent_')) {
      toast.error("Please edit the client to assign a real email address before dispatching invites.", { duration: 5000 })
      return
    }
    
    setSendingInvite(true)
    try {
      const res = await fetch(`/api/admin/clients/${clientId}/invite`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Password setup invite dispatched securely.")
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch invite")
    } finally {
      setSendingInvite(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 w-full">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Exit Client Vector</span>
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{clientProfile.name || "Not provided"}</h1>
              <p className="text-muted-foreground mt-1 text-sm font-semibold">Client Profile</p>
            </div>
          </div>
          {user?.role === "admin" && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:ml-auto">
              <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)} className="shadow-sm font-bold bg-background text-foreground h-9">
                <Settings className="mr-2 h-4 w-4" /> Edit Details
              </Button>
              <Button size="sm" onClick={handleSendInvite} disabled={sendingInvite} className="shadow-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none h-9">
                {sendingInvite ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
                {clientProfile.email?.includes('@noplincms.local') || clientProfile.email?.startsWith('silent_') ? "Send Original Invite" : "Resend Invite"}
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1 shadow-sm border-border/50 h-fit">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl ring-2 ring-primary/20 shadow-sm border border-primary/20">
                {clientProfile.name ? clientProfile.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2) : "CL"}
              </div>
              <div>
                <CardTitle className="font-bold">{clientProfile.company || "Unmapped Corporation"}</CardTitle>
                <CardDescription className="uppercase text-[10px] tracking-widest mt-1 font-bold text-primary/70">
                  Client
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 pt-4 border-t border-border/50">
              <div className="flex items-center gap-3 text-sm font-semibold">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${clientProfile.email}`} className="text-primary hover:underline">{clientProfile.email}</a>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{clientProfile.phone || "No phone number provided"}</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{clientProfile.company || "No HQ defined"} Base</span>
              </div>
            </div>
            
            <div className="pt-4 border-t border-border/50">
              <div className="bg-muted/10 p-4 rounded-xl border border-border/50 shadow-sm">
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Total Value Delivered</div>
                <div className="text-2xl font-bold">${totalValue.toLocaleString()} <span className="text-[10px] uppercase font-bold text-emerald-500/70 ml-1">from completed projects</span></div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-sm border-border/50">
          <CardHeader className="flex flex-row items-baseline justify-between bg-muted/5 border-b border-border/50 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">Projects</CardTitle>
              <CardDescription className="font-medium mt-1">All projects linked to this client.</CardDescription>
            </div>
            <Button size="sm" asChild className="shadow-sm font-bold">
              <Link href={`/projects/new?client=${clientProfile.id}`}>
                New Project
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {clientProjects.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3">Project</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3">Status</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3">Deadline</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientProjects.map((project: any) => (
                    <TableRow key={project.id} className="border-border/50 group hover:bg-muted/20">
                      <TableCell className="font-bold flex items-center gap-2 py-4">
                        <FolderKanban className="h-4 w-4 text-primary shrink-0" />
                        <span className="truncate max-w-[200px]">{project.title}</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex items-center gap-2 font-semibold">
                          {getStatusIcon(project.status)}
                          <span className="capitalize text-sm">{project.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm font-medium py-4">
                        {project.deadline ? project.deadline.split('T')[0] : "None"}
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <Button variant="outline" size="sm" asChild className="opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                          <Link href={`/projects/${project.id}`}>View</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 border border-dashed rounded-lg border-border/50 mt-2 bg-muted/5">
                <FolderKanban className="mx-auto h-8 w-8 text-muted-foreground opacity-30 mb-3" />
                <h3 className="text-lg font-bold">No Projects Yet</h3>
                <p className="text-sm font-medium text-muted-foreground mt-1 mb-4">No projects have been created for this client yet.</p>
                <Button asChild className="shadow-sm font-semibold">
                  <Link href={`/projects/new?client=${clientProfile.id}`}>Create First Project</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {user?.role === "admin" && (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <form onSubmit={handleEditSubmit}>
              <DialogHeader>
                <DialogTitle>Edit Client Constraints</DialogTitle>
                <CardDescription>Update structural database maps and email bindings directly.</CardDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editName" className="text-right font-semibold">Name</Label>
                  <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} className="col-span-3 font-medium bg-muted/20" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editEmail" className="text-right font-semibold">Email</Label>
                  <Input id="editEmail" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Must be valid to receive invites" className="col-span-3 font-medium bg-muted/20" required />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editCompany" className="text-right font-semibold">Company</Label>
                  <Input id="editCompany" value={editCompany} onChange={(e) => setEditCompany(e.target.value)} className="col-span-3 font-medium bg-muted/20" />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="editPhone" className="text-right font-semibold">Phone</Label>
                  <Input id="editPhone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="col-span-3 font-medium bg-muted/20" />
                </div>
              </div>
              <DialogFooter className="border-t border-border/50 pt-4 pb-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={savingEdit} className="w-full sm:w-auto font-bold bg-muted/10">Cancel</Button>
                <Button type="submit" disabled={savingEdit} className="w-full sm:w-auto font-bold shadow-sm">{savingEdit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Changes"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
