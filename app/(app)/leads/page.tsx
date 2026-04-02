/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Target, Inbox, Search, Plus, ArrowUpRight, UserCheck, Loader2, Mail, Phone, Building2 } from "lucide-react"
import { toast } from "sonner"

const STAGES = [
  { value: "new", label: "New", color: "bg-blue-500/10 text-blue-700 border-blue-500/20 dark:text-blue-400" },
  { value: "contacted", label: "Contacted", color: "bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400" },
  { value: "in_discussion", label: "In Discussion", color: "bg-purple-500/10 text-purple-700 border-purple-500/20 dark:text-purple-400" },
  { value: "proposal_sent", label: "Proposal Sent", color: "bg-orange-500/10 text-orange-700 border-orange-500/20 dark:text-orange-400" },
  { value: "won", label: "Won", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400" },
  { value: "lost", label: "Lost", color: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400" },
]

function StageBadge({ stage }: { stage: string }) {
  const s = STAGES.find(x => x.value === stage) || STAGES[0]
  return (
    <Badge variant="outline" className={`text-[11px] font-semibold capitalize ${s.color}`}>
      {s.label}
    </Badge>
  )
}


export default function LeadsPage() {
  const { user } = useAuth()
  const router = useRouter()

  const [tab, setTab] = useState<"leads" | "inbox">("leads")
  const [leads, setLeads] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [stageFilter, setStageFilter] = useState("all")
  const [promotingId, setPromotingId] = useState<string | null>(null)

  // Create lead dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", company: "", service: "", message: "" })

  const fetchLeads = useCallback(async () => {
    const url = stageFilter !== "all" ? `/api/admin/leads?stage=${stageFilter}` : "/api/admin/leads"
    const res = await fetch(url, { credentials: "include" })
    if (res.ok) {
      const data = await res.json()
      setLeads(data.leads || [])
    }
  }, [stageFilter])

  const fetchSubmissions = useCallback(async () => {
    const res = await fetch("/api/admin/contact-submissions", { credentials: "include" })
    if (res.ok) {
      const data = await res.json()
      setSubmissions(data.submissions || [])
    }
  }, [])

  useEffect(() => {
    if (!user || user.role !== "admin") { router.push("/dashboard/admin"); return }
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchLeads(), fetchSubmissions()])
      setLoading(false)
    }
    load()
  }, [user, router, fetchLeads, fetchSubmissions])

  const handlePromote = async (submissionId: string) => {
    setPromotingId(submissionId)
    const res = await fetch(`/api/admin/contact-submissions/${submissionId}/promote`, {
      method: "POST", credentials: "include"
    })
    const data = await res.json()
    if (res.ok) {
      toast.success("Promoted to lead successfully!")
      await Promise.all([fetchLeads(), fetchSubmissions()])
      setTab("leads")
    } else {
      toast.error(data.error || "Failed to promote")
    }
    setPromotingId(null)
  }

  const handleCreate = async () => {
    if (!form.full_name.trim()) { toast.error("Name is required"); return }
    setCreating(true)
    const res = await fetch("/api/admin/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (res.ok) {
      toast.success("Lead created!")
      setCreateOpen(false)
      setForm({ full_name: "", email: "", phone: "", company: "", service: "", message: "" })
      fetchLeads()
    } else {
      toast.error(data.error || "Failed to create lead")
    }
    setCreating(false)
  }

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase()
    return !q || l.full_name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q)
  })

  const filteredSubmissions = submissions.filter(s => {
    const q = search.toLowerCase()
    return !q || s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q)
  })

  if (!user || user.role !== "admin") return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Target className="h-7 w-7 text-primary" /> Leads
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Manage incoming inquiries and track them through your sales pipeline.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="font-bold shadow-sm h-9 shrink-0">
          <Plus className="h-4 w-4 mr-1.5" /> Add Lead
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: leads.length, color: "text-primary" },
          { label: "Active", value: leads.filter(l => !["won","lost"].includes(l.stage)).length, color: "text-blue-600" },
          { label: "Won", value: leads.filter(l => l.stage === "won").length, color: "text-emerald-600" },
          { label: "Inbox", value: submissions.length, color: "text-amber-500" },
        ].map(stat => (
          <Card key={stat.label} className="shadow-sm border-border/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{stat.label}</p>
              <p className={`text-2xl font-black mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + filters */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-0 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 pb-4">
            <div className="flex rounded-lg bg-muted/30 p-1 gap-1">
              <button
                onClick={() => setTab("leads")}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${tab === "leads" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Target className="h-3.5 w-3.5 inline mr-1.5" />Leads
                {leads.length > 0 && <span className="ml-1.5 text-[10px] bg-primary/10 text-primary rounded-full px-1.5 py-0.5 font-bold">{leads.length}</span>}
              </button>
              <button
                onClick={() => setTab("inbox")}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${tab === "inbox" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Inbox className="h-3.5 w-3.5 inline mr-1.5" />Inbox
                {submissions.length > 0 && <span className="ml-1.5 text-[10px] bg-amber-500/10 text-amber-600 rounded-full px-1.5 py-0.5 font-bold">{submissions.length}</span>}
              </button>
            </div>
            <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 h-8 text-sm w-52 font-medium"
                />
              </div>
              {tab === "leads" && (
                <Select value={stageFilter} onValueChange={(val) => setStageFilter(val as string)}>
                  <SelectTrigger className="h-8 text-sm w-40 font-medium">
                    <SelectValue placeholder="Stage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : tab === "leads" ? (
            filteredLeads.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <Target className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold text-sm">No leads found</p>
                <p className="text-xs mt-1">Promote submissions from the Inbox tab or add a lead manually.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10 border-b border-border/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 pl-4">Name</TableHead>
                      <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 hidden sm:table-cell">Contact</TableHead>
                      <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 hidden md:table-cell">Service</TableHead>
                      <TableHead className="font-semibold text-xs tracking-wider uppercase py-3">Stage</TableHead>
                      <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map(lead => (
                      <TableRow
                        key={lead.id}
                        className="group hover:bg-muted/10 border-border/50 transition-colors cursor-pointer"
                        onClick={() => router.push(`/leads/${lead.id}`)}
                      >
                        <TableCell className="py-4 pl-4">
                          <div className="font-bold text-sm group-hover:text-primary transition-colors">{lead.full_name}</div>
                           <div className="text-xs text-muted-foreground mt-0.5 font-medium">{lead.company}</div>
                        </TableCell>
                        <TableCell className="py-4 hidden sm:table-cell">
                          <div className="text-xs text-muted-foreground space-y-0.5">
                            {lead.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{lead.email}</div>}
                            {lead.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell className="py-4 hidden md:table-cell">
                          <span className="text-sm text-muted-foreground font-medium">{lead.service || "—"}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <StageBadge stage={lead.stage} />
                        </TableCell>
                        <TableCell className="py-4 pr-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] font-bold"
                            onClick={e => { e.stopPropagation(); router.push(`/leads/${lead.id}`) }}
                          >
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            // INBOX TAB
            filteredSubmissions.length === 0 ? (
              <div className="text-center py-14 text-muted-foreground">
                <Inbox className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="font-semibold text-sm">No new submissions</p>
                <p className="text-xs mt-1">All contact form submissions have been reviewed.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10 border-b border-border/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 pl-4 w-40">Name</TableHead>
                      <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 hidden sm:table-cell w-40">Email</TableHead>
                      <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 hidden md:table-cell w-28">Service</TableHead>
                      <TableHead className="font-semibold text-xs tracking-wider uppercase py-3">Message</TableHead>
                      <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 pr-4 text-right w-24">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map(sub => (
                      <TableRow key={sub.id} className="hover:bg-muted/10 border-border/50 transition-colors">
                        <TableCell className="py-4 pl-4">
                          <div className="font-bold text-sm">{sub.full_name}</div>
                          {sub.company && <div className="text-xs text-muted-foreground mt-0.5 font-medium flex items-center gap-1"><Building2 className="h-3 w-3" />{sub.company}</div>}
                        </TableCell>
                        <TableCell className="py-4 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground font-medium">{sub.email || "—"}</span>
                        </TableCell>
                        <TableCell className="py-4 hidden md:table-cell">
                          <span className="text-xs text-muted-foreground font-medium">{sub.service || "—"}</span>
                        </TableCell>
                        <TableCell className="py-3 max-w-0">
                          {sub.message ? (
                            <p className="text-xs text-muted-foreground font-medium line-clamp-2 italic leading-relaxed">{sub.message}</p>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4 pr-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px] font-bold shadow-sm"
                            disabled={promotingId === sub.id}
                            onClick={() => handlePromote(sub.id)}
                          >
                            {promotingId === sub.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><UserCheck className="h-3 w-3 mr-1" />Promote</>}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )}
        </CardContent>
      </Card>

      {/* Create Lead Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Add New Lead</DialogTitle>
            <DialogDescription>Manually create a lead to track in your pipeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="font-semibold text-sm">Full Name <span className="text-red-500">*</span></Label>
                <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="John Doe" className="font-medium" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Email</Label>
                <Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="john@example.com" className="font-medium" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1 234 567 8900" className="font-medium" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Company</Label>
                <Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Acme Inc." className="font-medium" />
              </div>
              <div className="space-y-1.5">
                <Label className="font-semibold text-sm">Service Interest</Label>
                <Input value={form.service} onChange={e => setForm(f => ({ ...f, service: e.target.value }))} placeholder="Web Design, SEO..." className="font-medium" />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="font-semibold text-sm">Message / Notes</Label>
                <Textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="What are they looking for?" className="font-medium resize-none" rows={3} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating} className="font-bold">
              {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
