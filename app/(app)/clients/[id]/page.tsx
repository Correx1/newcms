/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, Building2, Mail, Phone, FolderKanban, CheckCircle2, Clock, Activity } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { DetailSkeleton } from "@/components/ui/page-skeleton"

export default function ClientProfilePage() {
  const params = useParams()
  const router = useRouter()
  const clientId = params?.id as string
  
  const [loading, setLoading] = useState(true)
  const [clientProfile, setClientProfile] = useState<any>(null)

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Exit Client Vector</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{clientProfile.name || "Unknown Identity"}</h1>
            <p className="text-muted-foreground mt-1 text-sm font-semibold">Client Profile</p>
          </div>
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
    </div>
  )
}
