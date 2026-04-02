/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { CheckCircle2, AlertCircle, Clock, Receipt, Activity, DollarSign, Wallet, ArrowLeft, ArrowRight, User, PlusCircle, FileText, Download, Trash2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import Link from "next/link"

export default function InvoicesPage() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [invoices, setInvoices] = useState<any[]>([])
  const [realInvoices, setRealInvoices] = useState<any[]>([])
  const [staffPayments, setStaffPayments] = useState<any[]>([])
  
  // Pagination States
  const [realInvPage, setRealInvPage] = useState(1)
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

    // 1.5 Fetch Authentic Generated Invoices
    let realQuery = supabase.from('invoices').select(`
       *,
       client:profiles!invoices_client_id_fkey(company, name)
    `).order('created_at', { ascending: false })
    
    if (user?.role === "client") {
      realQuery = realQuery.eq('client_id', user.id)
    }
    
    const { data: realInvData } = await realQuery
    if (realInvData) {
       setRealInvoices(realInvData)
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


  // Pagination Logic for Client Invoices
  const invTotalPages = Math.ceil(invoices.length / rowsPerPage)
  const invIndexOfLast = invPage * rowsPerPage
  const invIndexOfFirst = invIndexOfLast - rowsPerPage
  const currentInvoices = invoices.slice(invIndexOfFirst, invIndexOfLast)

  // Optimistic Status Mutator
  const updateInvoiceStatus = async (id: string, newStatus: string) => {
    setRealInvoices(current => current.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv))
    const { error } = await supabase.from('invoices').update({ status: newStatus }).eq('id', id)
    if (error) {
       toast.error("Failed to update status")
    } else {
       toast.success("Invoice status updated")
    }
  }

  // Delete Invoice
  const handleDeleteInvoice = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this official invoice?")) return
    
    // Optimistic UI updates
    setRealInvoices(prev => prev.filter(inv => inv.id !== id))
    
    const { error } = await supabase.from('invoices').delete().eq('id', id)
    if (error) {
       toast.error("Failed to delete invoice")
       // Re-fetch to revert optimistic update on failure
       fetchData()
    } else {
       toast.success("Invoice deleted successfully")
    }
  }


  return (
    <div className="flex-1 space-y-8 pt-6 pb-12 w-full max-w-7xl mx-auto px-4 md:px-0 animate-in fade-in duration-500">
      
      {/* ----------------- CLIENT INVOICES SECTION ----------------- */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
           <div>
              <h1 className="text-3xl font-bold tracking-tight">Client Revenue</h1>
              <p className="text-muted-foreground mt-1 text-sm md:text-base font-medium">Record of generated authentic invoices and legacy project financials.</p>
           </div>
           {user?.role === "admin" && (
             <Button asChild size="lg" className="shadow-md shadow-primary/20 gap-2 h-11 px-8 rounded-full font-bold w-full md:w-auto">
                <Link href="/invoices/new">
                   <PlusCircle className="h-5 w-5" /> Generate Invoice
                </Link>
             </Button>
           )}
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

        {/* AUTHENTIC GENERATED INVOICES TABLE */}
        <Card className="shadow-sm border-border/50 bg-card overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
            <CardTitle className="flex items-center gap-2 text-primary font-black tracking-tight text-xl"><FileText className="h-5 w-5" /> Official Invoices Record</CardTitle>
            <CardDescription className="font-medium text-foreground/70">Authentic aggregated bills transmitted to clients via the PDF rendering engine.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/10">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-[180px] py-4 pl-6 text-xs uppercase font-bold tracking-wider text-muted-foreground">Invoice No.</TableHead>
                    {user?.role === "admin" && <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-muted-foreground">Client</TableHead>}
                    <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-muted-foreground">Issue Date</TableHead>
                    <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-muted-foreground">Due Date</TableHead>
                    <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-right">Grand Total</TableHead>
                    <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-center pr-6">Status</TableHead>
                    <TableHead className="py-4 px-6 text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {realInvoices.slice((realInvPage - 1) * rowsPerPage, realInvPage * rowsPerPage).length > 0 ? (
                    realInvoices.slice((realInvPage - 1) * rowsPerPage, realInvPage * rowsPerPage).map(inv => (
                      <TableRow key={inv.id} className="border-border/50 group hover:bg-muted/20">
                          <TableCell className="pl-6 py-4">
                            <span className="bg-primary/10 text-primary px-2.5 py-1 rounded-md text-xs font-mono font-bold">{inv.invoice_number}</span>
                          </TableCell>
                          {user?.role === "admin" && (
                            <TableCell className="font-bold py-4 text-sm">
                              {inv.client?.company || inv.client?.name || "Unknown"}
                            </TableCell>
                          )}
                          <TableCell className="text-muted-foreground text-xs font-semibold py-4">{new Date(inv.issue_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-semibold py-4">{new Date(inv.due_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right py-4">
                             <div className="font-bold text-foreground text-sm">
                               {inv.currency === "NGN" ? "₦" : inv.currency === "GBP" ? "£" : inv.currency === "EUR" ? "€" : "$"}{Number(inv.grand_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                             </div>
                          </TableCell>
                          <TableCell className="py-4 text-center pr-6 w-[150px]">
                             <Select defaultValue={inv.status} onValueChange={(val) => updateInvoiceStatus(inv.id, val)}>
                                <SelectTrigger className={`h-8 text-[10px] uppercase font-bold tracking-wider border ${inv.status === 'paid' ? 'text-emerald-600 border-emerald-500/20 bg-emerald-500/10' : inv.status === 'overdue' ? 'text-destructive border-destructive/20 bg-destructive/10' : inv.status === 'unpaid' ? 'text-blue-500 border-blue-500/20 bg-blue-500/10' : 'text-slate-500 border-slate-500/20 bg-slate-500/10'}`}>
                                   <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                   <SelectItem value="draft" className="text-xs font-bold text-slate-500">DRAFT</SelectItem>
                                   <SelectItem value="unpaid" className="text-xs font-bold text-blue-500">UNPAID</SelectItem>
                                   <SelectItem value="paid" className="text-xs font-bold text-emerald-600">PAID</SelectItem>
                                   <SelectItem value="overdue" className="text-xs font-bold text-destructive">OVERDUE</SelectItem>
                                </SelectContent>
                             </Select>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-right">
                             <div className="flex justify-end gap-2">
                               <Button variant="outline" size="icon" asChild className="h-8 w-8 text-primary border-primary/20 hover:bg-primary/10 shadow-sm" title="Download Invoice">
                                  <Link href={`/invoices/${inv.id}`}><Download className="h-4 w-4" /></Link>
                               </Button>
                               {user?.role === "admin" && (
                                 <Button variant="outline" size="icon" onClick={() => handleDeleteInvoice(inv.id)} className="h-8 w-8 text-destructive border-destructive/20 hover:bg-destructive/10 shadow-sm" title="Delete Invoice">
                                    <Trash2 className="h-4 w-4" />
                                 </Button>
                               )}
                             </div>
                          </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                       <TableCell colSpan={6} className="h-32 text-center text-muted-foreground font-semibold">
                         No official invoices have been generated by the PDF engine yet.
                       </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            
            {/* Real Invoices Pagination */}
            {Math.ceil(realInvoices.length / rowsPerPage) > 1 && (
              <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10">
                <p className="text-xs text-muted-foreground font-semibold">
                  Showing <span className="text-foreground">{(realInvPage - 1) * rowsPerPage + 1}</span> to <span className="text-foreground">{Math.min(realInvPage * rowsPerPage, realInvoices.length)}</span> of <span className="text-foreground">{realInvoices.length}</span> records
                </p>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setRealInvPage(p => Math.max(1, p - 1))} disabled={realInvPage === 1} className="h-7 text-xs font-bold gap-1"><ArrowLeft className="h-3 w-3" /> Prev</Button>
                  <div className="text-xs font-bold px-2">{realInvPage} / {Math.ceil(realInvoices.length / rowsPerPage)}</div>
                  <Button variant="outline" size="sm" onClick={() => setRealInvPage(p => Math.min(Math.ceil(realInvoices.length / rowsPerPage), p + 1))} disabled={realInvPage === Math.ceil(realInvoices.length / rowsPerPage)} className="h-7 text-xs font-bold gap-1">Next <ArrowRight className="h-3 w-3" /></Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* LEGACY VIRTUAL PROJECT BILLS TABLE */}
        <Card className="shadow-sm border-border/50">
          <CardHeader className="bg-muted/5 border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-primary" /> Legacy Project Ledger (Virtual)</CardTitle>
            <CardDescription className="font-medium">Direct billing mappings tied to raw project budgets.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="w-[180px] py-4 pl-6 text-xs uppercase font-bold tracking-wider text-muted-foreground">Invoice ID</TableHead>
                    {user?.role === "admin" && <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-muted-foreground">Client</TableHead>}
                    <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-muted-foreground">Project</TableHead>
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


    </div>
  )
}
