/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, FolderKanban, Clock, CheckCircle2, Search, Filter, Activity, Calendar, ChevronDown, ListChecks, ShieldCheck, Loader2, Upload, Trash2 } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function ProjectsPage() {
  const { user } = useAuth()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [projectsState, setProjectsState] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [projectToComplete, setProjectToComplete] = useState<string | null>(null)
  const [completionNotes, setCompletionNotes] = useState("")
  const [completionLinks, setCompletionLinks] = useState("")
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)

  const fetchProjects = async () => {
    if (!user) return
    let query = supabase.from('projects').select(`
      *,
      client:profiles!projects_client_id_fkey(name),
      assignments:project_assignments(profiles(name))
    `).order('created_at', { ascending: false })

    if (user.role === 'client') {
      query = query.eq('client_id', user.id)
    }

    const { data } = await query

    if (data) {
      if (user.role === 'staff') {
        const { data: assignments } = await supabase.from('project_assignments').select('project_id').eq('user_id', user.id)
        const projectIds = assignments?.map(( a:any) => a.project_id) || []
        setProjectsState(data.filter((p:any) => projectIds.includes(p.id)))
      } else {
        setProjectsState(data)
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    let mounted = true
    if (user?.id) fetchProjects()
    return () => { mounted = false }
  }, [user?.id])

  const visibleProjects = projectsState.filter(p => p.title.toLowerCase().includes(searchQuery.toLowerCase()))

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    if (newStatus === "completed") {
      setProjectToComplete(projectId)
      setCompleteModalOpen(true)
      return
    }
    
    setProjectsState(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p))
    
    const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId)
    if (error) {
      toast.error("Failed to sync status")
      fetchProjects()
    } else {
      toast.success("Project status updated")
    }
  }

  const handleDelete = async (projectId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this project?")) return
    
    setProjectsState(prev => prev.filter(p => p.id !== projectId))
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    if (error) {
      toast.error("Failed to delete project")
      fetchProjects()
    } else {
      toast.success("Project tracking removed")
    }
  }

  const submitCompletion = async () => {
    if (!projectToComplete) return
    setSubmitting(true)

    const uploadedFilesData: {name: string, url: string, type: string, uploadedAt: string}[] = []
    for (const file of completionFiles) {
      const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`
      const { data, error } = await supabase.storage.from('deliverables_vault').upload(`projects/${projectToComplete}/${fileName}`, file)
      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage.from('deliverables_vault').getPublicUrl(data.path)
        uploadedFilesData.push({ name: file.name, url: publicUrl, type: file.type, uploadedAt: new Date().toISOString() })
      }
    }

    const compiledLinks = completionLinks.split('\n').map(l => l.trim()).filter(Boolean)

    const res = await fetch('/api/projects/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        projectId: projectToComplete,
        deliverables_summary: completionNotes,
        deliverables_links: compiledLinks,
        deliverables_files: uploadedFilesData,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error(err.error ?? 'Failed to complete project')
    } else {
      toast.success('Project validated and completed!')
      const completionPayload = {
        status: 'completed',
        deliverables_summary: completionNotes,
        deliverables_links: compiledLinks,
        deliverables_files: uploadedFilesData,
      }
      setProjectsState(prev => prev.map(p => p.id === projectToComplete ? { ...p, ...completionPayload } : p))
    }

    setSubmitting(false)
    setCompleteModalOpen(false)
    setProjectToComplete(null)
    setCompletionNotes('')
    setCompletionLinks('')
    setCompletionFiles([])
  }

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "approved": return <ShieldCheck className="h-4 w-4 text-indigo-500" />
      case "completed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case "active": return <Activity className="h-4 w-4 text-blue-500" />
      default: return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch(status) {
      case "approved": return "text-indigo-500 border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20"
      case "completed": return "text-emerald-500 border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20"
      case "active": return "text-blue-500 border-blue-500/20 bg-blue-500/10 hover:bg-blue-500/20"
      default: return "text-yellow-500 border-yellow-500/20 bg-yellow-500/10 hover:bg-yellow-500/20"
    }
  }

  const getAssignedStaffNames = (assignments: any[]) => {
    if (!assignments || assignments.length === 0) return "None"
    return assignments.map((a: any) => a.profiles?.name).filter(Boolean).join(", ")
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Projects Directory</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">View and manage all your agency projects.</p>
        </div>
        {(user?.role === "admin") && (
          <Button className="shadow-sm shadow-primary/20 w-full sm:w-auto" asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Link>
          </Button>
        )}
      </div>

      <Card className="shadow-sm border-border/50">
        <CardHeader className="py-4 border-b border-border/50 bg-card rounded-t-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
              <FolderKanban className="h-5 w-5 text-muted-foreground" />
              All Projects
            </CardTitle>
            <div className="flex w-full sm:w-auto gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search projects..."
                  className="w-full pl-9 bg-background/50 h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50">
                  <TableHead className="w-[250px] py-4 pl-6 text-sm">Project Title</TableHead>
                  <TableHead className="py-4 text-sm">Client</TableHead>
                  <TableHead className="py-4 text-sm">Status</TableHead>
                  <TableHead className="py-4 text-sm hidden md:table-cell">Assigned Staff</TableHead>
                  <TableHead className="py-4 text-sm hidden lg:table-cell">Deadline Tracker</TableHead>
                  <TableHead className="py-4 pr-6 text-right text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleProjects.length > 0 ? visibleProjects.map(project => {
                  const daysLeft = project.deadline ? Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 0
                  return (
                    <TableRow key={project.id} className="border-border/50 group hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium pl-6 py-4">
                        <div className="space-y-1">
                          <Link href={`/projects/${project.id}`} className="leading-tight flex items-center gap-2 group-hover:text-primary transition-colors text-base break-words">
                            {project.title}
                          </Link>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="text-sm font-medium text-foreground">
                          {project.client?.name || "Not provided"}
                        </span>
                      </TableCell>
                      <TableCell className="py-4">
                        {(user?.role === "admin" || user?.role === "staff") ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className={`h-8 w-[110px] justify-between px-2.5 ${getStatusColor(project.status)}`}>
                                <span className="flex items-center gap-1.5 capitalize text-xs">
                                  {getStatusIcon(project.status)}
                                  {project.status}
                                </span>
                                <ChevronDown className="h-3 w-3 opacity-70" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => handleStatusChange(project.id, "pending")} className="cursor-pointer font-medium">
                                <Clock className="mr-2 h-4 w-4 text-yellow-500" /> Pending
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(project.id, "active")} className="cursor-pointer font-medium">
                                <Activity className="mr-2 h-4 w-4 text-blue-500" /> Active
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(project.id, "completed")} className="cursor-pointer font-medium">
                                <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-500" /> Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(project.id, "approved")} className="cursor-pointer font-medium border-t">
                                <ShieldCheck className="mr-2 h-4 w-4 text-indigo-500" /> Approved
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <div className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold uppercase transition-colors gap-1.5 ${getStatusColor(project.status)}`}>
                            {getStatusIcon(project.status)}
                            {project.status}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-4 hidden md:table-cell">
                        <div className="text-sm text-muted-foreground whitespace-nowrap truncate max-w-[150px]">
                          {getAssignedStaffNames(project.assignments || [])}
                        </div>
                      </TableCell>
                      <TableCell className="py-4 hidden lg:table-cell">
                        {project.deadline ? (
                          <div className="flex items-center gap-2">
                            <Badge variant={daysLeft < 3 ? "destructive" : "secondary"} className="w-fit text-xs px-2 py-0.5 whitespace-nowrap">
                              {daysLeft < 0 ? "Overdue" : `${daysLeft} Days Left`}
                            </Badge>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 shadow-sm">
                              <ListChecks className="mr-2 h-4 w-4" />
                              <span className="hidden sm:inline-block">Options</span>
                              <ChevronDown className="ml-1 sm:ml-2 h-3 w-3 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem asChild>
                              <Link href={`/projects/${project.id}`}>View Details</Link>
                            </DropdownMenuItem>
                            {(user?.role === "admin") && (
                              <DropdownMenuItem asChild>
                                <Link href={`/projects/${project.id}/edit`}>Edit Project</Link>
                              </DropdownMenuItem>
                            )}
                            {user?.role === "admin" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => handleDelete(project.id)} className="text-destructive font-semibold cursor-pointer">
                                  Delete Project
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                }) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-base">
                      No projects found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      <Dialog open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Live Project</DialogTitle>
            <DialogDescription>
              Add a summary, delivery links, and any files when marking this project as complete.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Work Summary <span className="text-destructive">*</span></Label>
              <textarea 
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Describe what was completed and delivered..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Delivery Links (one per line, optional)</Label>
              <textarea 
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2"
                placeholder="https://..."
                value={completionLinks}
                onChange={(e) => setCompletionLinks(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Deliverable Files (optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 relative">
                <Input type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => {
                  if (e.target.files) setCompletionFiles([...completionFiles, ...Array.from(e.target.files)])
                }} />
                <Upload className="h-8 w-8 mb-2 opacity-70" />
                <p className="text-sm font-medium">Drag & drop files or click to browse</p>
                {completionFiles.length > 0 && (
                  <div className="mt-4 w-full space-y-2 text-left z-20 relative">
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
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Mark as Complete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
