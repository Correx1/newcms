export interface Invoice {
  id: string;
  clientId: string;
  projectId?: string;
  amount: number;
  status: "paid" | "pending" | "overdue";
  issueDate: string;
  dueDate: string;
  description: string;
}

export const mockInvoices: Invoice[] = [
  { id: "inv-001", clientId: "c1", projectId: "p1", amount: 4500, status: "paid", issueDate: "2026-02-01T10:00:00Z", dueDate: "2026-02-15T10:00:00Z", description: "Website Redesign - Final Milestone" },
  { id: "inv-002", clientId: "c1", projectId: "p4", amount: 1200, status: "pending", issueDate: "2026-03-01T10:00:00Z", dueDate: "2026-03-30T10:00:00Z", description: "Marketing Setup - Initial Retainer" },
  { id: "inv-003", clientId: "c2", projectId: "p2", amount: 8500, status: "overdue", issueDate: "2026-01-15T10:00:00Z", dueDate: "2026-01-30T10:00:00Z", description: "Mobile App Wireframes" },
  { id: "inv-004", clientId: "c3", projectId: "p3", amount: 2000, status: "paid", issueDate: "2026-02-28T10:00:00Z", dueDate: "2026-03-14T10:00:00Z", description: "SEO Strategy Output" },
];
