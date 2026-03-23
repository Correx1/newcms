/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { ArrowLeft, Save, DollarSign, Building2, User, Activity, Calendar, FileText, Text, Loader2, Trash2 } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export default function EditProjectPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string
  const supabase = createClient()
  
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [project, setProject] = useState<any>(null)
  const [clients, setClients] = useState<any[]>([])
  const [staffPool, setStaffPool] = useState<any[]>([])
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [clientId, setClientId] = useState<string>("")
  const [status, setStatus] = useState<string>("pending")
  const [title, setTitle] = useState("")
  const [details, setDetails] = useState("")
  const [deliverables, setDeliverables] = useState("")
  const [deadline, setDeadline] = useState("")
  const [price, setPrice] = useState("")
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const fetchDependencies = async () => {
    // Parallel Fetching
    const [prjRes, cliRes, staffRes] = await Promise.all([
      supabase.from('projects').select('*, assignments:project_assignments(user_id)').eq('id', projectId).single(),
      fetch('/api/admin/profiles?role=client', { credentials: 'include', cache: 'no-store' }),
      fetch('/api/admin/profiles?roles=admin,staff', { credentials: 'include', cache: 'no-store' })
    ])

    if (prjRes.data) {
      const p = prjRes.data
      setProject(p)
      setTitle(p.title || "")
      setDetails(p.details || "")
      setDeliverables(p.deliverables || "")
      setDeadline(p.deadline ? p.deadline.split('T')[0] : "")
      setPrice(p.price || "")
      setStatus(p.status || "pending")
      setClientId(p.client_id || "")
      setSelectedStaffIds(p.assignments?.map((a: any) => a.user_id) || [])
    }
    const cliData = cliRes.ok ? await cliRes.json() : { profiles: [] }
    const staffData = staffRes.ok ? await staffRes.json() : { profiles: [] }
    setClients(cliData.profiles || [])
    setStaffPool(staffData.profiles || [])
    setLoadingInitial(false)
  }

  useEffect(() => {
    let mounted = true
    if (user?.id) fetchDependencies()
    return () => { mounted = false }
  }, [user?.id, projectId])

  const handleStaffToggle = (staffId: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    )
  }

  const deleteProjectFile = async (idxFile: number) => {
    if (!window.confirm("Remove this file?")) return
    const newFiles = [...(project.files || [])]
    newFiles.splice(idxFile, 1)
    
    setProject({ ...project, files: newFiles })
    const { error } = await supabase.from('projects').update({ files: newFiles }).eq('id', project.id)
    if (error) {
      toast.error("Failed to remove file")
      fetchDependencies()
    } else {
      toast.success("File removed")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) {
      toast.error("Please select a client.")
      return
    }

    setSubmitting(true)

    // Upload Files Tracking into Bucket inherently mapping JSON URLs natively
    const uploadedFilesData = []
    if (selectedFiles.length > 0) {
      for (const file of selectedFiles) {
        const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        const { data, error } = await supabase.storage.from('deliverables_vault').upload(`projects/${projectId}/${fileName}`, file)
        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage.from('deliverables_vault').getPublicUrl(data.path)
          uploadedFilesData.push({ id: `int-${Date.now()}`, name: file.name, url: publicUrl, type: file.type, uploadedAt: new Date().toISOString() })
        }
      }
    }
    
    const combinedFiles = [...(project.files || []), ...uploadedFilesData]

    const projectPayload = {
      title,
      details,
      deliverables,
      deadline: deadline || null,
      price: price || null,
      status,
      client_id: clientId,
      files: combinedFiles
    }

    const { error: updateError } = await supabase.from('projects').update(projectPayload).eq('id', projectId)

    if (updateError) {
      toast.error("Failed to update project. Please try again.")
      setSubmitting(false)
      return
    }

    // Explicit Mapping for Staff Assignments - Destructive Merge Strategy
    await supabase.from('project_assignments').delete().eq('project_id', projectId)
    
    if (selectedStaffIds.length > 0) {
      const bridgeInserts = selectedStaffIds.map(staffId => ({
        project_id: projectId,
        user_id: staffId
      }))
      await supabase.from('project_assignments').insert(bridgeInserts)
    }

    toast.success("Project updated successfully!")
    router.push(`/projects/${projectId}`)
  }

  if (user?.role === "client") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground mt-2">Only admins and staff can edit projects.</p>
        <Button className="mt-6 shadow-sm" onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  if (loadingInitial || !project) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" className="h-9 w-9 shadow-sm" asChild>
          <Link href={`/projects/${project.id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Edit Project</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Editing: {project.title}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
              <CardTitle className="text-lg">Project Details</CardTitle>
              <CardDescription>Update the core information for this project.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-2.5">
                <Label htmlFor="title" className="text-sm font-semibold">Project Title</Label>
                <Input 
                  id="title" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required 
                  className="h-11 bg-background text-base shadow-sm focus-visible:ring-1" 
                />
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="details" className="text-sm font-semibold flex items-center gap-2">
                  <Text className="h-4 w-4 text-muted-foreground" /> Description
                </Label>
                <textarea 
                  id="details" 
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-1 shadow-sm"
                  required
                />
              </div>

              <div className="space-y-2.5 border-t border-border/50 pt-6 mt-2">
                <Label htmlFor="deliverables" className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" /> Deliverables
                </Label>
                <textarea 
                  id="deliverables" 
                  value={deliverables}
                  onChange={e => setDeliverables(e.target.value)}
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-1 shadow-sm font-mono"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50 overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
              <CardTitle className="text-lg text-primary">File Attachments</CardTitle>
              <CardDescription className="text-primary/70">Manage files attached to this project.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              
              {project.files && project.files.length > 0 && (
                <div className="mb-6 space-y-3">
                  <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">Existing Files</span>
                  {project.files.map((f: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 border border-border/50 rounded-lg bg-background shadow-sm">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-bold truncate leading-none">{f.name}</span>
                      </div>
                      <Button variant="ghost" size="icon" type="button" className="h-8 w-8 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => deleteProjectFile(i)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-2 border-dashed border-border/60 rounded-xl p-6 text-center bg-background/50 hover:bg-muted/50 transition-colors">
                <Input 
                  id="files" 
                  type="file" 
                  multiple 
                  className="hidden" 
                  onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                />
                <Button variant="secondary" type="button" onClick={() => document.getElementById('files')?.click()} className="mb-2 shadow-sm border">
                  Upload Files
                </Button>
                <p className="text-sm text-muted-foreground mt-2">Click to select files to upload or drag & drop here</p>
              </div>

              {selectedFiles.length > 0 && (
                <div className="mt-4 space-y-2 border-t border-border/50 pt-4">
                  <span className="text-xs uppercase font-bold text-muted-foreground tracking-wider">
                    Files to upload ({selectedFiles.length})
                  </span>
                  {selectedFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border border-border/50 rounded-lg bg-background shadow-sm">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold truncate leading-none">{file.name}</span>
                        <span className="text-[11px] text-muted-foreground mt-1 leading-none font-medium">{(file.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/20 border-b border-border/50 pb-4">
              <CardTitle className="text-lg">Project Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              
              <div className="space-y-2.5">
                <Label htmlFor="client" className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" /> Client
                </Label>
                <Select required value={clientId} onValueChange={(val) => setClientId(val || "")}>
                  <SelectTrigger className="min-h-[44px] h-auto py-2 bg-background transition-colors focus:ring-1 shadow-sm [&>span]:whitespace-normal [&>span]:text-left [&>span]:break-words">
                    {clientId ? clients.find(c => c.id === clientId)?.company || clients.find(c => c.id === clientId)?.name : <span className="text-muted-foreground">Select a client...</span>}
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id} className="cursor-pointer py-2.5 font-bold">
                        {c.company || c.name} <span className="text-muted-foreground font-medium ml-1">({c.name})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" /> Assigned Staff
                </Label>
                <div className="space-y-2 p-3 border border-border/50 rounded-md bg-background shadow-sm max-h-[220px] overflow-y-auto">
                  {staffPool.map(s => (
                    <div key={s.id} className="flex items-start space-x-3 bg-muted/20 p-2.5 rounded-md hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50 cursor-pointer" onClick={() => handleStaffToggle(s.id)}>
                      <input 
                        type="checkbox" 
                        checked={selectedStaffIds.includes(s.id)}
                        readOnly
                        className="h-4 w-4 mt-0.5 rounded border-border text-primary focus:ring-1 focus:ring-primary accent-primary cursor-pointer" 
                      />
                      <Label className="flex items-start gap-3 cursor-pointer w-full">
                        <div className="h-8 w-8 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-[11px] font-bold shrink-0">
                          {s.name.charAt(0)}
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-bold leading-none">{s.name}</span>
                          <span className="text-muted-foreground text-xs leading-none font-medium capitalize">
                            {s.role}
                          </span>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-border/50 my-3"></div>

              <div className="space-y-2.5">
                <Label htmlFor="status" className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" /> Status
                </Label>
                <Select value={status} onValueChange={(val) => setStatus(val || "pending")} required>
                  <SelectTrigger className="h-11 bg-background transition-colors focus:ring-1 shadow-sm font-semibold">
                    <span className="capitalize">{status}</span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending" className="cursor-pointer py-2 font-medium">Pending</SelectItem>
                    <SelectItem value="active" className="cursor-pointer py-2 font-medium">Active</SelectItem>
                    <SelectItem value="completed" className="cursor-pointer py-2 font-medium">Completed</SelectItem>
                    <SelectItem value="approved" className="cursor-pointer py-2 font-medium">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="deadline" className="text-sm font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" /> Deadline
                </Label>
                <Input 
                  id="deadline" 
                  type="date" 
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  className="h-11 bg-background shadow-sm font-medium" 
                />
              </div>

              <div className="space-y-2.5">
                <Label htmlFor="price" className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-500" /> Project Value
                </Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-muted-foreground/70 font-semibold">$</span>
                  <Input 
                    id="price" 
                    type="text" 
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="25,000" 
                    className="h-11 pl-7 bg-background shadow-sm font-bold" 
                  />
                </div>
              </div>

            </CardContent>
            <CardFooter className="bg-muted/10 border-t border-border/50 p-4 rounded-b-xl flex flex-col sm:flex-row gap-3">
              <Button type="submit" size="lg" className="w-full sm:flex-1 shadow-md font-bold" disabled={submitting}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
              </Button>
              <Button variant="outline" size="lg" type="button" asChild className="w-full sm:w-auto bg-background" disabled={submitting}>
                <Link href={`/projects/${project.id}`}>Cancel</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </form>
    </div>
  )
}
