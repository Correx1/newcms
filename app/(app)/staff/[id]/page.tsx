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
import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
    staff_payment_logs: a.staff_payment_logs || [],
  })).filter(Boolean) || []
  
  const assignedProjects = allProjects.filter((p: any) => p.status !== "completed" && p.status !== "approved")
  const completedProjects = allProjects.filter((p: any) => p.status === "completed" || p.status === "approved")

  const allLogs = allProjects
    .flatMap((p: any) => (p.staff_payment_logs || []).map((log: any) => ({ ...log, projectTitle: p.title, projectId: p.id })))
    .sort((a: { payment_date: string | number | Date }, b: { payment_date: string | number | Date }) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())

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
    <div className="space-y-6 overflow-x-hidden min-w-0">
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

      <div className="grid gap-6 md:grid-cols-3 min-w-0">
        <div className="md:col-span-1 space-y-6 min-w-0">
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
                  <div className="flex items-start text-sm font-semibold">
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="break-all">{staff.email}</span>
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

              {/* Total Earnings Summary */}
              {user?.role === 'admin' && (() => {
                const totalExpected = allProjects.reduce((sum: number, p: any) => sum + (p.expected_earnings || 0), 0)
                const totalPaid = allProjects.reduce((sum: number, p: any) => sum + (p.amount_paid || 0), 0)
                const totalBalance = totalExpected - totalPaid
                if (totalExpected === 0) return null
                return (
                  <div className="w-full border-t border-border/50 mt-4 pt-5 space-y-3">
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider block">Earnings Overview</span>
                    <div className="flex justify-between items-center text-sm gap-2">
                      <span className="text-muted-foreground font-medium shrink-0">Expected</span>
                      <span className="font-bold truncate">${totalExpected.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm gap-2">
                      <span className="text-emerald-600/80 font-medium shrink-0">Processed</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 truncate">${totalPaid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-t border-border/50 pt-2 mt-1 gap-2">
                      <span className="font-bold shrink-0">Balance</span>
                      <span className={`font-black text-base truncate ${totalBalance > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>${totalBalance.toLocaleString()}</span>
                    </div>
                    {/* Mini progress bar */}
                    {totalExpected > 0 && (
                      <div>
                        <div className="h-1.5 w-full bg-muted/50 rounded-full overflow-hidden mt-2">
                          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (totalPaid / totalExpected) * 100)}%` }} />
                        </div>
                        <p className="text-[10px] text-muted-foreground text-right mt-1 font-medium">{Math.round((totalPaid / totalExpected) * 100)}% paid</p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </CardContent>
          </Card>

          {/* RECENT PAYOUTS SMALL CARD */}
          {user?.role === "admin" && allLogs.length > 0 && (
            <Card className="shadow-sm border-border/50 bg-background">
              <CardHeader className="pb-3 border-b border-border/50 bg-muted/5">
                <CardTitle className="flex items-center gap-2 text-md">
                  <Activity className="h-4 w-4 text-muted-foreground" /> Recent Payouts
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="flex flex-col divide-y divide-border/50">
                  {allLogs.slice(0, 10).map((log: any) => (
                    <div key={log.id} className="p-3 flex flex-col justify-between group bg-background">
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-1 overflow-hidden pr-2 min-w-0">
                          <p className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase truncate">{new Date(log.payment_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                          <p className="text-sm font-bold truncate">{log.projectTitle}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            +${Number(log.amount).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                      {log.notes && (
                        <p className="mt-2 text-[11px] italic text-muted-foreground border-l-2 border-border/50 pl-2">
                          {log.notes}
                        </p>
                      )}
                    </div>
                  ))}
                  {allLogs.length > 10 && (
                    <div className="p-3 text-center bg-muted/5 border-t border-border/50">
                      <span className="text-xs font-bold text-muted-foreground">Showing 10 of {allLogs.length}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

        </div>

        <div className="md:col-span-2 space-y-6 min-w-0">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderKanban className="h-5 w-5 text-primary" /> Active Projects
              </CardTitle>
              <CardDescription className="font-medium text-sm">Projects currently assigned to {staff.name}.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {assignedProjects.length > 0 ? (
                <div>
                  <Table>
                    <TableHeader className="bg-muted/10 border-b border-border/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 pl-4">Project</TableHead>
                        {(user?.role === "admin" || assignedProjects.some((p:any)=>p.expected_earnings>0)) && (
                          <>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 text-right hidden sm:table-cell">Expected</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 text-right hidden sm:table-cell">Processed</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 text-right">Balance</TableHead>
                          </>
                        )}
                        <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 pr-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {assignedProjects.map((p: any) => (
                        <TableRow key={p.id} className="group hover:bg-muted/10 border-border/50 transition-colors cursor-pointer" onClick={() => router.push(`/projects/${p.id}`)}>
                          <TableCell className="py-4 pl-4 align-top w-full">
                            <div className="font-bold text-base md:text-md underline-offset-4 group-hover:text-primary transition-colors">{p.title}</div>
                            <div className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-2 font-semibold">
                              <span>Limit: {p.deadline ? p.deadline.split('T')[0] : "None"}</span>
                              <Badge variant="outline" className="capitalize text-[10px] bg-background shadow-sm truncate">{p.status}</Badge>
                            </div>
                          </TableCell>
                          
                          {(user?.role === "admin" || p.expected_earnings > 0) ? (
                            <>
                              <TableCell className="py-4 align-top text-right font-semibold text-muted-foreground hidden sm:table-cell">
                                ${p.expected_earnings.toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 align-top text-right font-bold text-emerald-600 dark:text-emerald-400 hidden sm:table-cell">
                                ${p.amount_paid.toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 align-top text-right font-bold">
                                <span className={p.expected_earnings - p.amount_paid > 0 ? 'text-amber-500' : 'text-emerald-600'}>
                                  ${(p.expected_earnings - p.amount_paid).toLocaleString()}
                                </span>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell colSpan={3} className="py-4 align-middle text-center text-muted-foreground text-xs italic">
                                Financials restricted
                              </TableCell>
                            </>
                          )}
                          
                          <TableCell className="py-4 pr-4 align-top text-right">
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              {user?.role === "admin" && (
                                <Button size="sm" variant="outline" className="h-8 text-[11px] font-bold shadow-sm bg-background hover:bg-muted w-full sm:w-[110px]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPayoutModal(p) }}>
                                  <DollarSign className="h-3 w-3 mr-1.5 text-muted-foreground" /> Manage
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed rounded-lg bg-muted/10 border-border/50">
                  <FolderKanban className="h-8 w-8 mx-auto mb-2 opacity-20 text-muted-foreground" />
                  <p className="text-sm font-semibold text-muted-foreground">No active projects assigned</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="pb-4 border-b border-border/50 bg-muted/5">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" /> Completed Projects
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {completedProjects.length > 0 ? (
                <div>
                  <Table>
                    <TableHeader className="bg-muted/10 border-b border-border/50">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 pl-4">Project</TableHead>
                        {(user?.role === "admin" || completedProjects.some((p:any)=>p.expected_earnings>0)) && (
                          <>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 text-right hidden sm:table-cell">Expected</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 text-right hidden sm:table-cell">Processed</TableHead>
                            <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 text-right">Balance</TableHead>
                          </>
                        )}
                        <TableHead className="font-semibold text-xs tracking-wider uppercase py-3 pr-4 text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedProjects.map((p: any) => (
                        <TableRow key={p.id} className="group hover:bg-muted/10 border-border/50 transition-colors cursor-pointer" onClick={() => router.push(`/projects/${p.id}`)}>
                          <TableCell className="py-4 pl-4 align-top w-full">
                            <div className="font-bold text-base md:text-md underline-offset-4 group-hover:text-primary transition-colors">{p.title}</div>
                            <div className="text-xs text-muted-foreground mt-2 flex flex-wrap items-center gap-2 font-semibold">
                              <span>Limit: {p.deadline ? p.deadline.split('T')[0] : "None"}</span>
                              <Badge variant="outline" className="capitalize text-[10px] bg-background shadow-sm truncate">{p.status}</Badge>
                            </div>
                          </TableCell>
                          
                          {(user?.role === "admin" || p.expected_earnings > 0) ? (
                            <>
                              <TableCell className="py-4 align-top text-right font-semibold text-muted-foreground hidden sm:table-cell">
                                ${p.expected_earnings.toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 align-top text-right font-bold text-emerald-600 dark:text-emerald-400 hidden sm:table-cell">
                                ${p.amount_paid.toLocaleString()}
                              </TableCell>
                              <TableCell className="py-4 align-top text-right font-bold">
                                <span className={p.expected_earnings - p.amount_paid > 0 ? 'text-amber-500' : 'text-emerald-600'}>
                                  ${(p.expected_earnings - p.amount_paid).toLocaleString()}
                                </span>
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell colSpan={3} className="py-4 align-middle text-center text-muted-foreground text-xs italic">
                                Financials restricted
                              </TableCell>
                            </>
                          )}
                          
                          <TableCell className="py-4 pr-4 align-top text-right">
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              {user?.role === "admin" && (
                                <Button size="sm" variant="outline" className="h-8 text-[11px] font-bold shadow-sm bg-background border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 w-full sm:w-[110px]" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openPayoutModal(p) }}>
                                  <DollarSign className="h-3 w-3 mr-1.5" /> Manage
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
