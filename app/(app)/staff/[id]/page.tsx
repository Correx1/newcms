/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Mail, Shield, CheckCircle2, FolderKanban, Briefcase } from "lucide-react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { DetailSkeleton } from "@/components/ui/page-skeleton"

export default function StaffProfilePage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const staffId = params?.id as string
  
  const [loading, setLoading] = useState(true)
  const [staff, setStaff] = useState<any>(null)
  
  useEffect(() => {
    let mounted = true
    const fetchStaffDetails = async () => {
      try {
        const res = await fetch(`/api/admin/profiles/${staffId}`, {
          credentials: 'include',
          cache: 'no-store'
        })
        
        if (res.ok) {
          const json = await res.json()
          if (mounted && json.profile) {
            setStaff(json.profile)
          }
        }
      } catch (err) {
        console.error("Failed to fetch staff details:", err)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    if (user?.id) fetchStaffDetails()
    return () => { mounted = false }
  }, [user?.id, staffId])

  if (loading) return <DetailSkeleton />

  if (!staff) {
    return <div className="p-8 text-center text-muted-foreground font-semibold">Staff profile not found.</div>
  }

  const allProjects = staff.assignments?.map((a: any) => a.projects).filter(Boolean) || []
  const assignedProjects = allProjects.filter((p: any) => p.status !== "completed")
  const completedProjects = allProjects.filter((p: any) => p.status === "completed")

  const jobTitle = staff.job_title || (staff.role === "admin" ? "Admin" : "Staff")

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Route Back</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Staff Profile</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base font-medium">View details and assigned projects for this staff member.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="h-24 w-24 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-3xl ring-4 ring-primary/5 shadow-sm mb-4 border border-primary/20">
                {staff.name ? staff.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2) : "UN"}
              </div>
              <h2 className="text-xl font-bold">{staff.name || "Default Operator"}</h2>
              <p className="text-muted-foreground font-semibold flex items-center gap-1.5 mt-1 text-sm">
                <Briefcase className="h-4 w-4 text-primary/80" /> {jobTitle}
              </p>
              
              <div className="w-full border-t border-border/50 mt-6 pt-6 space-y-4 text-left">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Email</span>
                  <div className="flex items-center text-sm font-semibold truncate">
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                    {staff.email}
                  </div>
                </div>
                <div className="space-y-1 pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Role</span>
                  <div className="flex items-center mt-1">
                    <Badge variant={staff.role === "admin" ? "default" : "secondary"} className="capitalize tracking-wider text-[11px] px-2 py-0.5 shadow-sm font-bold">
                      <Shield className="mr-1.5 h-3 w-3" />
                      {staff.role}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderKanban className="h-5 w-5 text-primary" /> Active Projects
              </CardTitle>
              <CardDescription className="font-medium text-sm">Projects currently assigned to {staff.name}.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {assignedProjects.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {assignedProjects.map((p: any) => (
                    <Link key={p.id} href={`/projects/${p.id}`} className="block">
                      <div className="border border-border/50 rounded-lg p-3 hover:bg-muted/30 transition-colors shadow-sm bg-background group h-full flex flex-col justify-between">
                        <div className="font-bold group-hover:text-primary transition-colors text-base">{p.title}</div>
                        <div className="text-xs text-muted-foreground mt-2 flex items-center justify-between font-semibold">
                          <span>Limit: {p.deadline ? p.deadline.split('T')[0] : "None"}</span>
                          <Badge variant="outline" className="capitalize text-[10px] bg-background">{p.status}</Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-lg bg-muted/10 border-border/50">
                  <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-20 text-muted-foreground" />
                  <p className="text-sm font-semibold text-muted-foreground">No active projects assigned</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50 opacity-90 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/50"></div>
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/5">
              <CardTitle className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-lg">
                <CheckCircle2 className="h-5 w-5" /> Completed Projects
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {completedProjects.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {completedProjects.map((p: any) => (
                    <Link key={p.id} href={`/projects/${p.id}`} className="block">
                      <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg p-3 hover:bg-emerald-500/10 transition-colors h-full flex flex-col justify-between">
                        <div className="font-bold text-emerald-700 dark:text-emerald-300">{p.title}</div>
                        <div className="text-xs font-semibold text-emerald-600/70 dark:text-emerald-400/70 mt-2">Executed completely</div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic font-medium">No completed projects yet.</p>
              )}
            </CardContent>
          </Card>
          
        </div>
      </div>
    </div>
  )
}
