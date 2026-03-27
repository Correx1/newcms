import React from "react"
import { InvoiceTemplateProps } from "../types"

// Layout 5 — Elegant Split: Diagonal accent divider, premium feel with large typography
export default function InvoiceLayout5({ invoice, business, client, items }: InvoiceTemplateProps) {
  const cur = invoice.currency || "$"
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const primary = "oklch(0.45 0.15 260)"
  const primarySoft = "oklch(0.45 0.15 260 / 0.07)"

  return (
    <div
      className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto flex flex-col font-sans print:shadow-none"
      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", minHeight: "297mm" }}
    >
      {/* Hero Header */}
      <div className="relative overflow-hidden" style={{ background: primarySoft }}>
        <div className="px-10 pt-8 pb-6 flex justify-between items-start relative z-10">
          <div>
            {business.logoUrl
              ? <img src={business.logoUrl} alt={business.name} className="h-10 w-auto object-contain mb-2" />
              : <p className="font-black text-2xl tracking-tight mb-1" style={{ color: primary }}>{business.name}</p>
            }
            <p className="text-[11px] text-slate-500">{business.address}</p>
          </div>
          <div className="text-right">
            <h1 className="text-4xl font-black tracking-tight" style={{ color: primary }}>INVOICE</h1>
            <p className="text-[11px] font-mono font-bold text-slate-500 mt-1">{invoice.invoiceNo}</p>
          </div>
        </div>
        {/* Diagonal clip bottom accent */}
        <div className="h-4 w-full" style={{ background: primary, clipPath: "polygon(0 0, 100% 0, 100% 0, 0 100%)" }} />
      </div>

      {/* Meta Row */}
      <div className="grid grid-cols-3 px-10 py-4 border-b border-slate-100 text-[11px]">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Issue Date</p>
          <p className="font-bold text-slate-800">{invoice.date}</p>
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Due Date</p>
          <p className="font-bold text-slate-800">{invoice.dueDate}</p>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Amount Due</p>
          <p className="text-xl font-black" style={{ color: primary }}>{cur}{fmt(invoice.total)}</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="px-10 py-4 border-b border-slate-100">
        <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: primary }}>Billed To</p>
        <p className="font-black text-slate-900">{client.name}</p>
        {client.email && <p className="text-[11px] text-slate-500">{client.email}</p>}
        {client.phone && <p className="text-[11px] text-slate-500">{client.phone}</p>}
      </div>

      {/* Items */}
      <div className="px-10 pt-4 flex-1">
        <div className="grid grid-cols-[1fr_80px_90px_90px] text-[9px] font-black uppercase tracking-widest pb-2 border-b-2" style={{ borderColor: "oklch(0.45 0.15 260)", color: "oklch(0.45 0.15 260)" }}>
          <div>Description</div>
          <div className="text-center">Budget</div>
          <div className="text-right">Paid</div>
          <div className="text-right">Balance</div>
        </div>

        {items.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-[1fr_80px_90px_90px] py-3 border-b border-slate-100 text-[11px]">
            <div className="pr-3">
              <p className="font-bold text-slate-900">{item.service}</p>
              {item.description && <p className="text-slate-400 text-[10px] mt-0.5">{item.description}</p>}
            </div>
            <div className="text-center text-slate-500 font-semibold tabular-nums">{cur}{fmt(item.budget)}</div>
            <div className="text-right text-slate-700 font-bold tabular-nums">{cur}{fmt(item.amount_paid)}</div>
            <div className="text-right font-black tabular-nums" style={{ color: primary }}>{cur}{fmt(item.balance)}</div>
          </div>
        ))}
      </div>

      {/* Totals + Footer */}
      <div className="px-10 pt-4 pb-6">
        <div className="flex justify-between items-start">
          {/* Left: note + payment */}
          <div className="w-[55%] space-y-3">
            {invoice.note && (
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Note</p>
                <p className="text-[11px] text-slate-400 italic">{invoice.note}</p>
              </div>
            )}
            {business.paymentInfo && (
              <div className="p-3 rounded-lg" style={{ background: primarySoft }}>
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-600 mb-1">Payment Details</p>
                <p className="text-[10px] text-slate-600 whitespace-pre-wrap leading-relaxed">{business.paymentInfo}</p>
              </div>
            )}
          </div>

          {/* Right: totals */}
          <div className="w-[180px] space-y-1.5">
            <div className="flex justify-between text-[11px] pb-1 border-b border-slate-100">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-bold">{cur}{fmt(invoice.subTotal)}</span>
            </div>
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between text-[11px] pb-1 border-b border-slate-100">
                <span className="text-slate-500">{invoice.taxName || "Tax"}{invoice.taxRate ? ` ${invoice.taxRate}%` : ""}</span>
                <span className="font-semibold">{cur}{fmt(invoice.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between px-3 py-2 rounded-lg items-center" style={{ background: primary, color: "white" }}>
              <span className="font-black text-[11px] uppercase">Total</span>
              <span className="font-black text-base">{cur}{fmt(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Signature + contact */}
        <div className="flex justify-between items-end mt-6 pt-4 border-t border-slate-100">
          <div className="text-[10px] text-slate-400 space-y-0.5">
            <p className="font-bold text-slate-600">{business.name}</p>
            <p>{business.email}</p>
            {business.phone && <p>{business.phone}</p>}
          </div>
          <div className="flex flex-col items-center w-[150px]">
            {business.signatureUrl
              ? <img src={business.signatureUrl} alt="Signature" className="h-10 object-contain mb-1" />
              : <div className="h-8 w-full" />
            }
            <div className="border-t border-slate-300 pt-1 text-center w-full">
              <p className="text-[9px] font-bold text-slate-500">Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom accent bar */}
      <div className="h-1.5 mt-auto" style={{ background: `linear-gradient(to right, ${primary}, oklch(0.65 0.15 260))` }} />
    </div>
  )
}
