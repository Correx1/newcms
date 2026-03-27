/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Clock, Activity, CheckCircle2, Calendar, FolderKanban, Edit, User, Upload, FileText, Download, Building2, DollarSign, ExternalLink, Image as ImageIcon, ChevronDown, Trash2, AlertCircle, ThumbsUp, ShieldCheck, Loader2, XCircle } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import KanbanBoard from "./kanban-board"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { compressFile } from "@/lib/compress-file"

export default function ProjectDetailsPage() {
  const { user } = useAuth()
  const params = useParams()
  const router = useRouter()
  const projectId = params?.id as string
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [project, setProject] = useState<any>(null)

  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [completionNotes, setCompletionNotes] = useState("")
  const [completionLinks, setCompletionLinks] = useState("")
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [feedbackNotes, setFeedbackNotes] = useState("")

  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotes, setPaymentNotes] = useState("")
  const [submittingPayment, setSubmittingPayment] = useState(false)

  const [taskProgress, setTaskProgress] = useState(0)

  const fetchProject = async () => {
    const res = await fetch(`/api/projects/${projectId}`, { credentials: 'include', cache: 'no-store' })

    if (res.ok) {
      const { project: pData } = await res.json()
      if (user?.role === "client" && pData.client_id !== user.id) {
        router.push("/dashboard")
        return
      }
      setProject(pData)
    } else {
      router.push("/projects")
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProject()
  }, [user?.id, projectId])

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "approved": return <ShieldCheck className="h-5 w-5 text-indigo-500" />
      case "completed": return <CheckCircle2 className="h-5 w-5 text-emerald-500" />
      case "active": return <Activity className="h-5 w-5 text-blue-500" />
      case "rejected": return <XCircle className="h-5 w-5 text-rose-500" />
      default: return <Clock className="h-5 w-5 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case "approved": return "text-indigo-500 border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20"
      case "completed": return "text-emerald-500 border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20"
      case "active": return "text-blue-500 border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20"
      case "rejected": return "text-rose-500 border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20"
      default: return "text-yellow-500 border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/20"
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === "completed") {
      if (project.deliverables_summary) {
        setCompletionNotes(project.deliverables_summary)
        setCompletionLinks(project.deliverables_links?.join('\n') || "")
      }
      setCompleteModalOpen(true)
      return
    }
    
    setProject({ ...project, status: newStatus })
    const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', project.id)
    if (error) toast.error("Failed to update status")
    else toast.success("Status synced globally")
  }

  const submitCompletion = async () => {
    setSubmitting(true)
    const uploadedFilesData: {id: string, name: string, url: string, type: string, uploadedAt: string}[] = []

    for (const file of completionFiles) {
      let fileData: File | Blob
      try {
        fileData = await compressFile(file)
      } catch (e: any) {
        toast.error(e.message)
        setSubmitting(false)
        return
      }
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`
      const { data, error } = await supabase.storage.from('deliverables_vault').upload(`projects/${project.id}/${fileName}`, fileData)
      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage.from('deliverables_vault').getPublicUrl(data.path)
        uploadedFilesData.push({ id: `f-${Date.now()}`, name: file.name, url: publicUrl, type: file.type, uploadedAt: new Date().toISOString() })
      }
    }

    const compiledLinks = completionLinks.split('\n').map(l => l.trim()).filter(Boolean)
    const currentFiles = project.deliverables_files || []
    const allDeliverableFiles = [...currentFiles, ...uploadedFilesData]

    const res = await fetch('/api/projects/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        projectId: project.id,
        deliverables_summary: completionNotes,
        deliverables_links: compiledLinks,
        deliverables_files: allDeliverableFiles,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Failed to commit completion')
    } else {
      toast.success('Delivery manifest updated!')
      setProject({
        ...project,
        status: 'completed',
        deliverables_summary: completionNotes,
        deliverables_links: compiledLinks,
        deliverables_files: allDeliverableFiles,
      })
    }

    setSubmitting(false)
    setCompleteModalOpen(false)
    setCompletionFiles([])
  }

  const submitRejection = async () => {
    // Keep all deliverables intact — just flip status to 'rejected' and record feedback
    const timestamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    const prefix = user?.role === "admin" ? "Admin Request" : "Client Revision"
    const newEntry = `[${timestamp}] ${prefix}:\n${feedbackNotes}`
    const updatedFeedback = project.client_feedback ? `${newEntry}\n\n---\n\n${project.client_feedback}` : newEntry

    setProject({ ...project, status: "rejected", client_feedback: updatedFeedback })
    const { error } = await supabase
      .from('projects')
      .update({ status: "rejected", client_feedback: updatedFeedback })
      .eq('id', project.id)
    
    if (error) toast.error("Failed to request revision")
    else toast.success("Revision requested — delivery details preserved")
    
    setRejectModalOpen(false)
    setFeedbackNotes("")
  }

  const submitPayment = async () => {
    setSubmittingPayment(true)
    const res = await fetch(`/api/projects/${project.id}/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: paymentAmount,
        payment_date: paymentDate,
        notes: paymentNotes
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error || "Failed to log payment")
    } else {
      toast.success("Payment recorded successfully")
      setPaymentModalOpen(false)
      setPaymentAmount("")
      setPaymentNotes("")
      fetchProject() // reload to get updated logs and amount_paid
    }
    setSubmittingPayment(false)
  }

  const deleteCompletionFile = async (idxFile: number) => {
    if (!window.confirm("Delete this delivery file?")) return
    const newFiles = [...project.deliverables_files]
    newFiles.splice(idxFile, 1)
    
    setProject({ ...project, deliverables_files: newFiles })
    const { error } = await supabase.from('projects').update({ deliverables_files: newFiles }).eq('id', project.id)
    if (error) fetchProject()
  }

  const deleteProjectFile = async (idxFile: number) => {
    if (!window.confirm("Delete this initial attachment?")) return
    const newFiles = [...(project.files || [])]
    newFiles.splice(idxFile, 1)
    
    setProject({ ...project, files: newFiles })
    const { error } = await supabase.from('projects').update({ files: newFiles }).eq('id', project.id)
    if (error) fetchProject()
  }

  if (loading || !project) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    )
  }

  const assignedProfiles = project.assignments?.map((a: any) => a.profiles).filter(Boolean) || []
  const currentUserAssignment = project.assignments?.find((a: any) => a.user_id === user?.id)

  return (
    <div className="space-y-6 pb-12 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{project.title}</h1>
              {(user?.role === "admin" || (user?.role === "staff" && project.status !== "approved")) ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Badge variant="outline" className={`capitalize gap-1.5 pl-1.5 mb-1 cursor-pointer transition-colors ${getStatusColor(project.status)}`}>
                      {getStatusIcon(project.status)}
                      {project.status}
                      <ChevronDown className="h-3 w-3 opacity-70 ml-1" />
                    </Badge>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => handleStatusChange("pending")} className="cursor-pointer font-medium">
                      <Clock className="mr-2 h-4 w-4 text-yellow-500" /> Pending
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange("active")} className="cursor-pointer font-medium">
                      <Activity className="mr-2 h-4 w-4 text-blue-500" /> Active
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStatusChange("completed")} className="cursor-pointer font-medium">
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> Completed
                    </DropdownMenuItem>
                    {(project.status === "completed" || project.status === "approved") && (
                      <DropdownMenuItem onClick={() => handleStatusChange("approved")} className="cursor-pointer font-medium border-t">
                        <ShieldCheck className="mr-2 h-4 w-4 text-indigo-500" /> Approved
                      </DropdownMenuItem>
                    )}
                    {project.status === "rejected" && (
                      <DropdownMenuItem disabled className="cursor-default font-medium text-rose-500 focus:text-rose-500">
                        <XCircle className="mr-2 h-4 w-4" /> Rejected (by client)
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Badge variant="outline" className={`capitalize gap-1.5 pl-1.5 mb-1 ${getStatusColor(project.status)}`}>
                  {getStatusIcon(project.status)}
                  {project.status}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-sm flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5" /> {project.client?.company || project.client?.name || "Not provided"}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-3 w-full sm:w-1/3">
          {(user?.role === "admin") && (
            <div className="flex justify-end gap-2 w-full mt-4 sm:mt-0">
              <Button variant="outline" className="shadow-sm border-border/50" asChild>
                <Link href={`/projects/${project.id}/edit`}>
                  <Edit className="mr-2 h-4 w-4" /> Edit Details
                </Link>
              </Button>
            </div>
          )}
          
          {/* Real-time Project Tasks Automation Progress Bar */}
          <div className="bg-background/80 p-3 rounded-lg border border-border/50 shadow-sm w-full animate-in fade-in">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FolderKanban className="h-3.5 w-3.5" /> Task Progress
              </span>
              <span className="text-sm font-black text-primary">{taskProgress}%</span>
            </div>
            <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden">
              <div 
                className={cn("h-full transition-all duration-700 ease-out", taskProgress === 100 ? "bg-emerald-500" : "bg-primary")} 
                style={{ width: `${taskProgress}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full mb-6 mt-4">
        <TabsList className="mb-6 p-1 bg-muted/30 border border-border/50">
          <TabsTrigger value="overview" className="font-semibold px-4">Overview</TabsTrigger>
          <TabsTrigger value="tasks" className="font-semibold px-4"><FolderKanban className="w-3.5 h-3.5 mr-1.5" /> Tasks Board</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 outline-none mt-0">
          <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle>Project Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6 text-sm leading-relaxed whitespace-pre-wrap">
              {project.details || "No scoping details compiled locally."}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-5 w-5 text-primary" /> Key Deliverables
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="bg-muted/30 p-4 rounded-lg border border-border/50 font-mono text-sm whitespace-pre-wrap text-muted-foreground shadow-inner min-h-[100px]">
                {project.deliverables || "Awaiting exact delivery constraints..."}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 md:col-span-1">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Deadline</span>
                <div className="flex items-center font-medium">
                  <Calendar className="mr-2 h-4 w-4 text-muted-foreground" />
                  {project.deadline ? new Date(project.deadline).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : 'Flexible / No strict bound'}
                </div>
              </div>

              <div className="space-y-1 pt-2 border-t border-border/50">
                {user?.role === "staff" ? (
                  // STAFF VIEW: ONLY SHOW THEIR OWN EARNINGS
                  <div className="space-y-2 mt-2">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">My Earnings</span>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Expected Pay:</span>
                      <span className="font-semibold text-foreground">${Number(currentUserAssignment?.earnings || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Processed:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        ${Number(currentUserAssignment?.amount_paid || 0).toLocaleString()}
                      </span>
                    </div>
                    {Number(currentUserAssignment?.earnings || 0) > 0 && (
                      <div className="flex justify-between items-center text-sm border-t border-border/50 pt-1.5 mt-1.5">
                        <span className="text-muted-foreground font-semibold">Balance:</span>
                        <span className="font-bold text-amber-500">
                          ${Math.max(0, Number(currentUserAssignment?.earnings || 0) - Number(currentUserAssignment?.amount_paid || 0)).toLocaleString()}
                        </span>
                      </div>
                    )}
                    
                    {currentUserAssignment?.staff_payment_logs && currentUserAssignment.staff_payment_logs.length > 0 && (
                       <div className="mt-4 pt-3 border-t border-border/50 space-y-2">
                         <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest block mb-2">My Payment Ledger</span>
                         <div className="max-h-32 overflow-y-auto pr-2 space-y-1.5">
                           {currentUserAssignment.staff_payment_logs.sort((a:any, b:any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()).map((log: any) => (
                             <div key={log.id} className="flex flex-col gap-0.5 border-b border-border/30 pb-1.5 last:border-0 last:pb-0">
                               <div className="flex justify-between items-center">
                                 <span className="font-bold text-xs text-emerald-600 dark:text-emerald-400">+ ${Number(log.amount).toLocaleString()}</span>
                                 <span className="text-[9px] font-medium text-muted-foreground">{new Date(log.payment_date).toLocaleDateString()}</span>
                               </div>
                               {log.notes && <p className="text-[10px] text-muted-foreground/80 leading-snug truncate" title={log.notes}>{log.notes}</p>}
                             </div>
                           ))}
                         </div>
                       </div>
                    )}
                  </div>
                ) : (
                  // ADMIN VIEW: SHOW GLOBAL BUDGET
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground uppercase font-semibold">Global Financials</span>
                      {user?.role === "admin" && (
                        <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-primary bg-primary/10 hover:bg-primary/20" onClick={() => setPaymentModalOpen(true)}>
                          Log Payment
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2 mt-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Budget:</span>
                              <span className="font-semibold text-foreground">
                        ${Number(project.price || "Custom").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

                              </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Activity className="h-3.5 w-3.5" /> Paid:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          ${Number(project.amount_paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {parseFloat((project.price || "0").replace(/[^0-9.]/g, '')) > 0 && (
                        <div className="flex justify-between items-center text-sm border-t border-border/50 pt-1.5 mt-1.5">
                          <span className="text-muted-foreground font-semibold">Balance:</span>
                          <span className="font-bold text-destructive">
                            ${Math.max(0, parseFloat((project.price || "0").replace(/[^0-9.]/g, '')) - Number(project.amount_paid || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}
                      
                      {currentUserAssignment && Number(currentUserAssignment?.earnings || 0) > 0 && (
                        <div className="mt-4 pt-3 border-t border-border/50">
                          <span className="text-xs text-emerald-600 dark:text-emerald-400 uppercase font-semibold block mb-2">My Admin Earnings</span>
                          <div className="flex justify-between items-center text-sm mt-2">
                            <span className="text-muted-foreground">Expected Pay:</span>
                            <span className="font-semibold">${Number(currentUserAssignment.earnings).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-emerald-600/80">Processed:</span>
                            <span className="font-bold text-emerald-600">${Number(currentUserAssignment.amount_paid).toLocaleString()}</span>
                          </div>
                          
                          {currentUserAssignment?.staff_payment_logs && currentUserAssignment.staff_payment_logs.length > 0 && (
                            <div className="mt-3 bg-emerald-500/5 border border-emerald-500/10 p-2 rounded-md max-h-32 overflow-y-auto space-y-1">
                              {currentUserAssignment.staff_payment_logs.sort((a:any, b:any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()).map((log: any) => (
                                <div key={log.id} className="flex flex-col gap-0.5 border-b border-emerald-500/10 pb-1 last:border-0 last:pb-0">
                                  <div className="flex justify-between items-center">
                                    <span className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400">+ ${Number(log.amount).toLocaleString()}</span>
                                    <span className="text-[9px] font-medium text-muted-foreground">{new Date(log.payment_date).toLocaleDateString()}</span>
                                  </div>
                                  {log.notes && <p className="text-[9px] text-emerald-700/60 dark:text-emerald-300/60 truncate">{log.notes}</p>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              
              <div className="space-y-2 pt-2 border-t border-border/50">
                <span className="text-xs text-muted-foreground uppercase font-semibold">Assigned Staff</span>
                <div className="flex flex-col gap-2">
                  {project.assignments?.length > 0 ? project.assignments.map((a: any) => {
                    const s = a.profiles;
                    if(!s) return null;
                    return (
                    <div key={s.id} className="flex items-center justify-between text-sm font-medium bg-muted/40 p-2 rounded-md border border-border/50">
                      <div className="flex items-center">
                        <User className="mr-2 h-4 w-4 text-muted-foreground" />
                        {s.name}
                      </div>
                      {user?.role === "admin" && Number(a.earnings || 0) > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[10.5px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 transition-colors cursor-default" title="Internal staff expected pay">
                          ${Number(a.earnings).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}) : (
                    <span className="text-sm text-muted-foreground italic"></span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {user?.role !== "staff" && project.payment_logs && project.payment_logs.length > 0 && (
             <Card className="shadow-sm border-border/50">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/5">
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground"><Activity className="h-4 w-4" /> Payment Ledger</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {project.payment_logs.sort((a:any, b:any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()).map((log: any) => (
                   <div key={log.id} className="flex flex-col gap-1 border-b border-border/50 pb-3 last:border-0 last:pb-0">
                     <div className="flex justify-between items-center">
                       <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">+ ${Number(log.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                       <span className="text-[11px] font-medium text-muted-foreground">{new Date(log.payment_date).toLocaleDateString()}</span>
                     </div>
                     {log.notes && <p className="text-xs text-muted-foreground/80 leading-relaxed">{log.notes}</p>}
                     <p className="text-[9px] text-muted-foreground/50 text-right mt-0.5 font-medium uppercase tracking-widest">Logged by {log.recorded_by?.name || 'Admin'}</p>
                   </div>
                ))}
              </CardContent>
            </Card>
          )}

          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-3 border-b border-border/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle>Files</CardTitle>
                <CardDescription>Initial Attachments</CardDescription>
              </div>
              <Button size="icon" variant="outline" className="h-8 w-8 -mr-2 shadow-sm" disabled>
                <Upload className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {Array.isArray(project.files) && project.files.length > 0 ? project.files.map((file: any, i: number) => (
                  <div key={i} className="group flex items-start justify-between border bg-card p-3 rounded-lg hover:border-primary/50 hover:shadow-md transition-all shadow-sm">
                    <div className="flex items-start gap-3 overflow-hidden">
                      <div className="p-2 bg-primary/10 rounded-md text-primary shrink-0 mt-0.5">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="space-y-0.5 min-w-0 pr-2">
                        <p className="text-sm font-semibold leading-none truncate">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{new Date(file.uploadedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    {(user?.role === "admin" || user?.role === "staff") && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteProjectFile(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 bg-background/50 hover:bg-secondary" asChild>
                      <a href={file.url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a>
                    </Button>
                  </div>
                )) : (
                  <div className="text-center py-6 border border-dashed rounded-lg bg-muted/20">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-20 text-muted-foreground" />
                    <p className="text-sm font-medium text-muted-foreground">No pre-requisite scopes embedded</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {(project.status === "completed" || project.status === "approved" || project.status === "rejected") && project.deliverables_summary && (
        <Card className={`shadow-sm mt-6 mb-8 transition-colors ${
          project.status === 'approved' ? 'border-indigo-500/30 bg-indigo-500/5'
          : project.status === 'rejected' ? 'border-rose-500/30 bg-rose-500/5'
          : 'border-emerald-500/30 bg-emerald-500/5'
        }`}>
          <CardHeader className="pb-4 border-b border-border/50 flex flex-row items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className={`flex items-center gap-2 ${
                project.status === 'approved' ? 'text-indigo-700 dark:text-indigo-400'
                : project.status === 'rejected' ? 'text-rose-700 dark:text-rose-400'
                : 'text-emerald-700 dark:text-emerald-400'
              }`}>
                {project.status === 'approved' ? <ShieldCheck className="h-5 w-5" />
                  : project.status === 'rejected' ? <XCircle className="h-5 w-5" />
                  : <CheckCircle2 className="h-5 w-5" />}
                {project.status === 'approved' ? 'Approved Delivery Manifest'
                  : project.status === 'rejected' ? 'Delivery Manifest (Under Revision)'
                  : 'Delivery Manifest'}
              </CardTitle>
              <CardDescription>
                {project.status === 'approved' ? 'This delivery has been officially approved and locked.'
                  : project.status === 'rejected' ? 'Client requested revisions. Delivery details preserved below.'
                  : 'Final deliverables and summary of completed work pending review.'}
              </CardDescription>
            </div>
            
            {project.status === "completed" && (user?.role === "client" || user?.role === "admin") && (
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setRejectModalOpen(true)} className="border-destructive/20 text-destructive hover:bg-destructive/10">
                  <AlertCircle className="h-4 w-4 mr-2" /> {user?.role === "admin" ? "Request Internal Revision" : "Request Revision"}
                </Button>
                <Button size="sm" onClick={() => handleStatusChange("approved")} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
                  <ThumbsUp className="h-4 w-4 mr-2" /> Approve Project
                </Button>
              </div>
            )}
            
            {(user?.role === "admin" || user?.role === "staff") && (project.status === "completed" || project.status === "rejected") && (
              <Button variant="outline" size="sm" onClick={() => handleStatusChange("completed")} className="bg-background/50 hover:bg-background shrink-0 font-semibold">
                <Edit className="h-4 w-4 mr-2" /> {project.status === "rejected" ? "Update & Resubmit" : "Edit Output"}
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Work Summary</h4>
              <p className="text-sm whitespace-pre-wrap leading-relaxed max-w-4xl">{project.deliverables_summary || "Empty summary object."}</p>
            </div>
            
            {project.deliverables_links && project.deliverables_links.length > 0 && (
              <div className="space-y-3">
                 <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Important Linked Paths</h4>
                 <div className="flex flex-wrap gap-2">
                    {project.deliverables_links.map((link: string, i: number) => {
                      let hostname = link;
                      try { hostname = new URL(link).hostname } catch {}
                      return (
                        <a key={i} href={link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline bg-background border px-3 py-1.5 rounded-md shadow-sm transition-colors hover:border-primary/50">
                          <ExternalLink className="h-4 w-4" /> {hostname}
                        </a>
                      )
                    })}
                 </div>
              </div>
            )}

            {Array.isArray(project.deliverables_files) && project.deliverables_files.length > 0 && (
              <div className="space-y-3">
                 <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider block mb-4">Secure Vault Files</h4>
                 <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-thin scrollbar-thumb-muted-foreground/20">
                    {project.deliverables_files.map((file: any, index: number) => {
                       const isImage = file.type?.startsWith('image/');
                       return (
                         <div key={index} className="min-w-[280px] max-w-[320px] h-48 rounded-xl border border-border/50 bg-card overflow-hidden relative group snap-start shadow-sm hover:shadow-md transition-all shrink-0">
                           {isImage ? (
                             <img src={file.url} alt={file.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                           ) : (
                             <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-muted/10">
                               <FileText className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
                               <span className="text-sm font-semibold text-center truncate w-full px-2">{file.name}</span>
                             </div>
                           )}
                           <div className="absolute inset-x-0 bottom-0 bg-background/95 backdrop-blur-md p-3 flex justify-between items-center translate-y-full group-hover:translate-y-0 transition-transform duration-300 border-t border-border/50 shadow-inner">
                             <div className="flex items-center gap-2 overflow-hidden">
                               {isImage ? <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" /> : <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />}
                               <span className="text-xs truncate font-medium">{file.name}</span>
                             </div>
                             <div className="flex gap-1 shrink-0">
                               {(user?.role === "admin" || user?.role === "staff") && (
                                 <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => deleteCompletionFile(index)}>
                                   <Trash2 className="h-3 w-3" />
                                 </Button>
                               )}
                               <Button size="icon" variant="secondary" className="h-7 w-7" asChild>
                                 <a href={file.url} target="_blank" rel="noopener noreferrer"><Download className="h-3 w-3" /></a>
                               </Button>
                             </div>
                           </div>
                         </div>
                       )
                    })}
                 </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {project.client_feedback && (
        <Card className={`shadow-sm mt-6 mb-8 relative overflow-hidden animate-in slide-in-from-bottom-2 fade-in ${project.status === 'rejected' ? 'border-rose-500/30 bg-rose-500/5' : 'border-muted-foreground/20 bg-muted/5'}`}>
          <div className={`absolute right-0 top-0 bottom-0 w-2 ${project.status === 'rejected' ? 'bg-rose-500' : 'bg-muted-foreground/30'}`}></div>
          <CardHeader className={`pb-3 border-b ${project.status === 'rejected' ? 'border-rose-500/20' : 'border-border/50'}`}>
            <CardTitle className={`flex items-center gap-2 text-base font-bold ${project.status === 'rejected' ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}`}>
              {project.status === 'rejected' ? <XCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />} 
              {project.status === 'rejected' ? 'Revision Requested' : 'Feedback History'}
            </CardTitle>
            <CardDescription className={project.status === 'rejected' ? 'text-rose-500/80' : 'text-muted-foreground/70'}>
              {project.status === 'rejected' ? 'The delivery requires changes. Address the feedback below, then resubmit.' : 'Log of previous feedback and revision requests for this project.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-4">
              {project.client_feedback.split('\n\n---\n\n').map((fb: string, i: number) => (
                <div key={i} className={`p-4 rounded-lg bg-background border ${project.status === 'rejected' && i === 0 ? 'border-rose-500/30 shadow-sm' : 'border-border/50'}`}>
                  <p className="text-sm font-medium whitespace-pre-wrap leading-relaxed">{fb}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
        </TabsContent>

        <TabsContent value="tasks" className="outline-none mt-0 min-h-[500px]">
          <KanbanBoard projectId={projectId} userRole={user?.role || ""} staffList={assignedProfiles} onProgressUpdate={setTaskProgress} projectOverview={project?.details} projectDeliverables={project?.deliverables} />
        </TabsContent>
      </Tabs>

      {/* Identical Completion Editor for Modifications during Review cycle */}
      <Dialog open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deliverables</DialogTitle>
            <DialogDescription>
              Upload details of the deliverables for this project
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Work Summary <span className="text-destructive">*</span></Label>
              <textarea 
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Explicit chunk description..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Live URLs (Optional)</Label>
              <textarea 
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="https://..."
                value={completionLinks}
                onChange={(e) => setCompletionLinks(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Attach to Vault</Label>
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 relative">
                <Input type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => {
                  if (e.target.files) setCompletionFiles([...completionFiles, ...Array.from(e.target.files)])
                }} />
                <Upload className="h-8 w-8 mb-2 opacity-70" />
                <p className="text-sm font-medium">Click or drag elements appending live</p>
                {completionFiles.length > 0 && (
                  <div className="mt-4 w-full text-left z-20 relative space-y-2">
                    <p className="text-xs text-primary font-bold border-b pb-1">Queueing ({completionFiles.length})</p>
                    <div className="max-h-[120px] overflow-y-auto space-y-1.5 pr-2">
                      {completionFiles.map((f, i) => (
                        <div key={i} className="flex items-center justify-between bg-background p-1.5 rounded-md border text-xs shadow-sm">
                          <span className="truncate pr-2 font-medium">{f.name}</span>
                          <Button size="icon" variant="ghost" onClick={(e) => { e.preventDefault(); setCompletionFiles(prev => prev.filter((_, idx) => idx !== i)); }}>
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteModalOpen(false)} disabled={submitting}>Cancel</Button>
            <Button disabled={!completionNotes.trim() || submitting} onClick={submitCompletion}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Revisions</DialogTitle>
            <DialogDescription>
                Please clearly state your reasons and modification required. 
Ensure its within the scope of the project. 
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Details <span className="text-destructive">*</span></Label>
              <textarea 
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Declare failure parameters..."
                value={feedbackNotes}
                onChange={(e) => setFeedbackNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" disabled={!feedbackNotes.trim()} onClick={submitRejection}>Submit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Payment</DialogTitle>
            <DialogDescription>
              Record a new incoming payment for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Amount Received ($) <span className="text-destructive">*</span></Label>
              <Input 
                type="number" 
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="e.g. 500"
              />
            </div>
            <div className="space-y-2">
              <Label>Date of Payment</Label>
              <Input 
                type="date" 
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Internal Notes (Optional)</Label>
              <textarea 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Paid via Wire Transfer..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentModalOpen(false)} disabled={submittingPayment}>Cancel</Button>
            <Button disabled={!paymentAmount || isNaN(Number(paymentAmount)) || submittingPayment} onClick={submitPayment}>
              {submittingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
