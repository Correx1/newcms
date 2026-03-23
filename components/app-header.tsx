"use client"

import { useAuth } from "@/lib/auth-context"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "./theme-toggle"
import Image from "next/image"
import { Bell, Menu, CheckCircle2, AlertCircle, Info, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet"
import { AppSidebar } from "./app-sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { usePathname } from "next/navigation"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export function AppHeader() {
  const { user } = useAuth()
  const pathname = usePathname()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSidebarOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!user) return

    // 1. Initial Fetch resolving current state securely
    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (data) setNotifications(data)
    }

    fetchNotifications()

    // 2. Exact Real-Time Subscription executing strict WebSocket arrays directly against Postgres native triggers!
    const channel = supabase.channel(`public:notifications:user_id=eq.${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            setNotifications(prev => [payload.new as Notification, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n))
          } else if (payload.eventType === 'DELETE') {
            setNotifications(prev => prev.filter(n => n.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, supabase])

  const markAllAsRead = async () => {
    if (!user) return
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length === 0) return

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
  }

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
  }

  if (!user) return null

  return (
    <header className="flex h-14 lg:h-[60px] items-center gap-4 border-b border-primary-foreground/10 bg-primary text-primary-foreground px-4 lg:px-6 w-full shadow-md z-10 transition-colors duration-300">
      <div className="flex-1 flex items-center justify-between">
        
        {/* Mobile Sidebar Toggle & Logo */}
        <div className="flex items-center gap-3 md:hidden">
          <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
            <SheetTrigger className="inline-flex items-center justify-center whitespace-nowrap rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground focus:ring-primary-foreground/50 h-9 w-9">
              <Menu className="h-6 w-6" />
              <span className="sr-only">Toggle Sidebar</span>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 border-none w-64">
              <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
              <AppSidebar mobile />
            </SheetContent>
          </Sheet>
          
          <Image src="/logo.png" alt="Agency Logo" width={100} height={32} className="object-contain h-7 w-auto brightness-0 invert" />
        </div>

        {/* Desktop Header Left Side */}
        <div className="hidden md:block flex-1"></div>
        
        <div className="flex items-center gap-4">
          {user.role !== "client" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                  {notifications.some(n => !n.is_read) && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive border-[1.5px] border-background animate-pulse" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="font-semibold text-sm">Live Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground italic">No new notifications</div>
                  ) : notifications.map(n => (
                     <DropdownMenuItem 
                        key={n.id} 
                        onClick={() => markAsRead(n.id)}
                        className={`flex flex-col items-start p-3 gap-1 cursor-pointer hover:bg-muted/50 focus:bg-muted/50 rounded-none relative ${n.is_read ? 'opacity-70' : ''}`}
                     >
                        {!n.is_read && <div className="absolute left-1 top-4 h-1.5 w-1.5 rounded-full bg-blue-500" />}
                        <div className="flex justify-between w-full items-center pl-3">
                          <span className="font-medium text-sm flex items-center gap-1.5">
                            {n.type === "success" && <CheckCircle2 className="h-3 w-3 text-emerald-500"/>}
                            {n.type === "alert" && <AlertCircle className="h-3 w-3 text-destructive"/>}
                            {n.type === "system" && <Info className="h-3 w-3 text-blue-500"/>}
                            {n.type === "message" && <MessageSquare className="h-3 w-3 text-muted-foreground"/>}
                            {n.title}
                          </span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {new Date(n.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 pl-3">{n.message}</p>
                     </DropdownMenuItem>
                  ))}
                </div>
                <DropdownMenuSeparator />
                <div onClick={markAllAsRead} className="w-full text-center p-2 text-xs font-medium text-primary hover:underline cursor-pointer">
                  Mark all as read
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="text-primary-foreground/80 hover:text-primary-foreground transition-colors">
             <ThemeToggle />
          </div>
          
          <div className="flex items-center gap-3 pr-2">
            <div className="hidden sm:flex items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium">{user.name}</span>
              <Badge variant="secondary" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 capitalize font-medium border-none px-2.5 py-0.5">
                {user.role}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
