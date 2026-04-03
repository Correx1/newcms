/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { ArrowLeft, Target, Mail, Phone, Building2, Briefcase, UserCheck, StickyNote, Send, Loader2, ExternalLink, Trash2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { DetailSkeleton } from "@/components/ui/page-skeleton"

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
  return <Badge variant="outline" className={`text-[11px] font-semibold capitalize ${s.color}`}>{s.label}</Badge>
}

export default function LeadDetailPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const leadId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [lead, setLead] = useState<any>(null)
  const [notes, setNotes] = useState<any[]>([])

  const [saving, setSaving] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [addingNote, setAddingNote] = useState(false)
  const [converting, setConverting] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [emailSubject, setEmailSubject] = useState("")
  const [emailBody, setEmailBody] = useState("")
  const [sendingEmail, setSendingEmail] = useState(false)

  // Editable fields
  const [stage, setStage] = useState("")

  const fetch = useCallback(async () => {
    const res = await window.fetch(`/api/admin/leads/${leadId}`, { credentials: "include" })
    if (res.ok) {
      const data = await res.json()
      setLead(data.lead)
      setNotes(data.notes || [])
      setStage(data.lead.stage)
    }
    setLoading(false)
  }, [leadId])

  useEffect(() => {
    if (!user || user.role !== "admin") { router.push("/dashboard/admin"); return }
    fetch()
  }, [user, router, fetch])

  const handleSave = async () => {
    setSaving(true)
    const res = await window.fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ stage }),
    })
    if (res.ok) {
      toast.success("Lead updated!")
      const data = await res.json()
      setLead(data.lead)
    } else {
      toast.error("Failed to save")
    }
    setSaving(false)
  }

  const handleAddNote = async () => {
    if (!newNote.trim()) return
    setAddingNote(true)
    const res = await window.fetch(`/api/admin/leads/${leadId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ content: newNote }),
    })
    if (res.ok) {
      toast.success("Note added!")
      setNewNote("")
      fetch()
    } else {
      toast.error("Failed to add note")
    }
    setAddingNote(false)
  }

  const handleSendEmail = async () => {
    if (!emailSubject.trim() || !emailBody.trim()) return
    setSendingEmail(true)
    const res = await window.fetch(`/api/admin/leads/${leadId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ subject: emailSubject, body: emailBody }),
    })
    if (res.ok) {
      toast.success("Email sent to lead!")
      setEmailSubject("")
      setEmailBody("")
      fetch()
    } else {
      const { error } = await res.json()
      toast.error(error || "Failed to send email")
    }
    setSendingEmail(false)
  }

  const handleDelete = async () => {
    setDeletingId(leadId)
    const res = await window.fetch(`/api/admin/leads/${leadId}`, {
      method: "DELETE", credentials: "include"
    })
    if (res.ok) {
      toast.success("Lead deleted")
      router.push("/leads")
    } else {
      toast.error("Failed to delete lead")
    }
    setDeletingId(null)
  }

  const handleConvert = async () => {
    setConverting(true)
    const res = await window.fetch(`/api/admin/leads/${leadId}/convert`, {
      method: "POST", credentials: "include"
    })
    const data = await res.json()
    if (res.ok) {
      toast.success("Lead converted to client!")
      setConvertOpen(false)
      router.push(`/clients/${data.client_id}`)
    } else {
      toast.error(data.error || "Failed to convert")
    }
    setConverting(false)
  }

  const hasChanges = lead && stage !== lead.stage

  if (loading) return <DetailSkeleton />
  if (!lead) return <div className="p-8 text-center text-muted-foreground font-semibold">Lead not found.</div>

  return (
    <>
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{lead.full_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <StageBadge stage={lead.stage} />
              {lead.converted_client_id && (
                <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[11px] font-semibold">
                  Converted to Client
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lead.converted_client_id ? (
            <Button asChild size="sm" className="font-bold h-9">
              <Link href={`/clients/${lead.converted_client_id}`}><ExternalLink className="h-4 w-4 mr-1.5" />View Client</Link>
            </Button>
          ) : (
            <Button
              size="sm"
              className="font-bold h-9 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              onClick={() => setConvertOpen(true)}
            >
              <UserCheck className="h-4 w-4 mr-1.5" /> Convert to Client
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-9 font-bold text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
            onClick={handleDelete}
            disabled={deletingId === leadId}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3 min-w-0">
        {/* Left sidebar */}
        <div className="md:col-span-1 space-y-4 min-w-0">
          {/* Contact info */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/5">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Lead Info
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {lead.email && (
                <div className="flex items-start gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="font-medium break-all">{lead.email}</span>
                </div>
              )}
              {lead.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{lead.phone}</span>
                </div>
              )}
              {lead.company && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{lead.company}</span>
                </div>
              )}
              {lead.service && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{lead.service}</span>
                </div>
              )}
              <div className="text-xs text-muted-foreground font-medium pt-1 border-t border-border/50">
                Added {new Date(lead.created_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </div>
            </CardContent>
          </Card>

          {/* CRM Controls */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-3 border-b border-border/50 bg-muted/5">
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Pipeline
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Stage</Label>
                <Select value={stage} onValueChange={(v) => { if (v) setStage(v) }}>
                  <SelectTrigger className="h-9 text-sm font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {hasChanges && (
                <Button onClick={handleSave} disabled={saving} className="w-full font-bold h-9 shadow-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right — message + notes */}
        <div className="md:col-span-2 space-y-4 min-w-0">
          {/* Original message */}
          {lead.message && (
            <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/5">
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" /> Original Inquiry
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground font-medium leading-relaxed whitespace-pre-wrap">{lead.message}</p>
              </CardContent>
            </Card>
          )}

          {/* Notes & Communication */}
          <Card className="shadow-sm border-border/50">
            <Tabs defaultValue="notes" className="w-full">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/5 flex flex-row items-center justify-between p-0 px-4 pt-2 h-14">
                <TabsList className="bg-transparent space-x-2">
                  <TabsTrigger value="notes" className="data-[state=active]:bg-background shadow-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:shadow-sm text-xs font-bold gap-2">
                    <StickyNote className="h-3.5 w-3.5" /> Internal Notes
                    {notes.length > 0 && <span className="bg-muted px-1.5 py-0.5 rounded-full text-[9px]">{notes.length}</span>}
                  </TabsTrigger>
                  {lead.email && (
                    <TabsTrigger value="email" className="data-[state=active]:bg-background shadow-none border border-transparent data-[state=active]:border-border/50 data-[state=active]:shadow-sm text-xs font-bold gap-2">
                      <Send className="h-3.5 w-3.5" /> Send Email
                    </TabsTrigger>
                  )}
                </TabsList>
              </CardHeader>
              
              <CardContent className="pt-4 space-y-4">
                <TabsContent value="notes" className="space-y-4 m-0">
                  {/* Add note */}
                  <div className="flex gap-2">
                    <Textarea
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Add a private internal note..."
                      className="text-sm font-medium resize-none flex-1"
                      rows={2}
                      onKeyDown={e => { if (e.key === "Enter" && e.metaKey) handleAddNote() }}
                    />
                    <Button
                      onClick={handleAddNote}
                      disabled={addingNote || !newNote.trim()}
                      size="icon"
                      className="shrink-0 h-[72px] w-10 font-bold shadow-sm"
                    >
                      {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* Notes list */}
                  {notes.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground border border-dashed border-border/50 rounded-lg bg-muted/5">
                      <StickyNote className="h-6 w-6 mx-auto mb-1.5 opacity-20" />
                      <p className="text-xs font-semibold">No activity logs yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notes.map(note => (
                        <div key={note.id} className="p-3 bg-muted/20 rounded-lg border border-border/40">
                          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap">{note.content}</p>
                          <p className="text-[10px] text-muted-foreground font-bold mt-2 uppercase tracking-wider">
                            {new Date(note.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {lead.email && (
                  <TabsContent value="email" className="space-y-4 m-0 animate-in fade-in zoom-in-95 duration-200">
                    <div className="space-y-3 p-4 bg-primary/5 rounded-lg border border-primary/10">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Recipient</Label>
                        <div className="text-sm font-semibold">{lead.email}</div>
                      </div>
                      <div className="space-y-1">
                        <Input 
                          placeholder="Subject Line" 
                          value={emailSubject}
                          onChange={e => setEmailSubject(e.target.value)}
                          className="font-bold border-primary/20 focus-visible:ring-primary/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <Textarea 
                          placeholder="Write your email message..."
                          value={emailBody}
                          onChange={e => setEmailBody(e.target.value)}
                          rows={6}
                          className="font-medium text-sm border-primary/20 focus-visible:ring-primary/20 resize-y"
                        />
                      </div>
                      <Button 
                        className="w-full font-bold shadow-sm" 
                        onClick={handleSendEmail}
                        disabled={sendingEmail || !emailSubject.trim() || !emailBody.trim()}
                      >
                        {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                        Send Email to Lead
                      </Button>
                    </div>
                  </TabsContent>
                )}
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>
    </div>

    {/* Convert to Client dialog */}
    <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserCheck className="h-5 w-5 text-emerald-600" /> Convert to Client</DialogTitle>
          <DialogDescription>
            This will create a new client profile for <strong>{lead.full_name}</strong> and mark this lead as Won.
            You can then send them a login invite from their client profile.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2 text-sm text-muted-foreground">
          <p>• A <strong>client profile</strong> will be created with their contact info</p>
          <p>• The lead stage will be set to <strong>Won</strong></p>
          <p>• You can create a project for them immediately after</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
          <Button
            className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
            onClick={handleConvert}
            disabled={converting}
          >
            {converting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserCheck className="h-4 w-4 mr-2" />}
            Yes, Convert
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
}
