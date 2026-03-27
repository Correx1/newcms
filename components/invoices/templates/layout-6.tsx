import React from "react"
import { InvoiceTemplateProps } from "../types"

// Layout 6 — Studio Bold: Large hero total, full-width color band, circle brand mark
export default function InvoiceLayout6({ invoice, business, client, items }: InvoiceTemplateProps) {
  const cur = invoice.currency || "$"
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const primary = "oklch(0.45 0.15 260)"
  const primaryDark = "oklch(0.30 0.12 260)"

  return (
    <div
      className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto flex flex-col font-sans print:shadow-none"
      style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact", minHeight: "297mm" }}
    >
      {/* Full-width hero header */}
      <div className="px-10 py-7 flex justify-between items-center" style={{ background: primary }}>
        <div className="flex items-center gap-3">
          {business.logoUrl
            ? <img src={business.logoUrl} alt={business.name} className="h-10 w-auto object-contain" />
            : (
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-xl border-2 border-white/30" style={{ background: primaryDark }}>
                <span className="text-white">{business.name[0]}</span>
              </div>
            )
          }
          <div>
            <p className="text-white font-black text-sm tracking-wide">{business.name}</p>
            <p className="text-white/60 text-[10px]">{business.email}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white/70 text-[10px] uppercase tracking-widest font-bold">Invoice</p>
          <p className="text-white font-black text-lg font-mono">{invoice.invoiceNo}</p>
        </div>
      </div>

      {/* Amount Due Hero Band */}
      <div className="px-10 py-4 flex justify-between items-center" style={{ background: primaryDark }}>
        <div className="text-white/70 text-[10px] space-y-0.5">
          <p>Issue: <span className="text-white font-bold">{invoice.date}</span></p>
          <p>Due: <span className="text-white font-bold">{invoice.dueDate}</span></p>
        </div>
        <div className="text-right">
          <p className="text-white/60 text-[9px] uppercase tracking-widest">Amount Due</p>
          <p className="text-white font-black text-3xl">{cur}{fmt(invoice.total)}</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="grid grid-cols-2 gap-6 px-10 py-5 border-b border-slate-100">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: primary }}>From</p>
          <p className="font-bold text-slate-800 text-sm">{business.name}</p>
          <p className="text-[11px] text-slate-500">{business.email}</p>
          {business.phone && <p className="text-[11px] text-slate-500">{business.phone}</p>}
        </div>
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest mb-1" style={{ color: primary }}>Billed To</p>
          <p className="font-bold text-slate-800 text-sm">{client.name}</p>
          {client.email && <p className="text-[11px] text-slate-500">{client.email}</p>}
          {client.phone && <p className="text-[11px] text-slate-500">{client.phone}</p>}
        </div>
      </div>

      {/* Services table */}
      <div className="px-10 pt-4 flex-1">
        <div className="rounded-xl overflow-hidden border border-slate-100">
          <div className="grid grid-cols-[1fr_80px_90px_90px] px-4 py-2.5 text-[9px] font-black uppercase tracking-widest" style={{ background: primary, color: "white" }}>
            <div>Service</div>
            <div className="text-center">Budget</div>
            <div className="text-right">Paid</div>
            <div className="text-right">Balance</div>
          </div>
          {items.map((item, idx) => (
            <div key={item.id} className={`grid grid-cols-[1fr_80px_90px_90px] px-4 py-3 text-[11px] border-t border-slate-100 ${idx % 2 === 1 ? "bg-slate-50/50" : ""}`}>
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
      </div>

      {/* Bottom section */}
      <div className="px-10 pt-4 pb-6">
        <div className="flex justify-between items-start gap-6">
          {/* Payment + note */}
          <div className="flex-1 space-y-3">
            {business.paymentInfo && (
              <div className="p-3 rounded-lg border border-slate-100 bg-slate-50/50">
                <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Payment Details</p>
                <p className="text-[10px] text-slate-600 whitespace-pre-wrap leading-relaxed">{business.paymentInfo}</p>
              </div>
            )}
            {invoice.note && <p className="text-[10px] text-slate-400 italic">{invoice.note}</p>}
          </div>

          {/* Totals */}
          <div className="w-[170px] space-y-1.5">
            <div className="flex justify-between text-[11px] border-b border-slate-100 pb-1">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-bold">{cur}{fmt(invoice.subTotal)}</span>
            </div>
            {invoice.taxAmount > 0 && (
              <div className="flex justify-between text-[11px] border-b border-slate-100 pb-1">
                <span className="text-slate-500">{invoice.taxName || "Tax"}{invoice.taxRate ? ` ${invoice.taxRate}%` : ""}</span>
                <span className="font-semibold">{cur}{fmt(invoice.taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between px-3 py-2 rounded-lg" style={{ background: primary, color: "white" }}>
              <span className="font-black text-[11px] uppercase">Total</span>
              <span className="font-black text-base">{cur}{fmt(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Signature */}
        <div className="flex justify-between items-end mt-5 pt-4 border-t border-slate-100">
          <div className="text-[10px] text-slate-400">
            <p className="font-bold text-slate-600">{business.name}</p>
            <p>{business.address?.split("\n")[0]}</p>
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
    </div>
  )
}
