import React from "react"
import { InvoiceTemplateProps } from "../types"

export default function InvoiceLayout1({ invoice, business, client, items }: InvoiceTemplateProps) {
  const cur = invoice.currency || "$"
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="bg-white text-slate-900 w-full max-w-[210mm] mx-auto flex flex-col font-sans print:shadow-none" style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif", printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}>

      {/* Top accent bar */}
      <div className="h-1.5 w-full" style={{ background: "oklch(0.45 0.15 260)" }} />

      {/* Header */}
      <div className="flex justify-between items-start px-10 pt-8 pb-6">
        <div>
          {business.logoUrl
            ? <img src={business.logoUrl} alt={business.name} className="h-14 w-auto object-contain" />
            : <div className="text-2xl font-black tracking-tight" style={{ color: "oklch(0.45 0.15 260)" }}>{business.name}</div>
          }
          <p className="text-[11px] text-slate-500 mt-1 leading-relaxed max-w-[200px]">{business.address}</p>
        </div>

        <div className="text-right">
          <h1 className="text-4xl font-black tracking-tight mb-3" style={{ color: "oklch(0.45 0.15 260)" }}>INVOICE</h1>
          <div className="text-[11px] space-y-0.5">
            <div className="flex justify-end gap-4">
              <span className="text-slate-500 font-semibold">Invoice No:</span>
              <span className="font-bold text-slate-800 font-mono">{invoice.invoiceNo}</span>
            </div>
            <div className="flex justify-end gap-4">
              <span className="text-slate-500 font-semibold">Issue Date:</span>
              <span className="font-bold text-slate-800">{invoice.date}</span>
            </div>
            <div className="flex justify-end gap-4">
              <span className="text-slate-500 font-semibold">Due Date:</span>
              <span className="font-bold text-slate-800">{invoice.dueDate}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="mx-10 h-px mb-6" style={{ background: "oklch(0.45 0.15 260 / 0.2)" }} />

      {/* Bill To / From */}
      <div className="grid grid-cols-2 gap-8 px-10 mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "oklch(0.45 0.15 260)" }}>From</p>
          <p className="font-bold text-slate-900 text-sm">{business.name}</p>
          <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5">{business.email}</p>
          {business.phone && <p className="text-[11px] text-slate-500">{business.phone}</p>}
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color: "oklch(0.45 0.15 260)" }}>Bill To</p>
          <p className="font-bold text-slate-900 text-sm">{client.name}</p>
          {client.email && <p className="text-[11px] text-slate-500 mt-0.5">{client.email}</p>}
          {client.phone && <p className="text-[11px] text-slate-500">{client.phone}</p>}
        </div>
      </div>

      {/* Items Table */}
      <div className="px-10 mb-4 flex-1">
        {/* Table Header */}
        <div className="grid grid-cols-[40px_1fr_90px_100px_100px] text-[10px] font-black uppercase tracking-wider text-white px-3 py-2.5 rounded-md" style={{ background: "oklch(0.45 0.15 260)" }}>
          <div>#</div>
          <div>Service</div>
          <div className="text-center">Budget</div>
          <div className="text-right">Paid</div>
          <div className="text-right">Balance</div>
        </div>

        {/* Rows */}
        {items.map((item, idx) => (
          <div key={item.id} className="grid grid-cols-[40px_1fr_90px_100px_100px] py-3 border-b border-slate-100 items-start text-[11px]">
            <div className="text-slate-400 font-bold pt-0.5">{String(idx + 1).padStart(2, "0")}</div>
            <div className="pr-3">
              <p className="font-bold text-slate-900">{item.service}</p>
              {item.description && <p className="text-slate-400 mt-0.5 leading-relaxed">{item.description}</p>}
            </div>
            <div className="text-center text-slate-600 font-semibold tabular-nums pt-0.5">{cur}{fmt(item.budget)}</div>
            <div className="text-right text-slate-700 font-semibold tabular-nums pt-0.5">{cur}{fmt(item.amount_paid)}</div>
            <div className="text-right font-black tabular-nums pt-0.5" style={{ color: "oklch(0.45 0.15 260)" }}>{cur}{fmt(item.balance)}</div>
          </div>
        ))}
      </div>

      {/* Totals + Notes */}
      <div className="grid grid-cols-[1fr_220px] gap-8 px-10 mt-2 mb-6">
        <div className="space-y-3">
          {invoice.note && (
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 mb-1">Note</p>
              <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-wrap">{invoice.note}</p>
            </div>
          )}
          {business.paymentInfo && (
            <div className="p-3 rounded-md" style={{ background: "oklch(0.45 0.15 260 / 0.05)", border: "1px solid oklch(0.45 0.15 260 / 0.15)" }}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 mb-1">Payment Info</p>
              <p className="text-[11px] text-slate-600 leading-relaxed whitespace-pre-wrap">{business.paymentInfo}</p>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-[11px] border-b border-slate-100 pb-1.5">
            <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">Subtotal</span>
            <span className="font-bold text-slate-800">{cur}{fmt(invoice.subTotal)}</span>
          </div>
          {invoice.taxAmount > 0 && (
            <div className="flex justify-between text-[11px] border-b border-slate-100 pb-1.5">
              <span className="text-slate-500 font-semibold uppercase tracking-wider text-[10px]">{invoice.taxName || "Tax"} {invoice.taxRate ? `${invoice.taxRate}%` : ""}</span>
              <span className="font-semibold text-slate-700">{cur}{fmt(invoice.taxAmount)}</span>
            </div>
          )}
          <div className="flex justify-between items-center pt-1 px-3 py-2 rounded-md" style={{ background: "oklch(0.45 0.15 260)", color: "white" }}>
            <span className="font-black text-sm uppercase tracking-wide">Total</span>
            <span className="font-black text-lg">{cur}{fmt(invoice.total)}</span>
          </div>
        </div>
      </div>

      {/* Signature + Footer */}
      <div className="mx-10 pt-4 border-t border-slate-100 flex justify-between items-end mb-6">
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

      {/* Bottom accent */}
      <div className="h-1.5 w-full mt-auto" style={{ background: "oklch(0.45 0.15 260 / 0.3)" }} />
    </div>
  )
}
