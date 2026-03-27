import React from "react"
import { InvoiceTemplateProps } from "../types"

export default function InvoiceLayout2({ invoice, business, client, items }: InvoiceTemplateProps) {
  const cur = invoice.currency || "$"
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const primaryBg = "oklch(0.45 0.15 260)"
  const primaryLight = "oklch(0.45 0.15 260 / 0.08)"
  const primaryBorder = "oklch(0.45 0.15 260 / 0.2)"

  return (
    <div className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto flex flex-col font-sans print:shadow-none" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>

      {/* Deep primary header */}
      <div className="flex justify-between items-start px-10 py-8" style={{ background: primaryBg }}>
        <div>
          <h1 className="text-4xl font-black uppercase tracking-widest text-white mb-1">Invoice</h1>
          <p className="text-[11px] text-white/70 font-mono">{invoice.invoiceNo}</p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          {business.logoUrl
            ? <img src={business.logoUrl} alt={business.name} className="h-12 w-auto object-contain" />
            : <p className="text-white font-black text-xl">{business.name}</p>
          }
          <p className="text-[11px] text-white/70 max-w-[200px] leading-snug text-right whitespace-pre-wrap">{business.address}</p>
        </div>
      </div>

      {/* Balance Due Banner */}
      <div className="flex justify-between items-center px-10 py-2.5 border-b" style={{ background: primaryLight, borderColor: primaryBorder }}>
        <div className="text-[11px] space-y-0.5">
          <div className="flex gap-6">
            <span className="text-slate-500">Issue Date:</span><span className="font-bold text-slate-800">{invoice.date}</span>
          </div>
          <div className="flex gap-8">
            <span className="text-slate-500">Due Date:</span><span className="font-bold text-slate-800">{invoice.dueDate}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Balance Due</p>
          <p className="text-2xl font-black" style={{ color: primaryBg }}>{cur}{fmt(invoice.total)}</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="px-10 pt-6 pb-4">
        <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: primaryBg }}>Billed To</p>
        <p className="font-black text-slate-900">{client.name}</p>
        {client.email && <p className="text-[11px] text-slate-500 mt-0.5">{client.email}</p>}
        {client.phone && <p className="text-[11px] text-slate-500">{client.phone}</p>}
      </div>

      {/* Items Table */}
      <div className="px-10 mb-4 flex-1">
        <div className="grid grid-cols-[1fr_90px_100px_100px] text-[10px] font-black uppercase tracking-widest px-3 py-2.5 rounded-md" style={{ background: "oklch(0.15 0.02 260)", color: "white" }}>
          <div>Service</div>
          <div className="text-center">Budget</div>
          <div className="text-right">Paid</div>
          <div className="text-right">Balance</div>
        </div>

        {items.map((item) => (
          <div key={item.id} className="grid grid-cols-[1fr_90px_100px_100px] py-3 border-b border-slate-100 text-[11px]">
            <div className="pr-3">
              <p className="font-bold text-slate-900">{item.service}</p>
              {item.description && <p className="text-slate-400 mt-0.5 leading-relaxed">{item.description}</p>}
            </div>
            <div className="text-center text-slate-600 font-semibold tabular-nums">{cur}{fmt(item.budget)}</div>
            <div className="text-right text-slate-700 font-bold tabular-nums">{cur}{fmt(item.amount_paid)}</div>
            <div className="text-right font-black tabular-nums" style={{ color: primaryBg }}>{cur}{fmt(item.balance)}</div>
          </div>
        ))}
      </div>

      {/* Totals + Note */}
      <div className="grid grid-cols-[1fr_220px] gap-6 px-10 mb-4">
        <div>
          {invoice.note && (
            <div className="mb-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Note</p>
              <p className="text-[11px] text-slate-500 leading-relaxed italic whitespace-pre-wrap">{invoice.note}</p>
            </div>
          )}
          {business.paymentInfo && (
            <div className="p-3 rounded-md" style={{ background: primaryLight, border: `1px solid ${primaryBorder}` }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 mb-1">Payment Information</p>
              <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">{business.paymentInfo}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[11px] border-b border-slate-100 pb-1.5">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Subtotal</span>
            <span className="font-bold text-slate-800">{cur}{fmt(invoice.subTotal)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="flex justify-between text-[11px] border-b border-slate-100 pb-1.5">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{invoice.taxName || "Tax"}{invoice.taxRate ? ` ${invoice.taxRate}%` : ""}</span>
              <span className="font-semibold text-slate-700">{cur}{fmt(invoice.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center px-3 py-2 rounded-md" style={{ background: primaryBg, color: "white" }}>
            <span className="font-black uppercase tracking-wide text-sm">Total</span>
            <span className="font-black text-lg">{cur}{fmt(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Signature */}
      <div className="px-10 pt-4 border-t border-slate-100 flex justify-between items-end mb-4">
        <div className="text-[10px] text-slate-400 space-y-0.5">
          <p className="font-bold text-slate-600">{business.name}</p>
          <p>{business.email}</p>
          {business.phone && <p>{business.phone}</p>}
        </div>
        <div className="flex flex-col items-center w-[160px]">
          {business.signatureUrl
            ? <img src={business.signatureUrl} alt="Signature" className="h-12 object-contain mb-1" />
            : <div className="h-10 w-full" />
          }
          <div className="w-full border-t border-slate-300 pt-1 text-center">
            <p className="text-[10px] font-bold text-slate-600">Authorized Signature</p>
            <p className="text-[10px] text-slate-400">{business.name}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto h-2" style={{ background: primaryBg }} />
    </div>
  )
}
