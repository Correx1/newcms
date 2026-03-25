/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, UserCog, Search, ChevronDown, ListChecks, Edit, User, Loader2, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function StaffPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [staffList, setStaffList] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  
  const [editStaff, setEditStaff] = useState<any | null>(null)
  const [editFormData, setEditFormData] = useState({ name: "", email: "", role: "", job_title: "" })
  const [editing, setEditing] = useState(false)

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/profiles?roles=admin,staff', {
        credentials: 'include',
        cache: 'no-store'
      })
      if (res.ok) {
        const json = await res.json()
        const formatted = (json.profiles ?? []).map((s: any) => {
          const validProjects = s.assignments
            ?.map((a: any) => a.projects)
            .filter(Boolean) || []
          return {
            ...s,
            assignedTasks: validProjects.filter((p: any) => p.status !== 'completed' && p.status !== 'approved'),
            completedTasks: validProjects.filter((p: any) => p.status === 'completed' || p.status === 'approved')
          }
        })
        setStaffList(formatted)
      }
    } catch (err) {
      console.error("Fetch staff error:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === "admin") fetchStaff()
  }, [user?.role, fetchStaff])

  const visibleStaff = staffList.filter(s => 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.role?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (user?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] text-center">
        <h2 className="text-2xl font-bold">Access Restricted</h2>
        <p className="text-muted-foreground mt-2">Only administrators can view and manage staff members.</p>
        <Button className="mt-6" onClick={() => router.back()}>Cancel Operation</Button>
      </div>
    )
  }

  const handleDeleteStaff = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) return
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
    })
    
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({}))
      toast.error(error || "Failed to delete staff member")
      console.error("Delete staff error:", error)
    } else {
      toast.success("Staff member deleted successfully")
      setStaffList(prev => prev.filter(s => s.id !== id))
    }
  }

  const handleOpenEdit = (staff: any) => {
    setEditStaff(staff)
    setEditFormData({ 
      name: staff.name || "", 
      email: staff.email || "", 
      role: staff.role || "staff",
      job_title: staff.job_title || ""
    })
  }

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editStaff) return
    setEditing(true)

    const payload = {
      name: editFormData.name,
      role: editFormData.role,
      job_title: editFormData.job_title
    }

    const { error } = await supabase.from('profiles').update({ ...payload, email: editFormData.email }).eq('id', editStaff.id)

    if (error) {
      toast.error("Role update locked by security policy")
    } else {
      toast.success("Role updated successfully")
      setStaffList(prev => prev.map(s => s.id === editStaff.id ? { ...s, ...editFormData } : s))
      setEditStaff(null)
    }
    setEditing(false)
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Staff Members</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">View and manage your team members and their project assignments.</p>
        </div>
        <Button className="shadow-sm shadow-primary/20 w-full sm:w-auto font-semibold" asChild>
          <Link href="/users/new">
            <Plus className="mr-2 h-4 w-4" /> Add New Staff
          </Link>
        </Button>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardHeader className="py-4 border-b border-border/50 bg-card rounded-t-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
              <UserCog className="h-5 w-5 text-muted-foreground" />
              Team Overview
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search by name, email or role..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 bg-background/50 h-9 font-medium shadow-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50">
                  <TableHead className="w-[250px] py-4 pl-6 text-sm">Name</TableHead>
                  <TableHead className="py-4 text-sm hidden sm:table-cell">Role & Title</TableHead>
                  <TableHead className="py-4 text-sm hidden md:table-cell">Active Projects</TableHead>
                  <TableHead className="py-4 text-sm hidden lg:table-cell">Completed</TableHead>
                  <TableHead className="py-4 pr-6 text-right text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleStaff.length > 0 ? visibleStaff.map(staff => {
                  const assigned = staff.assignedTasks || []
                  const completed = staff.completedTasks || []
                  const jobTitle = staff.job_title || (staff.role === "admin" ? "Admin" : "Staff")

                  return (
                    <TableRow key={staff.id} className="border-border/50 group hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium pl-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ring-1 ring-border shadow-sm bg-primary/10 text-primary border border-primary/20">
                            {staff.name ? staff.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2) : "NT"}
                          </div>
                          <div className="flex flex-col overflow-hidden max-w-[200px]">
                            <span className="text-base font-bold leading-tight truncate">{staff.name || "System Pipeline"}</span>
                            <span className="text-sm text-muted-foreground font-medium truncate">{staff.email}</span>
                          </div>
                        </div>
                      </TableCell>
                      
                      <TableCell className="py-4 hidden sm:table-cell">
                        <div className="flex flex-col items-start gap-1.5 overflow-hidden max-w-[150px]">
                          <span className="font-semibold text-sm truncate w-full">{jobTitle}</span>
                          <Badge variant={staff.role === "admin" ? "default" : "secondary"} className="text-[10px] uppercase. tracking-widest px-1.5 py-0 shadow-sm font-bold">
                            {staff.role}
                          </Badge>
                        </div>
                      </TableCell>
                      
                      <TableCell className="py-4 hidden md:table-cell align-top">
                        {assigned.length > 0 ? (
                          <div className="flex flex-col gap-1 w-[200px]">
                            {assigned.slice(0, 3).map((p: any) => (
                              <span key={p.id} className="text-xs truncate bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md font-bold">
                                • {p.title}
                              </span>
                            ))}
                            {assigned.length > 3 && <span className="text-xs text-muted-foreground pl-2 font-medium">+{assigned.length - 3} remaining blocks...</span>}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic font-medium">No active projects</span>
                        )}
                      </TableCell>

                      <TableCell className="py-4 hidden lg:table-cell align-top">
                        {completed.length > 0 ? (
                          <div className="flex flex-col gap-1 w-[200px]">
                            {completed.slice(0, 3).map((p: any) => (
                              <span key={p.id} className="text-xs truncate bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">
                                ✓ {p.title}
                              </span>
                            ))}
                            {completed.length > 3 && <span className="text-xs text-muted-foreground pl-2 font-medium">+{completed.length - 3} drops...</span>}
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground italic font-medium">No completed projects</span>
                        )}
                      </TableCell>

                      <TableCell className="text-right pr-6 py-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 shadow-sm font-semibold">
                              <ListChecks className="mr-2 h-4 w-4 hidden sm:block" />
                              <span>Actions</span>
                              <ChevronDown className="ml-2 h-3 w-3 opacity-50" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[180px]">
                            <DropdownMenuItem className="cursor-pointer font-medium" asChild>
                              <Link href={`/staff/${staff.id}`}><User className="mr-2 h-4 w-4" /> View Profile</Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer font-medium" onClick={() => handleOpenEdit(staff)}>
                              <Edit className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="cursor-pointer font-medium text-destructive focus:text-destructive" onClick={() => handleDeleteStaff(staff.id)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                }) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-base">
                      No staff members found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editStaff} onOpenChange={(open) => !open && setEditStaff(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitEdit}>
            <DialogHeader>
              <DialogTitle>Edit Staff: {editStaff?.name}</DialogTitle>
              <DialogDescription>
                Update this staff member information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} required className="bg-background shadow-sm font-semibold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} required className="bg-background shadow-sm font-medium" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="job_title">Job Title / Department</Label>
                <Input id="job_title" value={editFormData.job_title} onChange={e => setEditFormData({...editFormData, job_title: e.target.value})} className="bg-background shadow-sm font-medium" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select 
                  id="role"
                  className="flex h-10 w-full rounded-md border border-input bg-background font-bold px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  value={editFormData.role}
                  onChange={e => setEditFormData({...editFormData, role: e.target.value})}
                  required
                >
                  <option value="staff" className="bg-background font-bold">Staff</option>
                  <option value="admin" className="bg-background font-bold">Admin</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditStaff(null)} disabled={editing}>Cancel</Button>
              <Button type="submit" disabled={editing} className="font-bold">
                {editing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
