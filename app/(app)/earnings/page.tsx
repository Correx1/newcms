/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DollarSign, Wallet, Activity, ArrowLeft, ArrowRight } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import Link from "next/link"

export default function EarningsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<any[]>([])
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const rowsPerPage = 10

  useEffect(() => {
    let mounted = true
    const fetchEarnings = async () => {
      if (!user) return
      
      try {
        const { data, error } = await supabase
          .from('project_assignments')
          .select(`
            id,
            earnings,
            amount_paid,
            projects (
              id,
              title,
              status,
              deadline
            )
          `)
          .eq('user_id', user.id)

        if (error) throw error

        if (mounted && data) {
          // Flatten payload and ensure numbers
          const flattened = data.map((a: any) => ({
            id: a.id,
            project_id: a.projects?.id,
            title: a.projects?.title || "Unknown Project",
            status: a.projects?.status || "unknown",
            deadline: a.projects?.deadline,
            earnings: Number(a.earnings) || 0,
            amount_paid: Number(a.amount_paid) || 0
          }))
          
          setAssignments(flattened.sort((a: { earnings: number }, b: { earnings: number }) => b.earnings - a.earnings))
        }
      } catch (err: any) {
        console.error("Failed to fetch earnings:", err)
        toast.error("Failed to load earnings data")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchEarnings()
    return () => { mounted = false }
  }, [user, supabase])

  if (!user || user.role === 'client') {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <h2 className="text-xl font-bold">Unauthorized access.</h2>
      </div>
    )
  }

  // Summary Math
  const totalEarnings = assignments.reduce((acc, a) => acc + a.earnings, 0)
  const totalPaid = assignments.reduce((acc, a) => acc + a.amount_paid, 0)
  const totalBalance = totalEarnings - totalPaid

  // Pagination Math
  const totalPages = Math.ceil(assignments.length / rowsPerPage)
  const indexOfLastRow = currentPage * rowsPerPage
  const indexOfFirstRow = indexOfLastRow - rowsPerPage
  const currentRows = assignments.slice(indexOfFirstRow, indexOfLastRow)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Earnings</h1>
          <p className="text-muted-foreground mt-1 font-medium">Track your project payouts and upcoming balances.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-sm border-border/50 bg-background/50 backdrop-blur-sm relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-primary/5 rounded-bl-[100px] -z-10"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total Expected</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${totalEarnings.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Lifetime expected volume</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/10 rounded-bl-[100px] -z-10"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Processed</CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">${totalPaid.toLocaleString()}</div>
            <p className="text-xs text-emerald-600/70 font-medium mt-1">Total cleared to date</p>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-amber-500/20 bg-amber-500/5 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/10 rounded-bl-[100px] -z-10"></div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Balance</CardTitle>
            <Activity className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-300">${totalBalance.toLocaleString()}</div>
            <p className="text-xs text-amber-600/70 font-medium mt-1">Outstanding payments</p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-border/50">
        <CardHeader className="border-b border-border/50 bg-muted/5">
          <CardTitle className="text-lg">Project Ledger</CardTitle>
          <CardDescription>A complete log of projects you are assigned to and your specific earning tracking.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold text-xs uppercase tracking-wider pl-6">Project</TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider">Status</TableHead>
                <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Expected Pay</TableHead>
                <TableHead className="text-right font-bold text-xs uppercase tracking-wider">Processed</TableHead>
                <TableHead className="text-right font-bold text-xs uppercase tracking-wider pr-6">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">Loading ledger...</TableCell>
                </TableRow>
              ) : currentRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground font-medium">No assigned projects found.</TableCell>
                </TableRow>
              ) : (
                currentRows.map((row) => {
                  const balance = row.earnings - row.amount_paid
                  return (
                    <TableRow key={row.id} className="cursor-pointer hover:bg-muted/30 transition-colors">
                      <TableCell className="pl-6">
                        <Link href={`/projects/${row.project_id}`} className="font-bold text-primary hover:underline block truncate max-w-[200px]">
                          {row.title}
                        </Link>
                        {row.deadline && <span className="text-[10px] text-muted-foreground font-medium block mt-1">Due: {row.deadline.split('T')[0]}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-[10px] bg-background shadow-sm border-border/50">
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-muted-foreground">
                        ${row.earnings.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        ${row.amount_paid.toLocaleString()}
                      </TableCell>
                      <TableCell className={`text-right font-bold pr-6 ${balance > 0 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        ${balance.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border/50 bg-muted/10">
              <p className="text-sm text-muted-foreground font-semibold">
                Showing <span className="text-foreground">{indexOfFirstRow + 1}</span> to <span className="text-foreground">{Math.min(indexOfLastRow, assignments.length)}</span> of <span className="text-foreground">{assignments.length}</span> entries
              </p>
              <div className="flex items-center space-x-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="shadow-sm font-bold h-8 flex items-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" /> Prev
                </Button>
                <div className="text-sm font-bold px-2">{currentPage} / {totalPages}</div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="shadow-sm font-bold h-8 flex items-center gap-1"
                >
                  Next <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
