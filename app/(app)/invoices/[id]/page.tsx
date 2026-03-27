/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Printer, Download, Receipt, LayoutDashboard, Loader2 } from "lucide-react"
import { useReactToPrint } from "react-to-print"
import { PageSkeleton } from "@/components/ui/page-skeleton"

// Import Templates
import Layout1 from "@/components/invoices/templates/layout-1"
import Layout2 from "@/components/invoices/templates/layout-2"
import Layout3 from "@/components/invoices/templates/layout-3"
import Layout4 from "@/components/invoices/templates/layout-4"
import Layout5 from "@/components/invoices/templates/layout-5"
import Layout6 from "@/components/invoices/templates/layout-6"

export default function InvoiceViewerPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const invoiceId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [invoice, setInvoice] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  
  const contentRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({
    contentRef: contentRef,
    documentTitle: invoice?.invoice_number || 'Invoice',
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 0;
      }
      @media print {
        html, body {
          margin: 0;
          padding: 0;
          font-size: 11px !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          background: white !important;
        }
        * {
          box-sizing: border-box;
        }
      }
    `,
  })

  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      // 1. Fetch Invoice Deep Details
      const { data: invData } = await supabase
        .from('invoices')
        .select(`
          *,
          client:profiles!invoices_client_id_fkey(name, company, email, phone)
        `)
        .eq('id', invoiceId)
        .single()
        
      if (!invData && mounted) {
        setLoading(false)
        return
      }

      // Security: Only Admins or the owning Client can view
      if (user?.role === "client" && invData.client_id !== user.id) {
         router.push('/dashboard')
         return
      }

      // 2. Fetch Global Settings (for business details and chosen template id)
      const { data: settsData } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single()

      if (mounted) {
        setInvoice(invData)
        setSettings(settsData)
        setLoading(false)
      }
    }
    fetchData()
    return () => { mounted = false }
  }, [invoiceId, user?.id])

  if (loading) return <PageSkeleton />

  if (!invoice) {
    return (
      <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
        <Receipt className="h-12 w-12 text-muted-foreground opacity-50" />
        <h2 className="text-2xl font-bold tracking-tight">Invoice Not Found</h2>
        <p className="text-muted-foreground">The requested document structural vector could not be resolved.</p>
        <Button onClick={() => router.back()}>Go Back</Button>
      </div>
    )
  }

  const templateProps = {
    invoice: {
      invoiceNo: invoice.invoice_number,
      date: new Date(invoice.issue_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      dueDate: new Date(invoice.due_date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }),
      subTotal: Number(invoice.subtotal),
      taxName: invoice.tax_name || "Tax",
      taxRate: Number(invoice.tax_rate),
      taxAmount: Number(invoice.tax_amount),
      total: Number(invoice.grand_total),
      note: invoice.notes,
      currency: invoice.currency === "NGN" ? "₦" : invoice.currency === "GBP" ? "£" : invoice.currency === "EUR" ? "€" : "$"
    },
    business: {
      name: settings?.business_name || "Noplin Agency",
      logoUrl: settings?.logo_url || null,
      address: settings?.physical_address || "No Address Provided",
      email: settings?.contact_email || "No Email",
      phone: settings?.phone_number || "No Phone",
      signatureUrl: settings?.signature_url || null,
      paymentInfo: (settings?.bank_name || settings?.bank_account_name || settings?.bank_account_number) 
        ? `Bank Name: ${settings?.bank_name || 'N/A'}\nAccount Name: ${settings?.bank_account_name || 'N/A'}\nAccount No: ${settings?.bank_account_number || 'N/A'}`
        : "Bank Name: GTBank\nAccount Name: Noplin\nAccount No: 0000000000"
    },
    client: {
      name: invoice.client?.name || "Client Map Lost",
      address: invoice.client?.address || "Address Not Available",
      email: invoice.client?.email || "Email Not Provided"
    },
    items: invoice.line_items.map((item: any, index: number) => ({
      id: item.id || item.project_id || String(index),
      service: item.service || item.title || "Undefined Service",
      description: item.description,
      budget: Number(item.budget) || 0,
      amount_paid: Number(item.amount_paid) || 0,
      balance: Number(item.balance) || 0
    }))
  }

  const selectedLayout = settings?.invoice_template_id || "layout-1"

  return (
    <div className="flex-1 space-y-6 pt-6 pb-20 w-full max-w-5xl mx-auto px-4 md:px-0 animate-in fade-in duration-500">
      
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-[4.5rem] bg-background/80 backdrop-blur-md z-10 py-4 border-b border-border/50">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-9 w-9">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight font-mono">{invoice.invoice_number}</h1>
            {invoice.status === "paid" && <Badge className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold uppercase tracking-widest text-[10px]">Paid</Badge>}
            {invoice.status === "unpaid" && <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-bold uppercase tracking-widest text-[10px]">Unpaid</Badge>}
            {invoice.status === "overdue" && <Badge className="bg-destructive hover:bg-destructive/90 text-white font-bold uppercase tracking-widest text-[10px]">Overdue</Badge>}
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {user?.role === "admin" && (
            <Button variant="outline" className="shadow-sm font-bold border-border/50 bg-muted/10 h-10 w-full sm:w-auto" asChild>
               <a href={`/invoices/edit/${invoice.id}`}><LayoutDashboard className="h-4 w-4 mr-2" /> Edit</a>
            </Button>
          )}
          <Button onClick={handlePrint} className="shadow-sm shadow-primary/20 space-x-2 font-bold h-10 w-full sm:w-auto">
             <Printer className="h-4 w-4" /> <span>Print / Download PDF</span>
          </Button>
        </div>
      </div>

      {/* A4 Document Native Paper Container */}
      <div className="flex justify-center w-full overflow-x-auto print:overflow-visible print:m-0 py-6">
        
        {/*
          This container mimics A4 Page constraints. 
          When Printing, it natively drops drop-shadows and margins to fill the page cleanly.
        */}
        <div 
          ref={contentRef}
          data-print-area
          className="w-full max-w-[850px] min-h-[1100px] bg-background lg:shadow-xl lg:shadow-black/5 lg:border border-border/50 print:shadow-none print:border-none print:m-0 print:max-w-none print:w-[210mm] print:min-h-0"
        >
           {selectedLayout === "layout-1" && <Layout1 {...templateProps} />}
           {selectedLayout === "layout-2" && <Layout2 {...templateProps} />}
           {selectedLayout === "layout-3" && <Layout3 {...templateProps} />}
           {selectedLayout === "layout-4" && <Layout4 {...templateProps} />}
           {selectedLayout === "layout-5" && <Layout5 {...templateProps} />}
           {selectedLayout === "layout-6" && <Layout6 {...templateProps} />}
           
           {/* Fallback */}
           {!["layout-1", "layout-2", "layout-3", "layout-4", "layout-5", "layout-6"].includes(selectedLayout) && <Layout1 {...templateProps} />}
        </div>
      </div>
      
    </div>
  )
}
