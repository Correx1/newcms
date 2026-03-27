import React from "react"
import { InvoiceTemplateProps } from "../types"

// Layout 4 — Executive Dark: Charcoal sidebar accent with clean white content area
export default function InvoiceLayout4({ invoice, business, client, items }: InvoiceTemplateProps) {
  const cur = invoice.currency || "$"
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const primary = "oklch(0.45 0.15 260)"
  const dark = "#1e293b"

  return (
    <div
      className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto flex font-sans print:shadow-none"
      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", minHeight: "297mm" }}
    >
      {/* Left sidebar */}
      <div className="w-[68mm] flex-shrink-0 flex flex-col py-8 px-6" style={{ background: dark }}>
        {/* Logo / Brand */}
        <div className="mb-8">
          {business.logoUrl
            ? <img src={business.logoUrl} alt={business.name} className="h-10 w-auto object-contain mb-3" />
            : <div className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-white text-lg mb-3" style={{ background: primary }}>{business.name[0]}</div>
          }
          <p className="text-white font-black text-sm tracking-wide">{business.name}</p>
          <p className="text-white/50 text-[10px] mt-0.5 leading-relaxed">{business.email}</p>
          {business.phone && <p className="text-white/50 text-[10px]">{business.phone}</p>}
        </div>

        {/* Divider */}
        <div className="h-px w-full mb-6 opacity-20" style={{ background: "white" }} />

        {/* Invoice Meta */}
        <div className="space-y-4 mb-6">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: primary }}>Invoice No</p>
            <p className="text-white font-black text-sm font-mono">{invoice.invoiceNo}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: primary }}>Issue Date</p>
            <p className="text-white/80 text-[11px] font-semibold">{invoice.date}</p>
          </div>
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest mb-0.5" style={{ color: primary }}>Due Date</p>
            <p className="text-white/80 text-[11px] font-semibold">{invoice.dueDate}</p>
          </div>
        </div>

        <div className="h-px w-full mb-6 opacity-20" style={{ background: "white" }} />

        {/* Bill To */}
        <div className="mb-6">
          <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: primary }}>Billed To</p>
          <p className="text-white font-bold text-sm">{client.name}</p>
          {client.email && <p className="text-white/50 text-[10px] mt-0.5 break-all">{client.email}</p>}
          {client.phone && <p className="text-white/50 text-[10px]">{client.phone}</p>}
        </div>

        <div className="h-px w-full mb-6 opacity-20" style={{ background: "white" }} />

        {/* Payment Info */}
        {business.paymentInfo && (
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: primary }}>Payment Info</p>
            <p className="text-white/60 text-[10px] leading-relaxed whitespace-pre-wrap">{business.paymentInfo}</p>
          </div>
        )}

        {/* Signature at bottom of sidebar */}
        <div className="mt-auto pt-6">
          {business.signatureUrl
            ? <img src={business.signatureUrl} alt="Signature" className="h-10 object-contain mb-1" />
            : <div className="h-8 w-full" />
          }
          <div className="border-t border-white/20 pt-1">
            <p className="text-white/60 text-[9px] font-semibold">Authorized Signature</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col py-8 px-7">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-5xl font-black tracking-tight" style={{ color: primary }}>INVOICE</h1>
          <div className="h-0.5 w-16 mt-2" style={{ background: primary }} />
        </div>

        {/* Table */}
        <div className="flex-1 mb-4">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_70px_80px_80px] text-[9px] font-black uppercase tracking-widest pb-2 mb-2 border-b-2" style={{ borderColor: dark, color: dark }}>
            <div>Service</div>
            <div className="text-center">Budget</div>
            <div className="text-right">Paid</div>
            <div className="text-right">Balance</div>
          </div>

          {items.map((item, idx) => (
            <div key={item.id} className={`grid grid-cols-[1fr_70px_80px_80px] py-2.5 border-b text-[11px] ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/80"}`} style={{ borderColor: "#e2e8f0" }}>
              <div className="pr-2">
                <p className="font-bold text-slate-900">{item.service}</p>
                {item.description && <p className="text-slate-400 text-[10px] mt-0.5">{item.description}</p>}
              </div>
              <div className="text-center text-slate-500 font-semibold tabular-nums">{cur}{fmt(item.budget)}</div>
              <div className="text-right text-slate-700 font-bold tabular-nums">{cur}{fmt(item.amount_paid)}</div>
              <div className="text-right font-black tabular-nums" style={{ color: primary }}>{cur}{fmt(item.balance)}</div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="ml-auto w-[170px] space-y-1.5 mb-4">
          <div className="flex justify-between text-[11px] border-b border-slate-100 pb-1">
            <span className="text-slate-500 font-semibold">Subtotal</span>
            <span className="font-bold">{cur}{fmt(invoice.subTotal)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="flex justify-between text-[11px] border-b border-slate-100 pb-1">
              <span className="text-slate-500">{invoice.taxName || "Tax"} {invoice.taxRate ? `${invoice.taxRate}%` : ""}</span>
              <span className="font-semibold">{cur}{fmt(invoice.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center px-3 py-2 rounded-md" style={{ background: primary, color: "white" }}>
            <span className="font-black text-[11px] uppercase">Total</span>
            <span className="font-black text-base">{cur}{fmt(invoice.total)}</span>
          </div>
        </div>

        {/* Note */}
        {invoice.note && (
          <p className="text-[10px] text-slate-400 italic border-t border-slate-100 pt-3 mt-auto">{invoice.note}</p>
        )}
      </div>
    </div>
  )
}
