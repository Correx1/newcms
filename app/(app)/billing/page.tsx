/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, Receipt, DollarSign, Activity, ChevronLeft, ChevronRight, Search } from "lucide-react"

export default function ClientBillingPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<any[]>([])
  
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  useEffect(() => {
    let mounted = true
    if (!user) return

    if (user.role !== "client") {
      router.push("/dashboard")
      return
    }

    const fetchBilling = async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, status, price, amount_paid')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })

      if (data && mounted) {
        setProjects(data)
      }
      if (mounted) setLoading(false)
    }

    fetchBilling()
    return () => { mounted = false }
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    )
  }

  // Calculate top level sums
  const totalExpected = projects.reduce((sum, p) => {
    const numericPrice = parseFloat((p.price || "0").replace(/[^0-9.]/g, ''))
    return sum + (isNaN(numericPrice) ? 0 : numericPrice)
  }, 0)
  
  const totalPaid = projects.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0)
  const totalBalance = Math.max(0, totalExpected - totalPaid)

  // Pagination logic
  const totalPages = Math.ceil(projects.length / rowsPerPage) || 1
  const paginatedProjects = projects.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage)

  const handleNextPage = () => setCurrentPage(p => Math.min(p + 1, totalPages))
  const handlePrevPage = () => setCurrentPage(p => Math.max(p - 1, 1))

  return (
    <div className="space-y-6 w-full max-w-[1400px] mx-auto pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Billing & Finance</h1>
        <p className="text-muted-foreground">Review your project financial commitments, payment history, and outstanding balances.</p>
      </div>

      {/* Top Level Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-border/50 bg-gradient-to-br from-background to-muted/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Project Values</CardTitle>
            <DollarSign className="h-4 w-4 text-primary/70" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tracking-tight">${totalExpected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Accumulated billed amount</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-emerald-500/10 bg-emerald-500/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Total Processed</CardTitle>
            <Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 tracking-tight">${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-emerald-600/70 mt-1 font-medium">Cleared payments recognized</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-destructive/10 bg-destructive/5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium items-center gap-2 text-destructive">Total Outstanding</CardTitle>
            <Receipt className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive tracking-tight">${totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <p className="text-xs text-destructive/70 mt-1 font-medium">Remaining balance across all projects</p>
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="bg-muted/30 border-b border-border/50 pb-4">
          <CardTitle className="text-lg">Project Ledgers</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {projects.length === 0 ? (
            <div className="text-center py-10">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No financial records found.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-semibold px-4 py-3">Project Title</TableHead>
                      <TableHead className="font-semibold text-right py-3 w-[150px]">Expected Value</TableHead>
                      <TableHead className="font-semibold text-right py-3 w-[150px]">Amount Paid</TableHead>
                      <TableHead className="font-semibold text-right px-4 py-3 w-[150px]">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProjects.map((p) => {
                      const numericPrice = parseFloat((p.price || "0").replace(/[^0-9.]/g, ''))
                      const expected = isNaN(numericPrice) ? 0 : numericPrice
                      const paid = Number(p.amount_paid || 0)
                      const balance = Math.max(0, expected - paid)

                      return (
                        <TableRow key={p.id} className="group hover:bg-muted/10 cursor-pointer" onClick={() => router.push(`/projects/${p.id}`)}>
                          <TableCell className="font-bold px-4 py-3">{p.title}</TableCell>
                          <TableCell className="text-right py-3 font-semibold text-muted-foreground">${expected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right py-3 font-bold text-emerald-600 dark:text-emerald-400">${paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right px-4 py-3 font-bold">
                            <span className={balance > 0 ? "text-destructive" : "text-emerald-600"}>
                              ${balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controller */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/5">
                  <span className="text-xs text-muted-foreground font-medium">
                    Showing {(currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, projects.length)} of {projects.length} records
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8 shadow-sm" onClick={handlePrevPage} disabled={currentPage === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-xs font-bold w-12 text-center">
                      {currentPage} / {totalPages}
                    </span>
                    <Button variant="outline" size="icon" className="h-8 w-8 shadow-sm" onClick={handleNextPage} disabled={currentPage === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
