export interface Staff {
  id: string;
  name: string;
  email: string;
  role: "admin" | "staff";
  avatarUrl?: string;
}

export const mockStaff: Staff[] = [
  {
    id: "s1",
    name: "Sarah Admin",
    email: "sarah@agency.com",
    role: "admin",
    avatarUrl: "https://i.pravatar.cc/150?u=sarah",
  },
  {
    id: "s2",
    name: "Mike Developer",
    email: "mike@agency.com",
    role: "staff",
    avatarUrl: "https://i.pravatar.cc/150?u=mike",
  },
  {
    id: "s3",
    name: "Emma Designer",
    email: "emma@agency.com",
    role: "staff",
    avatarUrl: "https://i.pravatar.cc/150?u=emma",
  },
  {
    id: "s4",
    name: "James Manager",
    email: "james@agency.com",
    role: "admin",
  },
];
