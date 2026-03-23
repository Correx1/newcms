export type ProjectStatus = "pending" | "active" | "completed" | "approved";

export interface ProjectFile {
  id: string;
  name: string;
  type: string;
  url: string;
  uploadedAt: string;
}

export interface CompletionDetails {
  notes: string;
  links: string[];
  files: ProjectFile[];
}

export interface Project {
  id: string;
  title: string;
  details: string;
  deliverables: string;
  status: ProjectStatus;
  deadline: string; // ISO string
  clientId: string;
  assignedStaffIds: string[];
  files: ProjectFile[];
  workSummary?: string
  workLinks?: string[]
  workFiles?: string[]
  clientFeedback?: string
  price?: string;
  completionDetails?: CompletionDetails;
}

export const mockProjects: Project[] = [
  {
    id: "p1",
    title: "Website Redesign",
    details: "Complete overhaul of the TechCorp corporate website.",
    deliverables: "- Figma Designs\n- Next.js Codebase\n- Deployment Setup",
    status: "active",
    deadline: new Date(new Date().setDate(new Date().getDate() + 14)).toISOString(),
    clientId: "c1",
    assignedStaffIds: ["s2", "s3"],
    files: [
      {
        id: "f1",
        name: "brand-assets.zip",
        type: "application/zip",
        url: "#",
        uploadedAt: new Date().toISOString(),
      },
    ],
    price: "12,500",
  },
  {
    id: "p2",
    title: "Mobile App Wireframes",
    details: "Initial scoping and wireframes for iOS application.",
    deliverables: "- User Flow PDF\n- Lo-fi Wireframes",
    status: "pending",
    deadline: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString(),
    clientId: "c2",
    assignedStaffIds: ["s3"],
    files: [],
    price: "4,200",
  },
  {
    id: "p3",
    title: "SEO Optimization Strategy",
    details: "Comprehensive SEO audit and 3-month strategy plan.",
    deliverables: "- Audit Report (PDF)\n- Keyword List (CSV)",
    status: "completed",
    deadline: new Date(new Date().setDate(new Date().getDate() - 2)).toISOString(),
    clientId: "c1",
    assignedStaffIds: ["s2"],
    files: [
      {
        id: "f2",
        name: "SEO_Audit_Final.pdf",
        type: "application/pdf",
        url: "#",
        uploadedAt: new Date(new Date().setDate(new Date().getDate() - 3)).toISOString(),
      },
    ],
    price: "8,900",
    completionDetails: {
      notes: "The comprehensive SEO audit is fully complete. We identified 12 critical structural issues and generated the finalized 3-month strategic mapping index.",
      links: [
        "https://figma.com/file/view/mock",
        "https://metrics.seo-agency.example/c3"
      ],
      files: [
        {
          id: "cf1",
          name: "dashboard_preview.png",
          type: "image/png",
          url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800",
          uploadedAt: new Date().toISOString()
        },
        {
          id: "cf2",
          name: "traffic_charts.jpg",
          type: "image/jpeg",
          url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=800",
          uploadedAt: new Date().toISOString()
        }
      ]
    }
  },
  {
    id: "p4",
    title: "Marketing Automation Setup",
    details: "Integration of HubSpot with current CRM for TechCorp.",
    deliverables: "- Workflow Diagrams\n- Active Workflows in HubSpot",
    status: "active",
    deadline: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString(),
    clientId: "c1",
    assignedStaffIds: ["s2", "s4"],
    files: [],
    price: "15,000",
  },
];
