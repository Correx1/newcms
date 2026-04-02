/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { 
  Users, 
  FolderKanban, 
  LogOut,
  LayoutDashboard,
  Receipt,
  UserPlus,
  DollarSign,
  MessageSquare,
  ListTodo,
  Settings,
  Target,
  Bell,
  ChevronDown,
  Wallet
} from "lucide-react"
import Image from "next/image"
import { useEffect, useState } from "react"

type NavLeaf = { title: string; icon: any; href: string; badge?: number }
type NavGroup = { title: string; icon: any; children: NavLeaf[] }
type NavItem = NavLeaf | NavGroup

function isGroup(item: NavItem): item is NavGroup {
  return "children" in item
}

export function AppSidebar({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const [unreadMsgs, setUnreadMsgs] = useState(0)
  const [openGroups, setOpenGroups] = useState<string[]>([])

  // Auto-open group if current path matches a child
  useEffect(() => {
    const groups: { [key: string]: string[] } = {
      "Finance": ["/invoices", "/earnings"],
      "Configure": ["/users/new", "/settings"],
    }
    const toOpen: string[] = []
    for (const [group, paths] of Object.entries(groups)) {
      if (paths.some(p => pathname.startsWith(p))) toOpen.push(group)
    }
    if (toOpen.length > 0) {
      setTimeout(() => setOpenGroups(toOpen), 0)
    }
  }, [pathname])

  useEffect(() => {
    if (!user) return
    const fetchUnread = async () => {
      try {
        const res = await fetch('/api/messages', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          const total = (data.conversations || []).reduce((sum: number, c: any) => sum + (c.unread_count || 0), 0)
          setUnreadMsgs(total)
        }
      } catch { /* ignore */ }
    }
    fetchUnread()
  }, [user])

  if (!user) return null

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => prev.includes(title) ? prev.filter(g => g !== title) : [...prev, title])
  }

  const navItems: NavItem[] = []

  if (user.role === "admin") {
    navItems.push(
      { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard/admin" },
      { title: "My Tasks", icon: ListTodo, href: "/tasks" },
      { title: "Clients", icon: Users, href: "/clients" },
      { title: "Leads", icon: Target, href: "/leads" },
      { title: "Projects", icon: FolderKanban, href: "/projects" },
      { title: "Staff", icon: Users, href: "/staff" },
      { title: "Messages", icon: MessageSquare, href: "/messages", badge: unreadMsgs },
      { title: "Notifications", icon: Bell, href: "/notifications" },
      {
        title: "Finance",
        icon: Wallet,
        children: [
          { title: "Client Invoices", icon: Receipt, href: "/invoices" },
          { title: "Staff Earnings", icon: DollarSign, href: "/staff-earnings" },
          { title: "My Earnings", icon: Wallet, href: "/earnings" },
        ]
      },
      { title: "Create User", icon: UserPlus, href: "/users/new" },
      { title: "Settings", icon: Settings, href: "/settings" },
    )
  } else if (user.role === "staff") {
    navItems.push(
      { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard/staff" },
      { title: "My Tasks", icon: ListTodo, href: "/tasks" },
      { title: "Projects", icon: FolderKanban, href: "/projects" },
      { title: "Messages", icon: MessageSquare, href: "/messages", badge: unreadMsgs },
      { title: "Notifications", icon: Bell, href: "/notifications" },
      { title: "My Earnings", icon: DollarSign, href: "/earnings" }
    )
  } else if (user.role === "client") {
    navItems.push(
      { title: "Dashboard", icon: LayoutDashboard, href: "/dashboard/client" },
      { title: "My Projects", icon: FolderKanban, href: "/projects" },
      { title: "Messages", icon: MessageSquare, href: "/messages", badge: unreadMsgs },
      { title: "Billing & Finance", icon: Receipt, href: "/billing" }
    )
  }

  return (
    <div className={cn(
      "flex flex-col bg-primary text-primary-foreground transition-all duration-300 shadow-xl",
      mobile ? "h-full w-full border-r-0" : "h-screen w-64 hidden md:flex border-r border-primary-foreground/10 shrink-0"
    )}>
      <div className="flex h-14 items-center border-b border-primary-foreground/10 px-5 lg:h-[60px]">
        <Link href={`/dashboard/${user.role}`} className="flex items-center gap-2 font-semibold text-primary-foreground hover:opacity-80 transition-opacity">
          <Image src="/logo.png" alt="Agency Logo" width={140} height={32} className="object-contain h-8 w-auto brightness-0 invert" />
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-3 text-[13.5px] font-medium">
          {navItems.map((item, index) => {
            if (isGroup(item)) {
              const isOpen = openGroups.includes(item.title)
              const Icon = item.icon
              const hasActive = item.children.some(c => pathname === c.href)
              return (
                <div key={index}>
                  <button
                    onClick={() => toggleGroup(item.title)}
                    className={cn(
                      "flex items-center justify-between w-full gap-3 rounded-lg px-3 py-2.5 my-1 transition-all",
                      hasActive
                        ? "bg-primary-foreground/15 text-primary-foreground font-semibold shadow-sm"
                        : "text-primary-foreground/90 hover:bg-primary-foreground/10 hover:text-primary-foreground font-medium"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      {item.title}
                    </span>
                    <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200 opacity-70", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="ml-3 pl-3 border-l border-primary-foreground/20 mb-1">
                      {item.children.map((child, ci) => {
                        const ChildIcon = child.icon
                        const isActive = pathname === child.href
                        return (
                          <Link
                            key={ci}
                            href={child.href}
                            onClick={() => setOpenGroups(prev => prev.filter(g => g !== item.title))}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2 my-0.5 transition-all text-[13px]",
                              isActive
                                ? "bg-primary-foreground/15 text-primary-foreground font-semibold shadow-sm"
                                : "text-primary-foreground/80 hover:bg-primary-foreground/10 hover:text-primary-foreground font-medium"
                            )}
                          >
                            <ChildIcon className="h-3.5 w-3.5" />
                            {child.title}
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            // Regular nav leaf
            const Icon = item.icon
            const isActive = pathname === (item as NavLeaf).href
            return (
              <Link
                key={index}
                href={(item as NavLeaf).href}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 my-1 transition-all",
                  isActive
                    ? "bg-primary-foreground/15 text-primary-foreground font-semibold shadow-sm"
                    : "text-primary-foreground/90 hover:bg-primary-foreground/10 hover:text-primary-foreground font-medium"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {item.title}
                </span>
                {(item as any).badge > 0 && (
                  <span className="h-5 min-w-[20px] px-1 flex items-center justify-center rounded-full bg-primary-foreground text-primary text-[10px] font-bold">
                    {(item as any).badge > 9 ? '9+' : (item as any).badge}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
      <div className="mt-auto p-4 border-t border-primary-foreground/10 bg-primary-foreground/5">
        <button 
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-primary-foreground/75 transition-all hover:bg-destructive/90 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </div>
  )
}
