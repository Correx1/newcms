/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertCircle, Clock, Receipt, Activity, DollarSign, Wallet, ArrowLeft, ArrowRight, User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function InvoicesPage() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [staffPayments, setStaffPayments] = useState<any[]>([])
  
  // Pagination States
  const [invPage, setInvPage] = useState(1)
  const [staffPage, setStaffPage] = useState(1)
  const rowsPerPage = 10

  const fetchData = async () => {
    // 1. Fetch Client Invoices (from projects)
    let query = supabase.from('projects').select(`
      id, created_at, deadline, price, amount_paid, status, title, details,
      client:profiles!projects_client_id_fkey(company, name)
    `).order('created_at', { ascending: false })

    if (user?.role === "client") {
      query = query.eq('client_id', user.id)
    }

    const { data: invData } = await query

    if (invData) {
      const mappedInvoices = invData.map((p:any) => {
        const budget = parseFloat((p.price || "0").replace(/[^0-9.]/g, ''))
        const amountPaid = Number(p.amount_paid || 0)
        let invStatus = "ongoing"
        if (budget > 0) {
           if (amountPaid >= budget) invStatus = "paid"
           else if (p.deadline && new Date(p.deadline) < new Date() && amountPaid < budget) invStatus = "overdue"
           else invStatus = "pending"
        } else if (p.status === "completed" || p.status === "approved") {
           invStatus = "paid"
        }
        return {
          id: `INV-${p.id.split('-')[0].toUpperCase()}`,
          project_id: p.id,
          client: p.client,
          project: { title: p.title },
          description: p.details ? p.details.substring(0, 60) + "..." : "Standard Scope Registration",
          issue_date: p.created_at,
          due_date: p.deadline || (budget > 0 ? "Tracked" : ""),
          budget: budget,
          amountPaid: amountPaid,
          status: invStatus
        }
      })
      setInvoices(mappedInvoices)
    }

    // 2. Fetch Staff Payments (from project_assignments) ONLY if admin
    if (user?.role === "admin") {
      const { data: staffData } = await supabase.from('project_assignments').select(`
        id, earnings, amount_paid,
        profiles ( name ),
        projects ( id, title, status, deadline )
      `).gt('earnings', 0)

      if (staffData) {
        const mappedStaff = staffData.map((a: any) => ({
          id: a.id,
          project_id: a.projects?.id,
          project_title: a.projects?.title,
          project_status: a.projects?.status,
          project_deadline: a.projects?.deadline,
          staff_name: a.profiles?.name || "Unknown",
          earnings: Number(a.earnings) || 0,
          amountPaid: Number(a.amount_paid) || 0
        }))
        setStaffPayments(mappedStaff.sort((a: { earnings: number },b: { earnings: number }) => b.earnings - a.earnings))
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [user?.id])

  if (user?.role === "staff") return (
     <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-bold tracking-tight">Security Boundary Dropped</h2>
        <p className="text-muted-foreground text-center font-medium">Internal developers do not hold credentials to parse exact financial limits. View your earnings via My Earnings.</p>
     </div>
  );

  if (loading) return <PageSkeleton rows={4} />
  
  // Outstanding Client sums
  const totalOutstanding = invoices.reduce((sum, i) => sum + (i.budget > 0 ? Math.max(0, i.budget - i.amountPaid) : 0), 0)
  const totalOverdue = invoices.filter(i => i.status === "overdue").reduce((sum, i) => sum + Math.max(0, i.budget - i.amountPaid), 0)
  const totalPaid = invoices.reduce((sum, i) => sum + Number(i.amountPaid || 0), 0)

  // Staff Payroll sums (Admin only)
  const staffTotalPayroll = staffPayments.reduce((acc, a) => acc + a.earnings, 0)
  const staffTotalPaid = staffPayments.reduce((acc, a) => acc + a.amountPaid, 0)
  const staffBalance = staffTotalPayroll - staffTotalPaid

  // Pagination Logic for Client Invoices
  const invTotalPages = Math.ceil(invoices.length / rowsPerPage)
  const invIndexOfLast = invPage * rowsPerPage
  const invIndexOfFirst = invIndexOfLast - rowsPerPage
  const currentInvoices = invoices.slice(invIndexOfFirst, invIndexOfLast)

  // Pagination Logic for Staff Payments
  const staffTotalPages = Math.ceil(staffPayments.length / rowsPerPage)
  const staffIndexOfLast = staffPage * rowsPerPage
  const staffIndexOfFirst = staffIndexOfLast - rowsPerPage
  const currentStaffPayments = staffPayments.slice(staffIndexOfFirst, staffIndexOfLast)

  return (
    <div className="flex-1 space-y-8 pt-6 pb-12 w-full max-w-7xl mx-auto px-4 md:px-0 animate-in fade-in duration-500">
      
      {/* ----------------- CLIENT INVOICES SECTION ----------------- */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
           <div>
              <h1 className="text-3xl font-bold tracking-tight">Client Revenue Ledger</h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base font-medium">Global mapping of client incoming financial dependencies.</p>
           </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="border-emerald-500/20 shadow-sm relative overflow-hidden bg-emerald-500/5">
            <div className="absolute right-0 top-0 p-4 opacity-10"><CheckCircle2 className="h-24 w-24 text-emerald-500" /></div>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Client Resolved Revenue</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">${totalPaid.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="border-blue-500/20 shadow-sm relative overflow-hidden bg-blue-500/5">
            <div className="absolute right-0 top-0 p-4 opacity-10"><Clock className="h-24 w-24 text-blue-500" /></div>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Client Unpaid Bills</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-blue-700 dark:text-blue-300">${totalOutstanding.toLocaleString()}</div></CardContent>
          </Card>
          <Card className="border-destructive/20 shadow-sm relative overflow-hidden bg-destructive/5">
            <div className="absolute right-0 top-0 p-4 opacity-10"><AlertCircle className="h-24 w-24 text-destructive" /></div>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-bold text-destructive uppercase tracking-widest">Overdue Revenue Alerts</CardTitle></CardHeader>
            <CardContent><div className="text-3xl font-bold text-destructive">${totalOverdue.toLocaleString()}</div></CardContent>
          </Card>
        </div>

        <Card className="shadow-sm border-border/50">
          <CardHeader className="bg-muted/5 border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Client Invoices Stack</CardTitle>
            <CardDescription className="font-medium">Direct database execution extracting literal numeric parameters safely securely natively.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-[180px] py-4 pl-6 text-xs uppercase font-bold tracking-wider text-muted-foreground">Invoice ID</TableHead>
                    {user?.role === "admin" && <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-muted-foreground">Client Entity</TableHead>}
                    <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-muted-foreground">Target Project</TableHead>
                    <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-muted-foreground">Issued</TableHead>
                    <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-right">Client Budget</TableHead>
                    <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-right">Processed</TableHead>
                    <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-center pr-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentInvoices.length > 0 ? currentInvoices.map(invoice => {
                     return (
                       <TableRow key={invoice.id} className="border-border/50 hover:bg-muted/20">
                          <TableCell className="font-mono text-[10px] pl-6 py-4 truncate text-muted-foreground font-bold" title={invoice.id}>{invoice.id}</TableCell>
                          {user?.role === "admin" && (
                            <TableCell className="font-bold py-4 text-sm">
                              {invoice.client?.company || invoice.client?.name || "Null"}
                            </TableCell>
                          )}
                          <TableCell className="py-4 max-w-[200px]">
                            <div className="font-bold truncate text-sm">{invoice.project?.title || "Direct Resolution Push"}</div>
                            <div className="text-[10px] text-muted-foreground font-medium truncate mt-0.5">{invoice.description}</div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs font-semibold py-4">{new Date(invoice.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right font-bold py-4 text-sm">
                            {invoice.budget > 0 ? `$${Number(invoice.budget).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : <span className="text-muted-foreground text-[10px] font-semibold">Custom/N/A</span>}
                          </TableCell>
                          <TableCell className="text-right py-4">
                             <div className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                               ${Number(invoice.amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                             </div>
                             {invoice.budget > 0 && invoice.budget > invoice.amountPaid && (
                               <div className="text-[10px] font-bold text-destructive uppercase mt-0.5">
                                 Bal: ${(invoice.budget - invoice.amountPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                               </div>
                             )}
                          </TableCell>
                          <TableCell className="py-4 text-center pr-6">
                             {invoice.status === "paid" && <Badge variant="outline" className="text-emerald-500 border-emerald-500/20 bg-emerald-500/10 font-bold shadow-sm uppercase text-[9px]"><CheckCircle2 className="h-3 w-3 mr-1"/> PAID</Badge>}
                             {invoice.status === "pending" && <Badge variant="outline" className="text-blue-500 border-blue-500/20 bg-blue-500/10 font-bold shadow-sm uppercase text-[9px]"><Clock className="h-3 w-3 mr-1"/> PENDING</Badge>}
                             {invoice.status === "overdue" && <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/10 font-bold shadow-sm uppercase text-[9px]"><AlertCircle className="h-3 w-3 mr-1"/> OVERDUE</Badge>}
                             {invoice.status === "ongoing" && <Badge variant="outline" className="text-amber-500 border-amber-500/20 bg-amber-500/10 font-bold shadow-sm uppercase text-[9px]"><Activity className="h-3 w-3 mr-1"/> ONGOING</Badge>}
                          </TableCell>
                       </TableRow>
                     )
                  }) : (
                    <TableRow>
                       <TableCell colSpan={7} className="h-32 text-center text-muted-foreground font-semibold">
                         No financial dependencies structurally logged within standard schemas.
                       </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {/* Pagination Controls Client Invoices */}
            {invTotalPages > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10">
                <p className="text-xs text-muted-foreground font-semibold">
                  Showing <span className="text-foreground">{invIndexOfFirst + 1}</span> to <span className="text-foreground">{Math.min(invIndexOfLast, invoices.length)}</span> of <span className="text-foreground">{invoices.length}</span> rows
                </p>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setInvPage(p => Math.max(1, p - 1))} disabled={invPage === 1} className="h-7 text-xs font-bold gap-1 shadow-sm"><ArrowLeft className="h-3 w-3" /> Prev</Button>
                  <div className="text-xs font-bold px-2">{invPage} / {invTotalPages}</div>
                  <Button variant="outline" size="sm" onClick={() => setInvPage(p => Math.min(invTotalPages, p + 1))} disabled={invPage === invTotalPages} className="h-7 text-xs font-bold gap-1 shadow-sm">Next <ArrowRight className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      {/* ----------------- STAFF PAYROLL SECTION (ADMIN ONLY) ----------------- */}
      {user?.role === "admin" && (
        <div className="space-y-6 pt-10 border-t border-border/50">
          <div className="flex items-center justify-between">
             <div>
                <h1 className="text-3xl font-bold tracking-tight">Staff Payroll Details</h1>
                <p className="text-muted-foreground mt-1 text-sm md:text-base font-medium">Internal project payout distributions safely monitored natively.</p>
             </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="shadow-sm border-border/50 bg-background/50 backdrop-blur-sm relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-bl-[100px] -z-10"></div>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total Internal Payroll</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold">${staffTotalPayroll.toLocaleString()}</div></CardContent>
            </Card>

            <Card className="shadow-sm border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-bl-[100px] -z-10"></div>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Payroll Cleared</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">${staffTotalPaid.toLocaleString()}</div></CardContent>
            </Card>

            <Card className="shadow-sm border-amber-500/20 bg-amber-500/5 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-bl-[100px] -z-10"></div>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Pending Paychecks</CardTitle></CardHeader>
              <CardContent><div className="text-3xl font-bold text-amber-700 dark:text-amber-300">${staffBalance.toLocaleString()}</div></CardContent>
            </Card>
          </div>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/5 border-b border-border/50 pb-4">
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5 text-primary" /> Internal Assigned Payouts</CardTitle>
              <CardDescription className="font-medium">All logged staff assigned expected earnings and respective clearing history.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="py-4 pl-6 text-xs uppercase font-bold tracking-wider text-muted-foreground">Staff Member</TableHead>
                      <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-muted-foreground">Target Project</TableHead>
                      <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-right">Expected Pay</TableHead>
                      <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-right">Cleared Balance</TableHead>
                      <TableHead className="py-4 pr-6 text-xs uppercase font-bold tracking-wider text-right">To Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentStaffPayments.length > 0 ? currentStaffPayments.map(sp => {
                       const bal = sp.earnings - sp.amountPaid;
                       return (
                         <TableRow key={sp.id} className="border-border/50 hover:bg-muted/20">
                            <TableCell className="font-bold py-4 pl-6 text-sm">{sp.staff_name}</TableCell>
                            <TableCell className="py-4 max-w-[200px]">
                              <div className="font-bold truncate text-sm text-primary">{sp.project_title || "Unknown"}</div>
                              <div className="text-[10px] mt-1 space-x-2">
                                <Badge variant="outline" className="text-[9px] uppercase shadow-sm">{sp.project_status}</Badge>
                                {sp.project_deadline && <span className="text-muted-foreground font-semibold">Limit: {sp.project_deadline.split('T')[0]}</span>}
                              </div>
                            </TableCell>
                            <TableCell className="text-right py-4 font-bold text-sm text-foreground">
                              ${sp.earnings.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right py-4 font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                              ${sp.amountPaid.toLocaleString()}
                            </TableCell>
                            <TableCell className={`text-right py-4 pr-6 font-bold text-sm ${bal > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
                               ${bal.toLocaleString()}
                            </TableCell>
                         </TableRow>
                       )
                    }) : (
                      <TableRow>
                         <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-semibold">
                           No staff profiles mapped with specific project earnings.
                         </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Pagination Controls Staff Payments */}
              {staffTotalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10">
                  <p className="text-xs text-muted-foreground font-semibold">
                    Showing <span className="text-foreground">{staffIndexOfFirst + 1}</span> to <span className="text-foreground">{Math.min(staffIndexOfLast, staffPayments.length)}</span> of <span className="text-foreground">{staffPayments.length}</span> rows
                  </p>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={() => setStaffPage(p => Math.max(1, p - 1))} disabled={staffPage === 1} className="h-7 text-xs font-bold shadow-sm gap-1"><ArrowLeft className="h-3 w-3" /> Prev</Button>
                    <div className="text-xs font-bold px-2">{staffPage} / {staffTotalPages}</div>
                    <Button variant="outline" size="sm" onClick={() => setStaffPage(p => Math.min(staffTotalPages, p + 1))} disabled={staffPage === staffTotalPages} className="h-7 text-xs font-bold shadow-sm gap-1">Next <ArrowRight className="h-3 w-3" /></Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  )
}
