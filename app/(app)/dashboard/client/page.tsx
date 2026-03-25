/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FolderKanban, Clock, Calendar, FileText, Download, CheckCircle2, Activity, ArrowRight } from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { DashboardSkeleton } from "@/components/ui/page-skeleton"

export default function ClientDashboard() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [clientProjects, setClientProjects] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    async function fetchClientProjects() {
      if (!user) return
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false })

        if (error) throw error

        if (mounted && data) {
          setClientProjects(data)
        }
      } catch (err) {
        console.error("Client dashboard fetch error:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchClientProjects()
    return () => { mounted = false }
  }, [user?.id, supabase])
  
  // All files securely pulled natively tracing JSON Arrays
  const allFiles = clientProjects.flatMap(p => {
    const files = Array.isArray(p.deliverables_files) ? p.deliverables_files : [];
    return files.map((f: any) => ({ ...f, projectTitle: p.title }))
  }).sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  .slice(0, 5)

  const featuredProject = clientProjects.find(p => p.status === "active") 
    || clientProjects.find(p => p.status === "pending")
    || clientProjects[0]

  const getStatusColor = (status: string) => {
    switch(status) {
      case "completed": return "text-emerald-500 border-emerald-500 bg-emerald-500/10"
      case "approved": return "text-indigo-500 border-indigo-500 bg-indigo-500/10"
      case "active": return "text-blue-500 border-blue-500 bg-blue-500/10"
      default: return "text-yellow-500 border-yellow-500 bg-yellow-500/10"
    }
  }

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Client Portal</h1>
        <p className="text-muted-foreground mt-1">Ready for your review. Live Sync directly via secure Edge pipelines.</p>
      </div>

      {clientProjects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2 bg-muted/10">
          <div className="bg-primary/10 p-4 rounded-full mb-4">
            <FolderKanban className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">No active projects</h2>
          <p className="text-muted-foreground mt-2 max-w-sm">
            We are configuring your Dashboard nodes. Contact your account manager for native queries.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          
          <div className="space-y-6 md:col-span-2">
            {featuredProject && (
              <Card className="shadow-sm border-border/50 overflow-hidden bg-linear-to-br from-background to-muted/20 relative">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                  <FolderKanban className="h-32 w-32" />
                </div>
                <CardHeader>
                  <div className="flex justify-between items-start z-10 relative">
                    <div>
                      <CardTitle className="text-xl">{featuredProject.title}</CardTitle>
                      {featuredProject.deadline && (
                        <CardDescription className="mt-1.5 flex items-center gap-2 font-medium">
                          <Calendar className="h-3.5 w-3.5" /> 
                          Due {new Date(featuredProject.deadline).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </CardDescription>
                      )}
                    </div>
                    <Badge variant="outline" className={`capitalize px-3 py-1 font-semibold ${getStatusColor(featuredProject.status)}`}>
                      {featuredProject.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="mt-4 relative">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-secondary -translate-y-1/2 rounded-full hidden sm:block"></div>
                    
                    <div 
                      className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 rounded-full hidden sm:block transition-all duration-1000" 
                      style={{ 
                        width: (featuredProject.status === "completed" || featuredProject.status === "approved") ? "100%" : 
                               featuredProject.status === "active" ? "50%" : "0%" 
                      }}
                    ></div>

                    <div className="relative z-10 flex flex-col sm:flex-row justify-between gap-4 sm:gap-0">
                      <div className="flex sm:flex-col items-center gap-3 sm:gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-card
                          ${(featuredProject.status === "pending" || featuredProject.status === "active" || featuredProject.status === "completed" || featuredProject.status === "approved") 
                            ? "border-primary text-primary" : "border-muted text-muted-foreground"}`}
                        >
                          <Clock className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">Scoping</span>
                      </div>

                      <div className="flex sm:flex-col items-center gap-3 sm:gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-card
                          ${(featuredProject.status === "active" || featuredProject.status === "completed" || featuredProject.status === "approved") 
                            ? "border-primary text-primary" : "border-muted text-muted-foreground"}`}
                        >
                          <Activity className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">Development</span>
                      </div>

                      <div className="flex sm:flex-col items-center gap-3 sm:gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 bg-card
                          ${(featuredProject.status === "completed" || featuredProject.status === "approved") 
                            ? "border-primary text-primary" : "border-muted text-muted-foreground"}`}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium">Delivered</span>
                      </div>
                    </div>
                  </div>

                  {featuredProject.deliverables_summary && (
                    <div className="mt-8 p-4 bg-muted/30 rounded-lg border border-border/50">
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-primary" /> Delivery Payload Readout
                      </h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">
                        {featuredProject.deliverables_summary}
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-2 z-10 relative">
                  <Button variant="outline" className="w-full bg-background/50 hover:bg-background" asChild>
                    <Link href={`/projects/${featuredProject.id}`}>
                      View Explicit Details & Review <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            )}

            <Card className="shadow-sm border-border/50">
              <CardHeader>
                <CardTitle>My Projects</CardTitle>
                <CardDescription>All my projects </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <div className="overflow-x-auto w-full">
                  <Table className="min-w-[500px]">
                    <TableHeader>
                      <TableRow className="border-border/50">
                        <TableHead>Project Title</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientProjects.map(project => (
                        <TableRow key={project.id} className="border-border/50">
                          <TableCell className="font-medium">{project.title}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={`capitalize ${getStatusColor(project.status).split(' ')[0]} bg-transparent`}>
                              {project.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm font-medium">
                            {project.deadline ? new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No strict deadline'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/projects/${project.id}`}>View</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6 md:col-span-1">
            <Card className="shadow-sm border-border/50 h-full max-h-[600px] flex flex-col">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-lg">Delivery Vault</CardTitle>
                <CardDescription className="text-xs">All files attached to your projects</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto pt-4">
                <div className="space-y-3">
                  {allFiles.length > 0 ? allFiles.map((file, idx) => (
                    <div key={idx} className="group relative flex flex-col gap-2 border border-border/50 bg-card p-3 rounded-lg hover:border-primary/50 transition-colors shadow-sm">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 overflow-hidden">
                          <div className="p-2 bg-primary/10 rounded-md text-primary shrink-0">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="space-y-1 min-w-0">
                            <p className="text-sm font-semibold leading-none truncate pr-4">{file.name}</p>
                            <p className="text-[11px] font-medium text-muted-foreground truncate">{file.projectTitle}</p>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity bg-background border" asChild>
                          <a href={file.url} target="_blank" rel="noopener noreferrer">
                             <Download className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                      <div className="text-[10px] text-muted-foreground text-right font-medium">
                        {new Date(file.uploadedAt).toLocaleString()}
                      </div>
                    </div>
                  )) : (
                    <div className="text-center py-10 opacity-60">
                      <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
                      <p className="text-sm font-medium">Vault Secure</p>
                      <p className="text-xs mt-1 text-muted-foreground">Files deployed during scope completions load securely here automatically natively.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      )}
    </div>
  )
}
