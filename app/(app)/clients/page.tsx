/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Users, Search, ChevronDown, ListChecks, Edit, Building2, Loader2, Save, Trash2 } from "lucide-react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function ClientsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [clientList, setClientList] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState("")

  const [editClient, setEditClient] = useState<any | null>(null)
  const [editFormData, setEditFormData] = useState({ name: "", company: "", email: "", phone: "" })
  const [editing, setEditing] = useState(false)

  const fetchClients = useCallback(async () => {
    try {
      // Use admin API route (service-role key) so RLS doesn't block the listing
      const res = await fetch('/api/admin/profiles?role=client', { 
        credentials: 'include',
        cache: 'no-store' 
      })
      if (res.ok) {
        const json = await res.json()
        const formatted = (json.profiles ?? []).map((c: any) => ({
          ...c,
          projectCount: c.projects?.length ?? c.assignments?.length ?? 0
        }))
        setClientList(formatted)
      }
    } catch (err) {
      console.error("Fetch clients err:", err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchClients()
  }, [user?.id])

  const visibleClients = clientList.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDeleteClient = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this client?")) return
    
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
    })
    
    if (!res.ok) {
      let errData;
      try {
        errData = await res.json()
      } catch (e) {
        errData = { error: await res.text() }
      }
      toast.error(errData?.error || `Failed to delete client (Status ${res.status})`)
      console.error("Delete client full error:", res.status, errData)
    } else {
      toast.success("Client deleted successfully")
      setClientList(prev => prev.filter(c => c.id !== id))
    }
  }

  const handleOpenEdit = (clientParam: any) => {
    setEditClient(clientParam)
    setEditFormData({ name: clientParam.name || "", company: clientParam.company || "", email: clientParam.email || "", phone: clientParam.phone || "" })
  }

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editClient) return
    setEditing(true)

    const payload = {
      name: editFormData.name,
      company: editFormData.company,
      phone: editFormData.phone
      // Email is not directly updated in strict Supabase Auth via profiles alone for auth credentials, 
      // but we bind it strictly in profiles JSON for CRM tracking. Users update Auth email selectively elsewhere.
      // So we will just write the tracking metadata safely.
    }

    const { error } = await supabase.from('profiles').update({ ...payload, email: editFormData.email }).eq('id', editClient.id)
    
    if (error) {
      toast.error("Database row rejected")
    } else {
      toast.success("Profile tracking bound securely")
      setClientList(prev => prev.map(c => c.id === editClient.id ? { ...c, ...editFormData } : c))
      setEditClient(null)
    }
    setEditing(false)
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Clients Directory</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Manage physical profiles tracking strict Live SQL entries implicitly.</p>
        </div>
        {user?.role === "admin" && (
          <Button className="shadow-sm shadow-primary/20 w-full sm:w-auto" asChild>
            <Link href="/clients/new">
              <Plus className="mr-2 h-4 w-4" /> Add New Client
            </Link>
          </Button>
        )}
      </div>

      <Card className="shadow-sm border-border/50">
        <CardHeader className="py-4 border-b border-border/50 bg-card rounded-t-xl">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <CardTitle className="text-base md:text-lg font-medium flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" />
              Live Identity Resolvers
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Extract parameters visually..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 bg-background/50 h-9 shadow-sm"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-border/50">
                  <TableHead className="w-[300px] py-4 pl-6 text-sm">Client Name</TableHead>
                  <TableHead className="py-4 text-sm">Company</TableHead>
                  <TableHead className="py-4 hidden md:table-cell text-sm">Email</TableHead>
                  <TableHead className="py-4 hidden lg:table-cell text-sm">Phone no.</TableHead>
                  <TableHead className="py-4 text-center text-sm">Projects</TableHead>
                  <TableHead className="py-4 pr-6 text-right text-sm">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleClients.length > 0 ? visibleClients.map(client => (
                  <TableRow key={client.id} className="border-border/50 group hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium pl-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-full flex items-center justify-center font-bold text-sm ring-1 ring-border shadow-sm bg-primary/10 text-primary border border-primary/20">
                          {client.name ? client.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2) : "UN"}
                        </div>
                        <div className="flex flex-col overflow-hidden max-w-[200px]">
                          <span className="text-base font-bold leading-tight truncate px-1">{client.name || "Unnamed Block"}</span>
                          <span className="text-xs text-muted-foreground md:hidden truncate">{client.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-sm font-semibold">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {client.company || <span className="text-muted-foreground font-normal">Unspecified</span>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden md:table-cell text-sm font-medium py-4">
                      <div className="truncate max-w-[180px]">{client.email}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden lg:table-cell text-sm font-medium py-4">{client.phone || "---"}</TableCell>
                    <TableCell className="text-center py-4">
                      <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 text-sm mx-auto py-1 px-3 rounded-md w-fit font-bold border border-blue-500/20 shadow-sm">
                        {client.projectCount}
                      </div>
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
                            <Link href={`/clients/${client.id}`}><Users className="mr-2 h-4 w-4" /> View Details</Link>
                          </DropdownMenuItem>
                          {user?.role === "admin" && (
                            <>
                              <DropdownMenuItem className="cursor-pointer font-medium" onClick={() => handleOpenEdit(client)}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="cursor-pointer font-medium text-destructive focus:text-destructive" onClick={() => handleDeleteClient(client.id)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground text-base">
                      No clients found.                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editClient} onOpenChange={(open) => !open && setEditClient(null)}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submitEdit}>
            <DialogHeader>
              <DialogTitle>Edit Client</DialogTitle>
              <DialogDescription>
                Update this clients information.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Client Name</Label>
                <Input id="name" value={editFormData.name} onChange={e => setEditFormData({...editFormData, name: e.target.value})} required className="bg-background shadow-sm font-semibold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input id="company" value={editFormData.company} onChange={e => setEditFormData({...editFormData, company: e.target.value})} required className="bg-background shadow-sm font-semibold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" type="email" value={editFormData.email} onChange={e => setEditFormData({...editFormData, email: e.target.value})} required className="bg-background shadow-sm font-medium" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" value={editFormData.phone} onChange={e => setEditFormData({...editFormData, phone: e.target.value})} className="bg-background shadow-sm font-medium" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditClient(null)} disabled={editing}>Cancel</Button>
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
