export interface Notification {
  id: string;
  userId: string;
  type: "alert" | "success" | "message" | "system";
  title: string;
  message: string;
  time: string;
  read: boolean;
  link?: string;
}

export const mockNotifications: Notification[] = [
  { id: "n1", userId: "all", type: "success", title: "Project Approved", message: "Client c1 just approved SEO Optimization Strategy.", time: "10 mins ago", read: false },
  { id: "n2", userId: "all", type: "alert", title: "Invoice Overdue", message: "Invoice inv-003 is overdue by 50 days.", time: "2 hours ago", read: false },
  { id: "n3", userId: "all", type: "system", title: "Platform Update", message: "New Invoicing and Approval features are now live across all dashboards.", time: "1 day ago", read: true },
  { id: "n4", userId: "all", type: "message", title: "New Assignment", message: "You were assigned to 'Data Migration Phase 2'.", time: "2 days ago", read: true },
];
