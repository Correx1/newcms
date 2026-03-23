export interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  projectCount: number;
}

export const mockClients: Client[] = [
  {
    id: "c1",
    name: "Alice Johnson",
    email: "alice@techcorp.com",
    phone: "+1 (555) 123-4567",
    company: "TechCorp Inc.",
    projectCount: 2,
  },
  {
    id: "c2",
    name: "Bob Smith",
    email: "bob@designstudio.com",
    phone: "+1 (555) 987-6543",
    company: "Design Studio LLC",
    projectCount: 1,
  },
  {
    id: "c3",
    name: "Charlie Davis",
    email: "charlie@marketingpro.io",
    phone: "+1 (555) 456-7890",
    company: "Marketing Pro",
    projectCount: 3,
  },
];
