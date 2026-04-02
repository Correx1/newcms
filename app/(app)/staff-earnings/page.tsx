/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ArrowRight, User, AlertCircle, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function StaffEarningsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [staffPayments, setStaffPayments] = useState<any[]>([])
  
  // Pagination State
  const [staffPage, setStaffPage] = useState(1)
  const rowsPerPage = 10

  const fetchData = async () => {
    if (!user || user.role !== "admin") return
    
    setLoading(true)
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
      setStaffPayments(mappedStaff.sort((a: { earnings: number }, b: { earnings: number }) => b.earnings - a.earnings))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [user?.id])

  if (user?.role !== "admin") return (
     <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-bold tracking-tight">Security Boundary Dropped</h2>
        <p className="text-muted-foreground text-center font-medium">Internal developers do not hold credentials to parse exact financial limits. View your earnings via My Earnings.</p>
     </div>
  );

  if (loading) return <PageSkeleton rows={4} />

  // Staff Payroll sums
  const staffTotalPayroll = staffPayments.reduce((acc, a) => acc + a.earnings, 0)
  const staffTotalPaid = staffPayments.reduce((acc, a) => acc + a.amountPaid, 0)
  const staffBalance = staffTotalPayroll - staffTotalPaid

  // Pagination Logic
  const staffTotalPages = Math.ceil(staffPayments.length / rowsPerPage)
  const staffIndexOfLast = staffPage * rowsPerPage
  const staffIndexOfFirst = staffIndexOfLast - rowsPerPage
  const currentStaffPayments = staffPayments.slice(staffIndexOfFirst, staffIndexOfLast)

  return (
    <div className="flex-1 space-y-8 pt-6 pb-12 w-full max-w-7xl mx-auto animate-in fade-in duration-500">
      
      <div className="flex items-center justify-between">
         <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">Staff Payroll Details</h1>
            <p className="text-muted-foreground text-sm md:text-base font-medium">Internal project payout distributions safely monitored natively.</p>
         </div>
         <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="shadow-sm font-semibold h-9 gap-2 shrink-0">
           <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
         </Button>
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
                  <TableHead className="py-4 text-xs uppercase font-bold tracking-wider text-right">Cleared</TableHead>
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
          
          {/* Pagination */}
          {staffTotalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10">
              <p className="text-xs text-muted-foreground font-semibold">
                Showing <span className="text-foreground">{staffIndexOfFirst + 1}</span> to <span className="text-foreground">{Math.min(staffIndexOfLast, staffPayments.length)}</span> of <span className="text-foreground">{staffPayments.length}</span> records
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
  )
}
