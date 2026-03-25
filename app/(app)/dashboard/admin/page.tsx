/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Users, FolderKanban, CheckCircle2, Clock, Calendar, Activity, ExternalLink, Loader2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { DashboardSkeleton } from "@/components/ui/page-skeleton"

export default function AdminDashboard() {

  const [loading, setLoading] = useState(true)
  const [totalProjects, setTotalProjects] = useState(0)
  const [activeProjects, setActiveProjects] = useState(0)
  const [completedProjects, setCompletedProjects] = useState(0)
  const [totalClients, setTotalClients] = useState(0)
  const [sortedProjects, setSortedProjects] = useState<any[]>([])

  useEffect(() => {
    let mounted = true
    async function fetchData() {
      try {
        // Use service-role API routes so admin sees all data regardless of DB role setting
        const [profilesRes, projectsRes] = await Promise.all([
          fetch('/api/admin/profiles?role=client', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/admin/projects?limit=10', { credentials: 'include', cache: 'no-store' }),
        ])

        const profilesJson = profilesRes.ok ? await profilesRes.json() : { profiles: [] }
        const projectsJson = projectsRes.ok ? await projectsRes.json() : { projects: [] }

        const allProjects: any[] = projectsJson.projects ?? []
        const clients: any[] = profilesJson.profiles ?? []

        if (mounted) {
          setTotalClients(clients.length)
          setTotalProjects(allProjects.length)
          setActiveProjects(allProjects.filter(p => p.status === 'active').length)
          setCompletedProjects(allProjects.filter(p => p.status === 'completed' || p.status === 'approved').length)
          setSortedProjects(allProjects.slice(0, 10))
        }
      } catch (err) {
        console.error("Dashboard fetch error:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [])

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "completed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case "approved": return <CheckCircle2 className="h-4 w-4 text-indigo-500" />
      case "active": return <Activity className="h-4 w-4 text-blue-500" />
      default: return <Clock className="h-4 w-4 text-yellow-500" />
    }
  }

  const getAssignedStaffNames = (assignments: any[]) => {
    if (!assignments || assignments.length === 0) return "None"
    return assignments.map((a: any) => a.profiles?.name).filter(Boolean).join(", ")
  }

  if (loading) return <DashboardSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Admin Overview</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Here is what is happening with your agency today.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          <Button variant="outline" className="shadow-sm flex-1 sm:flex-none" asChild>
            <Link href="/clients/new">
              <Users className="mr-2 h-4 w-4" /> Add Client
            </Link>
          </Button>
          <Button className="shadow-sm shadow-primary/20 flex-1 sm:flex-none" asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Link>
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
           <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card className="shadow-sm hover:shadow-md transition-all border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                <FolderKanban className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{totalProjects}</div>
                <p className="text-xs text-muted-foreground mt-1">Across all clients</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-all border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
                <Activity className="h-4 w-4 text-blue-500 hidden sm:block" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{activeProjects}</div>
                <p className="text-xs text-muted-foreground mt-1">Currently in progress</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-all border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-emerald-500 hidden sm:block" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{completedProjects}</div>
                <p className="text-xs text-muted-foreground mt-1">Successfully delivered</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm hover:shadow-md transition-all border-border/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </CardHeader>
              <CardContent>
                <div className="text-xl md:text-2xl font-bold">{totalClients}</div>
                <p className="text-xs text-muted-foreground mt-1">Active client accounts</p>
              </CardContent>
            </Card>
          </div>

          {/* Priority Project Tracking Table */}
          <Card className="shadow-sm border-border/50">
            <CardHeader className="border-b border-border/50 bg-muted/20">
              <CardTitle className="text-xl font-bold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" /> Active Project Priorities
              </CardTitle>
              <CardDescription className="text-base">All projects sorted by approaching deadlines</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="pl-6 w-[250px] py-4 text-sm">Project & Client</TableHead>
                      <TableHead className="py-4 text-sm">Status</TableHead>
                      <TableHead className="py-4 text-sm hidden md:table-cell">Assigned Staff</TableHead>
                      <TableHead className="py-4 text-sm">Deadline Tracker</TableHead>
                      <TableHead className="pr-6 text-right py-4 text-sm">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedProjects.length > 0 ? sortedProjects.map(project => {
                      const daysLeft = project.deadline ? Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : 0
                      
                      return (
                        <TableRow key={project.id} className="group hover:bg-muted/30 transition-colors">
                          <TableCell className="pl-6 py-4">
                            <div className="space-y-1 content-center">
                              <p className="font-semibold text-base leading-snug">{project.title}</p>
                              <p className="text-sm text-primary font-medium">{project.client?.name || 'Unknown'}</p>
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              {getStatusIcon(project.status)}
                              <span className="capitalize font-medium text-sm">{project.status}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-4 hidden md:table-cell">
                            <div className="text-sm text-muted-foreground whitespace-nowrap truncate max-w-[200px]">
                              {getAssignedStaffNames(project.project_assignments || [])}
                            </div>
                          </TableCell>
                          <TableCell className="py-4">
                            {(project.status === "approved" || project.status === "completed") ? (
                              <Badge className="w-fit text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20">
                                Completed
                              </Badge>
                            ) : project.deadline ? (
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                                <Badge variant={daysLeft < 3 ? "destructive" : "secondary"} className="w-fit text-xs px-2 py-0.5">
                                  {daysLeft < 0 ? "Overdue" : `${daysLeft} Days Left`}
                                </Badge>
                                <span className="text-sm font-medium text-muted-foreground hidden lg:inline-block">
                                  ({new Date(project.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })})
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No deadline</span>
                            )}
                          </TableCell>
                          <TableCell className="pr-6 py-4 text-right">
                            <Button variant="ghost" size="sm" className="font-medium h-9 px-3" asChild>
                              <Link href={`/projects/${project.id}`}>
                                View <ExternalLink className="ml-2 h-4 w-4" />
                              </Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    }) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-base">
                          No active projects found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
