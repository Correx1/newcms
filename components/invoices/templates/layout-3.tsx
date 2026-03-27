import React from "react"
import { InvoiceTemplateProps } from "../types"

export default function InvoiceLayout3({ invoice, business, client, items }: InvoiceTemplateProps) {
  const cur = invoice.currency || "$"
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const primary = "oklch(0.45 0.15 260)"
  const primaryLight = "oklch(0.45 0.15 260 / 0.08)"

  return (
    <div className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto flex flex-col font-sans print:shadow-none overflow-hidden" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>

      {/* Top split accent bar */}
      <div className="flex w-full">
        <div className="flex-1 h-2" style={{ background: primary }} />
        <div className="w-12 h-2 bg-slate-200" />
      </div>

      {/* Header */}
      <div className="flex items-stretch">
        {/* Left - Invoice label + meta */}
        <div className="px-10 pt-8 pb-5 flex-1">
          <h1 className="text-5xl font-black tracking-tight uppercase mb-3" style={{ color: primary }}>INVOICE</h1>
          <div className="space-y-0.5 text-[11px]">
            <div className="flex gap-4">
              <span className="text-slate-500 w-24 shrink-0">Invoice No:</span>
              <span className="font-black text-slate-800 font-mono">{invoice.invoiceNo}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-500 w-24 shrink-0">Issue Date:</span>
              <span className="font-bold text-slate-800">{invoice.date}</span>
            </div>
            <div className="flex gap-4">
              <span className="text-slate-500 w-24 shrink-0">Due Date:</span>
              <span className="font-bold text-slate-800">{invoice.dueDate}</span>
            </div>
          </div>
        </div>

        {/* Right - Brand panel */}
        <div className="w-[45%] flex flex-col items-center justify-center py-6 px-8" style={{ background: "oklch(0.15 0.02 260)" }}>
          {business.logoUrl
            ? <img src={business.logoUrl} alt={business.name} className="h-12 w-auto object-contain mb-2" />
            : <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-xl mb-2" style={{ background: primary }}>{business.name[0]}</div>
          }
          <p className="text-white font-black text-sm tracking-wider uppercase">{business.name}</p>
          <p className="text-white/50 text-[10px] mt-0.5">{business.email}</p>
        </div>
      </div>

      {/* Bill To */}
      <div className="px-10 py-4 border-y border-slate-100" style={{ background: primaryLight }}>
        <div className="flex justify-between items-start">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: primary }}>Billed To</p>
            <p className="font-black text-slate-900">{client.name}</p>
            {client.email && <p className="text-[11px] text-slate-500">{client.email}</p>}
            {client.phone && <p className="text-[11px] text-slate-500">{client.phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Amount Due</p>
            <p className="text-2xl font-black" style={{ color: primary }}>{cur}{fmt(invoice.total)}</p>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="px-10 pt-4 pb-3 flex-1">
        <div className="grid grid-cols-[40px_1fr_90px_100px_100px] text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-md mb-1" style={{ background: primary, color: "white" }}>
          <div>#</div>
          <div>Service</div>
          <div className="text-center">Budget</div>
          <div className="text-right">Paid</div>
          <div className="text-right">Balance</div>
        </div>

        <div className="rounded-md overflow-hidden border border-slate-100">
          {items.map((item, idx) => (
            <div key={item.id} className={`grid grid-cols-[40px_1fr_90px_100px_100px] px-3 py-3 text-[11px] border-b border-slate-100 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
              <div className="text-slate-400 font-bold">{String(idx + 1).padStart(2, "0")}</div>
              <div className="pr-3">
                <p className="font-bold text-slate-900">{item.service}</p>
                {item.description && <p className="text-slate-400 mt-0.5 text-[10px]">{item.description}</p>}
              </div>
              <div className="text-center text-slate-600 font-semibold tabular-nums">{cur}{fmt(item.budget)}</div>
              <div className="text-right text-slate-700 font-bold tabular-nums">{cur}{fmt(item.amount_paid)}</div>
              <div className="text-right font-black tabular-nums" style={{ color: primary }}>{cur}{fmt(item.balance)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Totals + Payment + Note */}
      <div className="grid grid-cols-[1fr_210px] gap-6 px-10 mb-4">
        <div className="space-y-3">
          {business.paymentInfo && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Payment Details</p>
              <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-wrap">{business.paymentInfo}</p>
            </div>
          )}
          {invoice.note && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-600 mb-1">Note</p>
              <p className="text-[11px] text-slate-500 italic whitespace-pre-wrap">{invoice.note}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[11px] border-b border-slate-100 pb-1.5">
            <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Subtotal</span>
            <span className="font-bold">{cur}{fmt(invoice.subTotal)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="flex justify-between text-[11px] border-b border-slate-100 pb-1.5">
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{invoice.taxName || "Tax"}{invoice.taxRate ? ` ${invoice.taxRate}%` : ""}</span>
              <span className="font-semibold">{cur}{fmt(invoice.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center px-3 py-2 rounded-md" style={{ background: primary, color: "white" }}>
            <span className="font-black uppercase text-[11px] tracking-wide">Grand Total</span>
            <span className="font-black text-lg">{cur}{fmt(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Signature + Contact Footer */}
      <div className="mt-auto">
        <div className="mx-10 border-t border-slate-100 pt-4 pb-4 flex justify-between items-end">
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
            <div className="border-t border-slate-300 pt-1 text-center w-full">
              <p className="text-[10px] font-bold text-slate-600">Authorized Signature</p>
              <p className="text-[10px] text-slate-400">{business.name}</p>
            </div>
          </div>
        </div>

        {/* Footer bar */}
        <div className="flex items-center px-10 py-3" style={{ background: "oklch(0.15 0.02 260)" }}>
          <div className="flex gap-8 text-white/60 text-[10px]">
            {business.phone && <span>📞 {business.phone}</span>}
            <span>✉ {business.email}</span>
          </div>
          <div className="ml-auto h-1 w-16 rounded-full" style={{ background: primary }} />
        </div>
      </div>
    </div>
  )
}
