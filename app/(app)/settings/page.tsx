"use client"

import { useState, useEffect } from "react"
import { Save, Loader2, ShieldCheck, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import InvoiceLayout1 from "@/components/invoices/templates/layout-1"
import InvoiceLayout2 from "@/components/invoices/templates/layout-2"
import InvoiceLayout3 from "@/components/invoices/templates/layout-3"
import InvoiceLayout4 from "@/components/invoices/templates/layout-4"
import InvoiceLayout5 from "@/components/invoices/templates/layout-5"
import InvoiceLayout6 from "@/components/invoices/templates/layout-6"

const MOCK_INVOICE_DATA = {
  invoice: {
    invoiceNo: "INV-2026-001",
    date: "Mar 27, 2026",
    dueDate: "Apr 10, 2026",
    subTotal: 2500,
    taxName: "VAT",
    taxRate: 10,
    taxAmount: 250,
    total: 2750,
    note: "Thank you for your business!",
    terms: "Payment is due within 14 days."
  },
  business: {
    name: "Noplin CMS",
    address: "123 Innovation Drive\nSan Francisco, CA 94103",
    email: "billing@noplincms.com",
    phone: "+1 (555) 123-4567",
    paymentInfo: "Bank of Internet\nAccount: 000123456789\nRouting: 987654321"
  },
  client: {
    name: "Acme Corporation",
    address: "456 Enterprise Way\nNew York, NY 10001",
    email: "accounts@acme.com"
  },
  items: [
    { id: "1", service: "Enterprise Web App", description: "Frontend & Backend Development", budget: 1500, amount_paid: 1500, balance: 0 },
    { id: "2", service: "Technical SEO", description: "Optimization & Indexing", budget: 1000, amount_paid: 0, balance: 1000 }
  ]
}

export default function SettingsHub() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  const [settings, setSettings] = useState({
    business_name: "",
    logo_url: "",
    contact_email: "",
    phone_number: "",
    physical_address: "",
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    signature_url: "",
    ai_provider: "google",
    ai_model_selection: "gemini-2.5-flash",
    ai_api_key_override: "",
    ai_prompt_overview: "",
    ai_prompt_deliverables: "",
    ai_prompt_kanban_tasks: "",
    invoice_template_id: "layout-1",
    resend_api_key: "",
    resend_sender_identity: "",
    resend_reply_domain: ""
  })

  const [uploadingField, setUploadingField] = useState<string | null>(null)

  const supabase = createClient()

  useEffect(() => {
    checkAuthAndFetch()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'logo_url' | 'signature_url') => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingField(field)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${field}_${Date.now()}.${ext}`
      
      const { data, error } = await supabase.storage
        .from('brand_assets')
        .upload(fileName, file)

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('brand_assets')
        .getPublicUrl(data.path)

      setSettings(prev => ({ ...prev, [field]: publicUrl }))
      toast.success("Image uploaded successfully!")
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to upload image")
    } finally {
      setUploadingField(null)
    }
  }

  const checkAuthAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role === 'admin') {
      setIsAdmin(true)
      fetchSettings()
    } else {
      setLoading(false)
    }
  }

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings')
      if (res.ok) {
        const { settings: dbSettings } = await res.json()
        if (dbSettings) {
          setSettings({
            ...dbSettings,
            business_name: dbSettings.business_name || "",
            logo_url: dbSettings.logo_url || "",
            contact_email: dbSettings.contact_email || "",
            phone_number: dbSettings.phone_number || "",
            physical_address: dbSettings.physical_address || "",
            bank_name: dbSettings.bank_name || "",
            bank_account_name: dbSettings.bank_account_name || "",
            bank_account_number: dbSettings.bank_account_number || "",
            signature_url: dbSettings.signature_url || "",
            ai_provider: dbSettings.ai_provider || "google",
            ai_model_selection: dbSettings.ai_model_selection || "gemini-2.5-flash",
            ai_api_key_override: dbSettings.ai_api_key_override || "",
            ai_prompt_overview: dbSettings.ai_prompt_overview || "",
            ai_prompt_deliverables: dbSettings.ai_prompt_deliverables || "",
            ai_prompt_kanban_tasks: dbSettings.ai_prompt_kanban_tasks || "",
            invoice_template_id: dbSettings.invoice_template_id || "layout-1",
            resend_api_key: dbSettings.resend_api_key || "",
            resend_sender_identity: dbSettings.resend_sender_identity || "",
            resend_reply_domain: dbSettings.resend_reply_domain || ""
          })
        }
      }
    } catch (e) {
      toast.error("Failed to load settings")
    } finally {
      setLoading(false)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    const t = toast.loading("Saving settings...")
    
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      })

      if (res.ok) {
        toast.dismiss(t)
        toast.success("Settings saved successfully!")
      } else {
        const err = await res.json()
        toast.dismiss(t)
        toast.error(err.error || "Failed to save settings")
      }
    } catch (e) {
      toast.dismiss(t)
      toast.error("An unexpected error occurred")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[80vh] items-center justify-center flex-col gap-4 text-center px-4">
        <ShieldCheck className="h-12 w-12 text-destructive" />
        <h2 className="text-2xl font-bold tracking-tight">Access Restricted</h2>
        <p className="text-muted-foreground max-w-md">Global system configurations are strictly locked to administrators.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground">Manage your application configurations and AI endpoints.</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={saveSettings} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-muted/50 w-full justify-start rounded-md h-auto p-1 overflow-x-auto flex-nowrap">
          <TabsTrigger value="general" className="rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm px-6 py-2">General</TabsTrigger>
          <TabsTrigger value="ai" className="rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm px-6 py-2">AI Configuration</TabsTrigger>
          <TabsTrigger value="email" className="rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm px-6 py-2">Email Engine</TabsTrigger>
          <TabsTrigger value="invoice" className="rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm px-6 py-2">Invoice Templates</TabsTrigger>
        </TabsList>
        
        {/* =================== GENERAL TAB =================== */}
        <TabsContent value="general" className="space-y-4">
          <Card className="border-muted shadow-none">
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>Update your company identity and contact details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input 
                    placeholder="Acme Corp" 
                    value={settings.business_name}
                    onChange={(e) => setSettings({...settings, business_name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contact Email</Label>
                  <Input 
                    type="email" 
                    placeholder="hello@company.com" 
                    value={settings.contact_email}
                    onChange={(e) => setSettings({...settings, contact_email: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <Input 
                    placeholder="+1 (555) 000-0000" 
                    value={settings.phone_number}
                    onChange={(e) => setSettings({...settings, phone_number: e.target.value})}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Physical Address</Label>
                  <Textarea 
                    placeholder="123 Corporate Blvd, Suite 400" 
                    className="min-h-[100px]"
                    value={settings.physical_address}
                    onChange={(e) => setSettings({...settings, physical_address: e.target.value})}
                  />
                </div>
                <div className="space-y-4 md:col-span-2 p-4 border rounded-md bg-muted/20">
                  <h3 className="font-bold text-sm">Bank & Payment Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Bank Name</Label>
                      <Input 
                        placeholder="e.g. GTBank" 
                        value={settings.bank_name}
                        onChange={(e) => setSettings({...settings, bank_name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Name</Label>
                      <Input 
                        placeholder="e.g. Noplin Agency" 
                        value={settings.bank_account_name}
                        onChange={(e) => setSettings({...settings, bank_account_name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Account Number</Label>
                      <Input 
                        placeholder="e.g. 0123456789" 
                        value={settings.bank_account_number}
                        onChange={(e) => setSettings({...settings, bank_account_number: e.target.value})}
                      />
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <Label>Business Logo</Label>
                  <div className="flex flex-col gap-3">
                    {settings.logo_url && <img src={settings.logo_url} className="h-16 w-max object-contain border p-2 rounded-md bg-white shadow-sm" alt="Logo Preview" />}
                    <Input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'logo_url')}
                      disabled={uploadingField === 'logo_url'}
                    />
                    {uploadingField === 'logo_url' && <span className="text-xs text-muted-foreground animate-pulse">Uploading Image...</span>}
                  </div>
                </div>
                <div className="space-y-4">
                  <Label>Authorised Signature</Label>
                  <div className="flex flex-col gap-3">
                    {settings.signature_url && <img src={settings.signature_url} className="h-16 w-max object-contain border p-2 rounded-md bg-white shadow-sm" alt="Signature Preview" />}
                    <Input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'signature_url')}
                      disabled={uploadingField === 'signature_url'}
                    />
                    {uploadingField === 'signature_url' && <span className="text-xs text-muted-foreground animate-pulse">Uploading Image...</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* =================== AI TAB =================== */}
        <TabsContent value="ai" className="space-y-4">
          <Card className="border-muted shadow-none">
            <CardHeader>
              <CardTitle>AI Provider Settings</CardTitle>
              <CardDescription>Define exactly which global large language model drives the CMS.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Service Provider</Label>
                <Select value={settings.ai_provider} onValueChange={(v) => setSettings({...settings, ai_provider: v || settings.ai_provider})}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google (Gemini)</SelectItem>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="openai">OpenAI (ChatGPT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Model Identifier</Label>
                <Input 
                  placeholder="gemini-2.5-flash"
                  value={settings.ai_model_selection}
                  onChange={(e) => setSettings({...settings, ai_model_selection: e.target.value})}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>API Key Override (Optional)</Label>
                <Input 
                  type="password" 
                  placeholder="Defaults to server environment variables if blank"
                  value={settings.ai_api_key_override}
                  onChange={(e) => setSettings({...settings, ai_api_key_override: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-muted shadow-none">
            <CardHeader>
              <CardTitle>System Prompts</CardTitle>
              <CardDescription>Configure the strict instructions pushed to the AI during autonomous generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Short Brief to Professional Overview</Label>
                <Textarea 
                  className="min-h-[120px] font-mono text-sm leading-relaxed"
                  value={settings.ai_prompt_overview}
                  onChange={(e) => setSettings({...settings, ai_prompt_overview: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Overview to Deliverables Output</Label>
                <Textarea 
                  className="min-h-[120px] font-mono text-sm leading-relaxed"
                  value={settings.ai_prompt_deliverables}
                  onChange={(e) => setSettings({...settings, ai_prompt_deliverables: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Overview to Kanban Tasks Automation</Label>
                <Textarea 
                  className="min-h-[120px] font-mono text-sm leading-relaxed"
                  value={settings.ai_prompt_kanban_tasks}
                  onChange={(e) => setSettings({...settings, ai_prompt_kanban_tasks: e.target.value})}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        {/* =================== EMAIL ENGINE TAB =================== */}
        <TabsContent value="email" className="space-y-4">
          <Card className="border-muted shadow-none">
            <CardHeader>
              <CardTitle>Email & CRM Configuration</CardTitle>
              <CardDescription>Setup Resend to natively send and receive functional emails directly to Leads.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2 max-w-lg">
                <Label>Resend API Key</Label>
                <div className="flex relative">
                   <Input 
                     type="password"
                     placeholder="re_..." 
                     value={settings.resend_api_key}
                     onChange={(e) => setSettings({...settings, resend_api_key: e.target.value})}
                     className="font-mono text-sm"
                   />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Keep this private. It gives the CMS power to construct and send real emails.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                <div className="space-y-2">
                  <Label>Sender Identity</Label>
                  <Input 
                    placeholder="E.g., Noplin Team <hello@noplincms.com>" 
                    value={settings.resend_sender_identity}
                    onChange={(e) => setSettings({...settings, resend_sender_identity: e.target.value})}
                  />
                  <p className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider">Default Outbound Mask</p>
                </div>
                
                <div className="space-y-2">
                  <Label>Inbound Subdomain</Label>
                  <Input 
                    placeholder="E.g., reply.noplincms.com" 
                    value={settings.resend_reply_domain}
                    onChange={(e) => setSettings({...settings, resend_reply_domain: e.target.value})}
                  />
                  <p className="text-[10px] text-muted-foreground/80 font-bold uppercase tracking-wider">Required for Syncing Client Replies</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== INVOICE TAB =================== */}
        <TabsContent value="invoice" className="space-y-4">
          <Card className="border-muted shadow-none">
            <CardHeader>
              <CardTitle>Invoice Themes</CardTitle>
              <CardDescription>Select the PDF visual structure used for client billing.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[
                  { id: 'layout-1', name: 'Clean Minimal', desc: 'Sleek whitespace with top/bottom accent bars.' },
                  { id: 'layout-2', name: 'Classic Corporate', desc: 'Deep primary header with a balance-due banner.' },
                  { id: 'layout-3', name: 'Vivid Modern', desc: 'Striking split header for high-end digital agencies.' },
                  { id: 'layout-4', name: 'Executive Dark', desc: 'Charcoal sidebar with meta info + white content area.' },
                  { id: 'layout-5', name: 'Elegant Split', desc: 'Diagonal clip accent with premium large typography.' },
                  { id: 'layout-6', name: 'Studio Bold', desc: 'Full-width hero header and large amount-due display.' },
                ].map((tpl, i) => (
                  <div 
                    key={tpl.id}
                    onClick={() => setSettings({...settings, invoice_template_id: tpl.id})}
                    className={`cursor-pointer rounded-xl border transition-all overflow-hidden flex flex-col group ${
                      settings.invoice_template_id === tpl.id 
                        ? 'border-primary ring-2 ring-primary/50 shadow-md scale-[1.02]' 
                        : 'border-border hover:border-primary/40 text-muted-foreground hover:shadow-sm'
                    }`}
                  >
                     <div className="w-full h-[320px] bg-slate-100/50 relative overflow-hidden flex items-start justify-center pt-6 border-b pointer-events-none">
                        <div className="origin-top scale-[0.32] w-[210mm] shadow-2xl bg-white transition-transform duration-500 ease-out group-hover:scale-[0.34]">
                           {tpl.id === 'layout-1' && <InvoiceLayout1 {...MOCK_INVOICE_DATA} invoice={{...MOCK_INVOICE_DATA.invoice, invoiceNo: `INV-2400${i+1}`}} />}
                           {tpl.id === 'layout-2' && <InvoiceLayout2 {...MOCK_INVOICE_DATA} invoice={{...MOCK_INVOICE_DATA.invoice, invoiceNo: `INV-2400${i+1}`}} />}
                           {tpl.id === 'layout-3' && <InvoiceLayout3 {...MOCK_INVOICE_DATA} invoice={{...MOCK_INVOICE_DATA.invoice, invoiceNo: `INV-2400${i+1}`}} />}
                           {tpl.id === 'layout-4' && <InvoiceLayout4 {...MOCK_INVOICE_DATA} invoice={{...MOCK_INVOICE_DATA.invoice, invoiceNo: `INV-2400${i+1}`}} />}
                           {tpl.id === 'layout-5' && <InvoiceLayout5 {...MOCK_INVOICE_DATA} invoice={{...MOCK_INVOICE_DATA.invoice, invoiceNo: `INV-2400${i+1}`}} />}
                           {tpl.id === 'layout-6' && <InvoiceLayout6 {...MOCK_INVOICE_DATA} invoice={{...MOCK_INVOICE_DATA.invoice, invoiceNo: `INV-2400${i+1}`}} />}
                        </div>
                     </div>
                     <div className="p-4 bg-card flex flex-col items-center text-center mt-auto">
                       <h3 className={`font-bold text-base ${settings.invoice_template_id === tpl.id ? 'text-primary' : 'text-foreground'}`}>{tpl.name}</h3>
                       <p className="text-xs mt-1 leading-snug">{tpl.desc}</p>
                       {settings.invoice_template_id === tpl.id && (
                          <div className="mt-3 bg-primary/10 text-primary text-[10px] uppercase tracking-wider font-extrabold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-sm">
                             <CheckCircle2 className="w-3.5 h-3.5" /> Active Template
                          </div>
                       )}
                     </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
