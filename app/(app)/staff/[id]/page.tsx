/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { ArrowLeft, Mail, Shield, CheckCircle2, FolderKanban, Briefcase, DollarSign, Activity, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
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
  
  // Payout Dialog State
  const [payoutModalOpen, setPayoutModalOpen] = useState(false)
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null)
  const [payoutAmount, setPayoutAmount] = useState("")
  const [payoutDate, setPayoutDate] = useState("")
  const [payoutNotes, setPayoutNotes] = useState("")
  const [submittingPayout, setSubmittingPayout] = useState(false)
  const [sendingInvite, setSendingInvite] = useState(false)
  
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

    fetchStaffDetails()
    return () => { mounted = false }
  }, [staffId])

  if (loading) return <DetailSkeleton />

  if (!staff) {
    return <div className="p-8 text-center text-muted-foreground font-semibold">Staff profile not found.</div>
  }

  const allProjects = staff.assignments?.map((a: any) => ({
    ...a.projects,
    assignment_id: a.id,
    expected_earnings: Number(a.earnings) || 0,
    amount_paid: Number(a.amount_paid) || 0,
  })).filter(Boolean) || []
  
  const assignedProjects = allProjects.filter((p: any) => p.status !== "completed" && p.status !== "approved")
  const completedProjects = allProjects.filter((p: any) => p.status === "completed" || p.status === "approved")

  const jobTitle = staff.job_title || (staff.role === "admin" ? "Admin" : "Staff")

  const openPayoutModal = (project: any) => {
    setSelectedAssignment(project)
    setPayoutAmount("")
    setPayoutDate(new Date().toISOString().split('T')[0])
    setPayoutNotes("")
    setPayoutModalOpen(true)
  }

  const submitPayout = async () => {
    if (!payoutAmount || isNaN(Number(payoutAmount))) {
      toast.error("Enter a valid payout amount")
      return;
    }
    
    setSubmittingPayout(true)
    const res = await fetch('/api/admin/staff-payout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: selectedAssignment.id,
        user_id: staff.id,
        amount: Number(payoutAmount),
        payment_date: payoutDate,
        notes: payoutNotes
      })
    })

    if (!res.ok) {
      toast.error("Failed to logically record staff payout")
    } else {
      toast.success("Staff payout ledger updated successfully!")
      setPayoutModalOpen(false)
      
      const refresh = await fetch(`/api/admin/profiles/${staffId}`, { credentials: 'include', cache: 'no-store' })
      if(refresh.ok) {
         const json = await refresh.json()
         if(json.profile) setStaff(json.profile)
      }
    }
    setSubmittingPayout(false)
  }

  const handleSendInvite = async () => {
    if (!staff.email || staff.email === 'No mail provided' || staff.email.includes('@noplincms.local') || staff.email.startsWith('silent_')) {
      toast.error("Cannot dispatch invite to a placeholder email.")
      return
    }
    
    setSendingInvite(true)
    try {
      const res = await fetch(`/api/admin/staff/${staffId}/invite`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Password setup invite dispatched securely.")
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch invite")
    } finally {
      setSendingInvite(false)
    }
  }

  return (
    <>
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
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
        {user?.role === "admin" && (
          <div className="flex sm:ml-auto">
            <Button size="sm" onClick={handleSendInvite} disabled={sendingInvite} className="shadow-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white border-none h-9">
              {sendingInvite ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Resend Invite
            </Button>
          </div>
        )}
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
                      <div className="border border-border/50 rounded-lg p-3 shadow-sm bg-background flex flex-col justify-between group h-full">
                        <Link href={`/projects/${p.id}`} className="block">
                          <div className="font-bold group-hover:text-primary transition-colors text-base underline-offset-4">{p.title}</div>
                        </Link>
                        
                        <div className="text-xs text-muted-foreground mt-2 flex items-center justify-between font-semibold">
                          <span>Limit: {p.deadline ? p.deadline.split('T')[0] : "None"}</span>
                          <Badge variant="outline" className="capitalize text-[10px] bg-background">{p.status}</Badge>
                        </div>

                        {(user?.role === "admin" || p.expected_earnings > 0) && (
                          <div className="mt-3 space-y-1.5 border-t border-border/50 pt-2 pb-1">
                             <div className="flex justify-between items-center text-xs font-semibold">
                               <span className="text-muted-foreground">Expected Pay</span>
                               <span>${p.expected_earnings.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs font-semibold">
                               <span className="text-emerald-600/80">Processed</span>
                               <span className="text-emerald-600">${p.amount_paid.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-border/30">
                               <span>Balance</span>
                               <span className={p.expected_earnings - p.amount_paid > 0 ? 'text-amber-500' : 'text-emerald-600'}>
                                 ${(p.expected_earnings - p.amount_paid).toLocaleString()}
                               </span>
                             </div>

                             {user?.role === "admin" && p.staff_payment_logs && p.staff_payment_logs.length > 0 && (
                               <div className="mt-2 space-y-1 bg-muted/30 p-1.5 rounded-md border border-border/50 max-h-24 overflow-y-auto">
                                 {p.staff_payment_logs.sort((a:any, b:any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()).map((log:any) => (
                                   <div key={log.id} className="flex justify-between items-center text-[10px] font-medium border-b border-border/30 last:border-0 pb-1 last:pb-0">
                                     <span className="text-emerald-600 dark:text-emerald-400 font-bold">+${Number(log.amount).toLocaleString()}</span>
                                     <span className="text-muted-foreground truncate ml-2 mr-2 max-w-[80px]" title={log.notes}>{log.notes || "No notes"}</span>
                                     <span className="text-muted-foreground shrink-0">{new Date(log.payment_date).toLocaleDateString()}</span>
                                   </div>
                                 ))}
                               </div>
                             )}
                          </div>
                        )}

                        {user?.role === "admin" && (
                          <Button size="sm" variant="outline" className="w-full mt-3 h-8 text-[11px] font-bold shadow-sm bg-background hover:bg-muted" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPayoutModal(p) }}>
                            <DollarSign className="h-3 w-3 mr-1.5 text-muted-foreground" /> Manage Payout
                          </Button>
                        )}
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
                      <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg p-3 shadow-sm flex flex-col justify-between group h-full">
                        <Link href={`/projects/${p.id}`} className="block">
                          <div className="font-bold text-emerald-700 dark:text-emerald-300 group-hover:underline transition-colors">{p.title}</div>
                        </Link>
                        
                        {(user?.role === "admin" || p.expected_earnings > 0) && (
                          <div className="mt-3 space-y-1.5 border-t border-emerald-500/20 pt-2">
                             <div className="flex justify-between items-center text-xs font-semibold">
                               <span className="text-muted-foreground">Volume</span>
                               <span>${p.expected_earnings.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs font-semibold">
                               <span className="text-emerald-600/70 dark:text-emerald-400">Processed</span>
                               <span className="text-emerald-600 dark:text-emerald-400">${p.amount_paid.toLocaleString()}</span>
                             </div>
                             <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-emerald-500/10">
                               <span>Balance</span>
                               <span className={p.expected_earnings - p.amount_paid > 0 ? 'text-amber-500' : 'text-emerald-600'}>
                                 ${(p.expected_earnings - p.amount_paid).toLocaleString()}
                               </span>
                             </div>

                             {user?.role === "admin" && p.staff_payment_logs && p.staff_payment_logs.length > 0 && (
                               <div className="mt-2 space-y-1 bg-emerald-500/5 p-1.5 rounded-md border border-emerald-500/10 max-h-24 overflow-y-auto">
                                 {p.staff_payment_logs.sort((a:any, b:any) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()).map((log:any) => (
                                   <div key={log.id} className="flex justify-between items-center text-[10px] font-medium border-b border-emerald-500/10 last:border-0 pb-1 last:pb-0">
                                     <span className="text-emerald-600 dark:text-emerald-400 font-bold">+${Number(log.amount).toLocaleString()}</span>
                                     <span className="text-muted-foreground truncate ml-2 mr-2 max-w-[80px]" title={log.notes}>{log.notes || "No notes"}</span>
                                     <span className="text-muted-foreground shrink-0">{new Date(log.payment_date).toLocaleDateString()}</span>
                                   </div>
                                 ))}
                               </div>
                             )}
                          </div>
                        )}
                        
                        {user?.role === "admin" && (
                          <Button size="sm" variant="outline" className="w-full mt-3 h-8 text-[11px] font-bold border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPayoutModal(p) }}>
                            <DollarSign className="h-3 w-3 mr-1.5" /> Manage Payout
                          </Button>
                        )}
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

      <Dialog open={payoutModalOpen} onOpenChange={setPayoutModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5 text-emerald-500" /> Log Staff Payout</DialogTitle>
            <DialogDescription>
              Update the total amount paid to <strong>{staff?.name}</strong> for their work on {selectedAssignment?.title}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-muted/30 p-4 rounded-xl border border-border/50 shadow-sm flex items-center justify-between mb-2">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Total Expected Pay</span>
                <p className="font-bold text-lg leading-none">${selectedAssignment?.expected_earnings?.toLocaleString()}</p>
              </div>
              <Activity className="h-5 w-5 text-muted-foreground/30" />
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="font-semibold text-sm">Payment Amount</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-muted-foreground font-semibold">$</span>
                  <Input 
                    type="number"
                    value={payoutAmount} 
                    onChange={(e) => setPayoutAmount(e.target.value)} 
                    placeholder="e.g 800" 
                    className="pl-8 font-semibold shadow-sm" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-semibold text-sm">Date</Label>
                <Input 
                  type="date"
                  value={payoutDate} 
                  onChange={(e) => setPayoutDate(e.target.value)} 
                  className="font-semibold shadow-sm"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold text-sm">Notes (Optional)</Label>
              <Input 
                value={payoutNotes} 
                onChange={(e) => setPayoutNotes(e.target.value)} 
                placeholder="Bank transfer #1234, Check, etc." 
                className="font-semibold shadow-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayoutModalOpen(false)}>Cancel</Button>
            <Button className="font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm" onClick={submitPayout} disabled={submittingPayout}>
              {submittingPayout ? "Processing..." : "Log Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
