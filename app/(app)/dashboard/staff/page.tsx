/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FolderKanban, Upload, FileText, Download, Calendar, Trash2, Loader2, Link as LinkIcon } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { DashboardSkeleton } from "@/components/ui/page-skeleton"

export default function StaffDashboard() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [assignedProjects, setAssignedProjects] = useState<any[]>([])

  // Dialog State Tracker
  const [completeModalOpen, setCompleteModalOpen] = useState(false)
  const [projectToComplete, setProjectToComplete] = useState<string | null>(null)
  const [completionNotes, setCompletionNotes] = useState("")
  const [completionLinks, setCompletionLinks] = useState("")
  const [completionFiles, setCompletionFiles] = useState<File[]>([])
  const [submitting, setSubmitting] = useState(false)
  
  const fetchProjects = useCallback(async () => {
    if (!user?.id) return
    try {
      const { data } = await supabase
        .from('project_assignments')
        .select(`
          project_id,
          projects (*, client:profiles!projects_client_id_fkey(name))
        `)
        .eq('user_id', user.id)

      if (data) {
        setAssignedProjects(data.map((d: any) => d.projects).filter(Boolean))
      }
    } catch (err) {
      console.error('Staff projects fetch error:', err)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const upcomingDeadlines = [...assignedProjects]
    .filter(p => p.status !== "completed")
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
    .slice(0, 5)

  const allFiles = assignedProjects.flatMap(p => {
    const files = Array.isArray(p.deliverables_files) ? p.deliverables_files : [];
    return files.map((f: any) => ({ ...f, projectTitle: p.title }));
  }).sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  .slice(0, 5)

  const getStatusBadge = (status: string) => {
    switch(status) {
      case "approved": return <Badge className="bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 border-indigo-500/20">Approved</Badge>
      case "completed": return <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">Completed</Badge>
      case "active": return <Badge className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20">Active</Badge>
      default: return <Badge className="bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 border-yellow-500/20">Pending</Badge>
    }
  }

  const handleStatusChange = async (projectId: string, newStatus: string) => {
    if (newStatus === "completed") {
      setProjectToComplete(projectId)
      setCompleteModalOpen(true)
      return
    }
    
    // Update local immediately
    setAssignedProjects(prev => prev.map(p => p.id === projectId ? { ...p, status: newStatus } : p))
    
    // Natively hit Supabase
    const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId)
    if (error) {
      toast.error("Failed to update status")
      fetchProjects() // Revert
    } else {
      toast.success("Project status updated")
    }
  }

  const submitCompletion = async () => {
    if (!projectToComplete) return
    setSubmitting(true)

    // Upload files to storage client-side (if any)
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

    // Use server-side API (bypasses RLS) so the update always succeeds
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
      toast.success('Project completed successfully!')
      const completionPayload = {
        status: 'completed' as const,
        deliverables_summary: completionNotes,
        deliverables_links: compiledLinks,
        deliverables_files: uploadedFilesData,
      }
      setAssignedProjects(prev => prev.map(p => p.id === projectToComplete ? { ...p, ...completionPayload } : p))
    }

    setSubmitting(false)
    setCompleteModalOpen(false)
    setProjectToComplete(null)
    setCompletionNotes('')
    setCompletionLinks('')
    setCompletionFiles([])
  }

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff Workspace</h1>
        <p className="text-muted-foreground mt-1">Manage your native Supabase project assignments.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Module 1/3: Assigned Projects */}
        <Card className="md:col-span-2 shadow-sm border-border/50">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>My Projects</CardTitle>
              <CardDescription>Projects natively tracking against your Profile ID</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {assignedProjects.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Deadline</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignedProjects.map(project => (
                    <TableRow key={project.id} className="border-border/50">
                      <TableCell className="font-medium">{project.title}</TableCell>
                      <TableCell className="text-muted-foreground">{project.client?.name || 'Not provided'}</TableCell>
                      <TableCell>
                        {project.deadline ? (
                          <span className="flex items-center whitespace-nowrap text-xs font-medium">
                            <Calendar className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                            {new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {project.status === "approved" ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border border-indigo-500/20 bg-indigo-500/10 text-indigo-500 capitalize">
                            {project.status}
                          </span>
                        ) : (
                          <Select value={project.status} onValueChange={(val) => handleStatusChange(project.id, val)}>
                            <SelectTrigger className="w-[125px] h-8 text-xs font-medium capitalize">
                              {project.status}
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <FolderKanban className="mx-auto h-8 w-8 opacity-50 mb-2" />
                <p>No relational projects assigned yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Deadlines & Live Shared Files */}
        <div className="space-y-4 md:col-span-1">
          <Card className="shadow-sm border-border/50">
            <CardHeader>
              <CardTitle>Upcoming Deadlines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingDeadlines.length > 0 ? upcomingDeadlines.map(project => {
                  const daysLeft = project.deadline ? Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 0
                  return (
                    <div key={project.id} className="flex items-center justify-between border-b border-border/50 pb-3 last:border-0 last:pb-0">
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none">{project.title}</p>
                        <div className="flex items-center mt-1">
                          {getStatusBadge(project.status)}
                        </div>
                      </div>
                      {(project.status === "approved" || project.status === "completed") ? (
                        <Badge className="whitespace-nowrap ml-2 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20">
                          Completed
                        </Badge>
                      ) : project.deadline ? (
                        <Badge variant={daysLeft < 3 ? "destructive" : "secondary"} className="whitespace-nowrap ml-2">
                          {daysLeft < 0 ? "Overdue" : `${daysLeft} days`}
                        </Badge>
                      ) : null}
                    </div>
                  )
                }) : (
                  <p className="text-muted-foreground text-sm text-center py-4">No tight deadlines parsed</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <div className="space-y-1">
                <CardTitle>Recent Vault Drops</CardTitle>
              </div>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled>
                <FileText className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 mt-4">
                {allFiles.length > 0 ? allFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-3 border bg-muted/30 p-2 rounded-md">
                    <div className="p-2 bg-primary/10 rounded">
                      {file.type?.includes('image') ? <FileText className="h-4 w-4 text-primary" /> : <LinkIcon className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="flex-1 space-y-1 overflow-hidden">
                      <p className="text-sm font-medium leading-none truncate">{file.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{file.projectTitle}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" asChild>
                      <a href={file.url} target="_blank" rel="noopener noreferrer">
                        <Download className="h-3 w-3" />
                      </a>
                    </Button>
                  </div>
                )) : (
                  <p className="text-muted-foreground text-sm text-center py-4">Vault empty</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reused Exact Structural Delivery Form */}
      <Dialog open={completeModalOpen} onOpenChange={setCompleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Project</DialogTitle>
            <DialogDescription>
              Enter project completion detailes, attached photos where neccessary  
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Work Summary <span className="text-destructive">*</span></Label>
              <textarea 
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Database summary entry..."
                value={completionNotes}
                onChange={(e) => setCompletionNotes(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Important URLs (Optional)</Label>
              <textarea 
                className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="https://... (one per line)"
                value={completionLinks}
                onChange={(e) => setCompletionLinks(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Final Deliverables (Optional)</Label>
              <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 relative">
                <Input type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" onChange={(e) => {
                  if (e.target.files) setCompletionFiles([...completionFiles, ...Array.from(e.target.files)])
                }} />
                <Upload className="h-8 w-8 mb-2 opacity-70" />
                <p className="text-sm font-medium">Click or drag photos</p>
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
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
