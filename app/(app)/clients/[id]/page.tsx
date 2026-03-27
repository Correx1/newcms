/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Building2, Mail, Phone, FolderKanban, CheckCircle2, Clock, Activity, Settings, Loader2, Receipt, FileText, Calendar, DollarSign, AlertCircle, MapPin, Briefcase, Plus, ArrowRight, ExternalLink, Download } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { DetailSkeleton, PageSkeleton } from "@/components/ui/page-skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"

export default function ClientProfilePage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params?.id as string
  const { user } = useAuth()
  
  const [loading, setLoading] = useState(true)
  const [clientProfile, setClientProfile] = useState<any>(null)
  const [clientInvoices, setClientInvoices] = useState<any[]>([])
  const [projectFinancials, setProjectFinancials] = useState<any[]>([])
  const [clientProjects, setClientProjects] = useState<any[]>([])
  const supabase = createClient()
  
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
        
        // Fetch specific invoices tied to the client
         const { data: clientInvoices } = await supabase
           .from('invoices')
           .select('id, invoice_number, issue_date, grand_total, status, currency')
           .eq('client_id', clientId)
           .order('created_at', { ascending: false })
           
        if (mounted && clientInvoices) {
           setClientInvoices(clientInvoices)
        }

        // Fetch project financials + list for this client  
        const { data: projData } = await supabase
          .from('projects')
          .select('id, title, status, deadline, price, amount_paid')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })

        if (mounted && projData) {
          setProjectFinancials(projData)
          setClientProjects(projData)
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

  // Compute financial metrics from real project data
  const totalBudget = projectFinancials.reduce((acc, p) => {
    const num = parseFloat((p.price || '0').toString().replace(/[^0-9.]/g, ''))
    return acc + (isNaN(num) ? 0 : num)
  }, 0)
  const totalPaid = projectFinancials.reduce((acc, p) => acc + Number(p.amount_paid || 0), 0)
  const totalBalance = Math.max(0, totalBudget - totalPaid)

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

  // Optimistic Invoice Mutator
  const updateInvoiceStatus = async (invoiceId: string, newStatus: string) => {
    setClientInvoices((current: any[]) => current.map((inv: any) => inv.id === invoiceId ? { ...inv, status: newStatus } : inv))
    const { error } = await supabase.from('invoices').update({ status: newStatus }).eq('id', invoiceId)
    if (error) {
       toast.error("Failed to update status")
    } else {
       toast.success("Invoice status updated")
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
                {clientProfile.email && !clientProfile.email.includes('@noplincms.local') && !clientProfile.email.startsWith('silent_')
                  ? <a href={`mailto:${clientProfile.email}`} className="text-primary hover:underline">{clientProfile.email}</a>
                  : <span className="text-muted-foreground italic font-medium">No email provided</span>
                }
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
            
            <div className="pt-4 border-t border-border/50 space-y-3">
              <div className="bg-muted/10 p-3 rounded-xl border border-border/50 shadow-sm">
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Total Budget</div>
                <div className="text-xl font-bold">${totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20 shadow-sm">
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 uppercase font-bold tracking-widest mb-1">Amount Paid</div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-300">${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>
              <div className="bg-destructive/5 p-3 rounded-xl border border-destructive/20 shadow-sm">
                <div className="text-[10px] text-destructive uppercase font-bold tracking-widest mb-1">Balance Outstanding</div>
                <div className="text-xl font-bold text-destructive">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
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

      {/* INVOICES SECTION */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="flex flex-row items-baseline justify-between bg-muted/5 border-b border-border/50 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Invoice History</CardTitle>
            <CardDescription className="font-medium mt-1">Record of all aggregated bills and official invoices transmitted to this client.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4 p-0 md:p-6 md:pt-4">
          {clientInvoices.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 pl-4 md:pl-0">Issue Date</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3">Invoice Number</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 text-right">Grand Total</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 text-center pr-4 md:pr-0">Status</TableHead>
                    <TableHead className="font-bold text-xs uppercase tracking-wider text-muted-foreground py-3 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientInvoices.map((inv: any) => (
                    <TableRow key={inv.id} className="border-border/50 group hover:bg-muted/20">
                      <TableCell className="text-muted-foreground text-sm font-semibold py-4 pl-4 md:pl-0">
                        {new Date(inv.issue_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell className="font-bold text-sm py-4">
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-md text-xs font-mono">{inv.invoice_number}</span>
                      </TableCell>
                      <TableCell className="text-right py-4 font-bold text-foreground">
                        {inv.currency === "NGN" ? "₦" : inv.currency === "GBP" ? "£" : inv.currency === "EUR" ? "€" : "$"}{Number(inv.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center py-4 pr-4 md:pr-0 w-[150px]">
                         <Select defaultValue={inv.status} onValueChange={(val) => updateInvoiceStatus(inv.id, val)}>
                            <SelectTrigger className={`h-8 text-[10px] uppercase font-bold tracking-wider border ${inv.status === 'paid' ? 'text-emerald-600 border-emerald-500/20 bg-emerald-500/10' : inv.status === 'overdue' ? 'text-destructive border-destructive/20 bg-destructive/10' : inv.status === 'unpaid' ? 'text-blue-500 border-blue-500/20 bg-blue-500/10' : 'text-slate-500 border-slate-500/20 bg-slate-500/10'}`}>
                               <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                               <SelectItem value="draft" className="text-xs font-bold text-slate-500">DRAFT</SelectItem>
                               <SelectItem value="unpaid" className="text-xs font-bold text-blue-500">UNPAID</SelectItem>
                               <SelectItem value="paid" className="text-xs font-bold text-emerald-600">PAID</SelectItem>
                               <SelectItem value="overdue" className="text-xs font-bold text-destructive">OVERDUE</SelectItem>
                            </SelectContent>
                         </Select>
                      </TableCell>
                      <TableCell className="py-4 px-4 md:px-6 text-right w-[100px]">
                         <Button variant="outline" size="icon" asChild className="h-8 w-8 text-primary border-primary/20 hover:bg-primary/10 shadow-sm" title="Download Invoice">
                            <Link href={`/invoices/${inv.id}`}><Download className="h-4 w-4" /></Link>
                         </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-10 border border-dashed rounded-lg border-border/50 mt-2 bg-muted/5 mx-4 md:mx-0 mb-4 md:mb-0">
              <Receipt className="mx-auto h-8 w-8 text-muted-foreground opacity-30 mb-3" />
              <h3 className="text-lg font-bold">No Official Invoices</h3>
              <p className="text-sm font-medium text-muted-foreground mt-1">This client has no finalized real invoices generated yet.</p>
            </div>
          )}
        </CardContent>
      </Card>

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
