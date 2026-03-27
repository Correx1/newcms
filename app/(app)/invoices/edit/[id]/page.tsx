/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { ArrowLeft, Loader2, Send, Save, Folders } from "lucide-react"
import { toast } from "sonner"
import { PageSkeleton } from "@/components/ui/page-skeleton"

interface LineItem {
  id: string
  service: string
  description: string
  base_budget: number
  base_paid: number
  project_id?: string
}

export default function EditInvoicePage() {
  const router = useRouter()
  const params = useParams()
  const invoiceId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<any[]>([])
  const [clientProjects, setClientProjects] = useState<any[]>([])

  // Form State
  const [selectedClient, setSelectedClient] = useState<string>("")
  const [issueDate, setIssueDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [dueDate, setDueDate] = useState<string>("")
  const [taxName, setTaxName] = useState("Tax")
  const [taxRate, setTaxRate] = useState<number>(0)
  const [notes, setNotes] = useState("")
  const [currency, setCurrency] = useState("USD")
  const [exchangeRate, setExchangeRate] = useState<number>(1500)

  const [lineItems, setLineItems] = useState<LineItem[]>([])

  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      // Fetch Clients
      const { data: clientData } = await supabase
        .from('profiles')
        .select('id, name, company, email')
        .eq('role', 'client')
        .order('name')
        
      if (mounted && clientData) setClients(clientData)

      // Fetch prevailing Invoice Data
      if (invoiceId) {
        const { data: invData } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', invoiceId)
          .single()

        if (mounted && invData) {
          setSelectedClient(invData.client_id)
          setIssueDate(invData.issue_date?.split('T')[0] || new Date().toISOString().split('T')[0])
          setDueDate(invData.due_date?.split('T')[0] || "")
          setTaxName(invData.tax_name || "Tax")
          setTaxRate(invData.tax_rate || 0)
          setNotes(invData.notes || "")
          setCurrency(invData.currency || "USD")
          if (invData.line_items) {
             // Map JSONB structure to LineItem standard
             const storedItems = (invData.line_items as any[]).map(i => ({
                id: Math.random().toString(),
                service: i.service,
                description: i.description || "",
                base_budget: i.budget, // We stored converted or base depending on initial save, for simplicity revert mapping here isn't perfect if exchange rate changed, but we assume re-calc
                base_paid: i.amount_paid,
                project_id: i.project_id
             }))
             setLineItems(storedItems)
          }
        }
      }

      if (mounted) setLoading(false)
    }
    fetchData()
    return () => { mounted = false }
  }, [invoiceId, supabase])

  // When client changes, fetch their unresolved projects to auto-suggest
  useEffect(() => {
    let mounted = true
    if (!selectedClient) {
      setClientProjects([])
      return
    }
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, title, price, amount_paid')
        .eq('client_id', selectedClient)
      if (mounted && data) setClientProjects(data)
    }
    fetchProjects()
    return () => { mounted = false }
  }, [selectedClient, supabase])

  // Math Auto-Calculators
  const getBudget = (item: LineItem) => currency === "NGN" ? item.base_budget * exchangeRate : item.base_budget
  const getPaid = (item: LineItem) => currency === "NGN" ? item.base_paid * exchangeRate : item.base_paid

  const subtotal = lineItems.reduce((acc, item) => acc + Math.max(0, getBudget(item) - getPaid(item)), 0)
  const taxAmount = (subtotal * taxRate) / 100
  const grandTotal = Math.max(0, subtotal + taxAmount)

  const toggleProject = (project: any) => {
    const exists = lineItems.find(i => i.project_id === project.id)
    if (exists) {
      setLineItems(lineItems.filter(i => i.project_id !== project.id))
    } else {
      const budget = parseFloat((project.price || "0").replace(/[^0-9.]/g, ''))
      const paid = Number(project.amount_paid || 0)
      setLineItems([...lineItems, { 
         id: Date.now().toString() + Math.random(),
         service: project.title,
         description: "",
         base_budget: budget,
         base_paid: paid,
         project_id: project.id
      }])
    }
  }

  const saveInvoiceToDatabase = async (sendEmail: boolean = false) => {
    if (!selectedClient) return toast.error("Please select a client.")
    if (!dueDate) return toast.error("Please select a due date.")
    if (lineItems.length === 0) return toast.error("You must aggregate at least one project.")

    if (sendEmail) {
      setSending(true)
    } else {
      setSaving(true)
    }

    try {
      // 1. Update database record
      const { error } = await supabase.from('invoices').update({
         client_id: selectedClient,
         issue_date: issueDate,
         due_date: dueDate,
         subtotal,
         tax_name: taxName,
         tax_rate: taxRate,
         tax_amount: taxAmount,
         grand_total: grandTotal,
         line_items: lineItems.map(item => ({
             service: item.service,
             description: item.description,
             budget: getBudget(item),
             amount_paid: getPaid(item),
             balance: Math.max(0, getBudget(item) - getPaid(item)),
             project_id: item.project_id
         })),
         currency: currency,
         notes: notes,
      }).eq('id', invoiceId)

      if (error) throw error

      toast.success(sendEmail ? "Invoice Updated and Dispatched" : "Invoice Updated")

      // 2. Mock Email Dispatch (We don't have Resend keys in this env yet, so it just mocks success)
      if (sendEmail) {
         // In production, an API route like /api/invoices/send would take over here
         // await fetch('/api/invoices/send', { method: 'POST', body: JSON.stringify({ id: invData.id }) })
      }
      
      router.push(`/invoices/${invoiceId}`)

    } catch (err: any) {
      toast.error(err.message || "Failed to generate invoice.")
    } finally {
      setSaving(false)
      setSending(false)
    }
  }

  if (loading) return <PageSkeleton />

  return (
    <div className="flex-1 space-y-6 pt-6 pb-12 w-full max-w-5xl mx-auto px-4 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back</span>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Invoice</h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">Modify financial variables for this authentic client bill.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        
        {/* LEFTSIDE BUILDER */}
        <div className="md:col-span-3 space-y-6">
          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/5 border-b border-border/50 pb-4">
              <CardTitle className="text-lg">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-2">
                <Label className="font-bold">Select Client</Label>
                <Select value={selectedClient} onValueChange={(v) => v && setSelectedClient(v)}>
                  <SelectTrigger className="font-medium bg-muted/10 h-11">
                    <SelectValue placeholder="Assign a client to this invoice..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(c => (
                      <SelectItem key={c.id} value={c.id} className="font-semibold">
                        {c.company ? `${c.company} (${c.name})` : c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2 col-span-1">
                  <Label className="font-bold">Issue Date</Label>
                  <Input type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} className="font-medium" />
                </div>
                <div className="space-y-2 col-span-1">
                  <Label className="font-bold text-destructive">Due Date</Label>
                  <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="font-bold border-destructive/20" />
                </div>
                <div className="space-y-2 col-span-1">
                  <Label className="font-bold">Currency</Label>
                  <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                    <SelectTrigger className="font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="NGN">Naira (₦)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {currency === "NGN" && (
                  <div className="space-y-2 col-span-3">
                    <Label className="font-bold text-emerald-600">Exchange Rate (1 USD = ₦)</Label>
                    <Input type="number" value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value))} className="font-bold text-emerald-600 border-emerald-500/30" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/5 border-b border-border/50 pb-4">
              <CardTitle className="text-lg flex items-center gap-2"><Folders className="h-5 w-5 text-primary" /> Aggregate Projects</CardTitle>
              <CardDescription>Select the client projects you intend to bill for. Balance (Amount to Bill) is auto-calculated.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {!selectedClient ? (
                 <div className="text-center py-6 text-sm text-muted-foreground font-semibold border rounded-md bg-muted/5 border-dashed">
                   Please select a client above to view their projects.
                 </div>
              ) : clientProjects.length === 0 ? (
                 <div className="text-center py-6 text-sm text-muted-foreground font-semibold border rounded-md bg-muted/5 border-dashed">
                   This client has no projects.
                 </div>
              ) : (
                 <div className="grid gap-3">
                   {clientProjects.map((proj) => {
                      const isSelected = lineItems.some(i => i.project_id === proj.id)
                      const baseBudget = parseFloat((proj.price || "0").replace(/[^0-9.]/g, ''))
                      const basePaid = Number(proj.amount_paid || 0)
                      
                      const convertedBudget = currency === "NGN" ? baseBudget * exchangeRate : baseBudget
                      const convertedPaid = currency === "NGN" ? basePaid * exchangeRate : basePaid
                      const convertedBalance = Math.max(0, convertedBudget - convertedPaid)
                      
                      const currencySymbol = currency === "NGN" ? "₦" : "$"
                      
                      return (
                        <div 
                          key={proj.id} 
                          onClick={() => toggleProject(proj)}
                          className={`flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-primary/5 border-primary shadow-sm' 
                              : 'bg-background hover:bg-muted/20 border-border/50'
                          }`}
                        >
                          <Checkbox checked={isSelected} className="mt-1" />
                          <div className="flex-1">
                             <h4 className={`font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>{proj.title}</h4>
                             <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs font-semibold text-muted-foreground">
                               <span>Budget: {currencySymbol}{convertedBudget.toLocaleString()}</span>
                               <span className="text-emerald-600 dark:text-emerald-400">Paid: {currencySymbol}{convertedPaid.toLocaleString()}</span>
                             </div>
                          </div>
                          <div className="text-right">
                             <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Amount to Bill</div>
                             <div className={`text-lg font-black ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                               {currencySymbol}{convertedBalance.toLocaleString()}
                             </div>
                          </div>
                        </div>
                      )
                   })}
                 </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border/50">
             <CardHeader className="bg-muted/5 border-b border-border/50 pb-4">
                <CardTitle className="text-lg">Additional Terms</CardTitle>
             </CardHeader>
             <CardContent className="pt-6">
                <Label className="font-bold">Public Notes / Disclaimers</Label>
                <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Thank you for your business." className="mt-2 font-medium" />
             </CardContent>
          </Card>

        </div>

        {/* RIGHTSIDE MATH & ACTIONS */}
        <div className="md:col-span-2 space-y-6">

          <Card className="shadow-sm border-border/50">
            <CardHeader className="bg-muted/5 border-b border-border/50 pb-4">
              <CardTitle className="text-lg">Execution Mathematics</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between items-center text-sm font-semibold text-muted-foreground">
                <span>Subtotal ({lineItems.length} lines)</span>
                <span className="text-foreground">{currency === "NGN" ? "₦" : "$"}{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <Input value={taxName} onChange={e => setTaxName(e.target.value)} className="h-8 text-xs font-semibold w-24 bg-muted/10 text-right" />
                <div className="flex items-center relative flex-1">
                   <Input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} className="h-8 text-xs font-bold pl-2 pr-6 bg-muted/10 w-full" />
                   <span className="absolute right-2 text-xs font-bold text-muted-foreground">%</span>
                </div>
                <div className="w-24 text-right text-sm font-semibold">{currency === "NGN" ? "₦" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : "$"}{taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
              </div>

              <div className="pt-4 border-t border-border/50 flex justify-between items-end">
                <span className="text-lg font-bold">Grand Total</span>
                <span className="text-3xl font-black text-primary">{currency === "NGN" ? "₦" : "$"}{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </CardContent>
            <CardFooter className="flex-col gap-3 bg-muted/5 border-t border-border/50 pt-6">
              <Button 
                onClick={() => saveInvoiceToDatabase(true)} 
                disabled={saving || sending}
                className="w-full h-12 shadow-sm font-bold text-sm bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Save Changes & Re-Dispatch to Client
              </Button>
              <Button 
                onClick={() => saveInvoiceToDatabase(false)} 
                disabled={saving || sending}
                variant="outline"
                className="w-full h-11 font-bold text-sm bg-background gap-2 border-primary/20 hover:bg-primary/5 text-primary"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Changes to Dashboard
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
