export interface InvoiceItem {
  id: string;
  service: string;
  description?: string;
  budget: number;
  amount_paid: number;
  balance: number;
}

export interface InvoiceTemplateProps {
  invoice: {
    invoiceNo: string;
    date: string;
    dueDate: string;
    subTotal: number;
    taxName?: string; // e.g. "VAT", "IGST"
    taxRate?: number; // e.g. 18 for 18%
    taxAmount: number;
    total: number;
    note?: string;
    terms?: string;
    currency?: string;
  };
  business: {
    name: string;
    logoUrl?: string;
    address: string;
    email: string;
    phone: string;
    paymentInfo?: string;
    signatureUrl?: string;
  };
  client: {
    name: string;
    address: string;
    email: string;
    phone?: string;
  };
  items: InvoiceItem[];
}
