/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Bell, CheckCircle2, AlertCircle, Info, MessageSquare, CheckCheck, Loader2 } from "lucide-react"

interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

const typeConfig: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  success: { icon: CheckCircle2, label: "Success", color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/20" },
  alert:   { icon: AlertCircle,   label: "Alert",   color: "text-red-600",     bg: "bg-red-500/10 border-red-500/20" },
  system:  { icon: Info,          label: "System",  color: "text-blue-600",    bg: "bg-blue-500/10 border-blue-500/20" },
  message: { icon: MessageSquare, label: "Message", color: "text-purple-600",  bg: "bg-purple-500/10 border-purple-500/20" },
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  if (hrs < 24) return `${hrs}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [markingAll, setMarkingAll] = useState(false)
  const [filter, setFilter] = useState<"all" | "unread">("all")

  useEffect(() => {
    if (!user) return
    const fetch = async () => {
      setLoading(true)
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (data) setNotifications(data)
      setLoading(false)
    }
    fetch()

    // Real-time
    const channel = supabase.channel(`notif-page:${user.id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notifications",
        filter: `user_id=eq.${user.id}`
      }, (payload: any) => {
        if (payload.eventType === "INSERT") {
          setNotifications(prev => [payload.new as Notification, ...prev])
        } else if (payload.eventType === "UPDATE") {
          setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new as Notification : n))
        } else if (payload.eventType === "DELETE") {
          setNotifications(prev => prev.filter(n => n.id !== payload.old.id))
        }
      }).subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user, supabase])

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
    await supabase.from("notifications").update({ is_read: true }).eq("id", id)
  }

  const markAllAsRead = async () => {
    setMarkingAll(true)
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id)
    if (unreadIds.length > 0) {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      await supabase.from("notifications").update({ is_read: true }).in("id", unreadIds)
    }
    setMarkingAll(false)
  }

  const displayed = filter === "unread" ? notifications.filter(n => !n.is_read) : notifications
  const unreadCount = notifications.filter(n => !n.is_read).length

  if (!user) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Bell className="h-7 w-7 text-primary" /> Notifications
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            All your alerts, updates, and system messages.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="font-bold h-9 shrink-0 shadow-sm"
            onClick={markAllAsRead}
            disabled={markingAll}
          >
            {markingAll ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCheck className="h-4 w-4 mr-1.5" />}
            Mark all as read ({unreadCount})
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex rounded-lg bg-muted/30 p-1 gap-1 w-fit">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${filter === "all" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          All
          {notifications.length > 0 && (
            <span className="ml-1.5 text-[10px] bg-muted rounded-full px-1.5 py-0.5 font-bold text-muted-foreground">{notifications.length}</span>
          )}
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${filter === "unread" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Unread
          {unreadCount > 0 && (
            <span className="ml-1.5 text-[10px] bg-blue-500/10 text-blue-600 rounded-full px-1.5 py-0.5 font-bold">{unreadCount}</span>
          )}
        </button>
      </div>

      {/* Notifications list */}
      <Card className="shadow-sm border-border/50">
        <CardHeader className="pb-3 border-b border-border/50 bg-muted/5">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            {filter === "unread" ? "Unread Notifications" : "All Notifications"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-20" />
              <p className="font-semibold text-sm">{filter === "unread" ? "No unread notifications" : "No notifications yet"}</p>
              <p className="text-xs mt-1 opacity-70">You{"'"}re all caught up!</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {displayed.map(n => {
                const cfg = typeConfig[n.type] || typeConfig.system
                const Icon = cfg.icon
                return (
                  <div
                    key={n.id}
                    onClick={() => !n.is_read && markAsRead(n.id)}
                    className={`flex items-start gap-4 p-4 transition-colors group ${!n.is_read ? "bg-primary/2 hover:bg-muted/20 cursor-pointer" : "hover:bg-muted/10"}`}
                  >
                    {/* Icon */}
                    <div className={`shrink-0 h-9 w-9 rounded-full flex items-center justify-center border ${cfg.bg}`}>
                      <Icon className={`h-4 w-4 ${cfg.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {!n.is_read && <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />}
                          <p className={`text-sm font-bold truncate ${n.is_read ? "text-foreground/70" : "text-foreground"}`}>{n.title}</p>
                        </div>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 font-medium">{timeAgo(n.created_at)}</span>
                      </div>
                      <p className={`text-sm leading-relaxed ${n.is_read ? "text-muted-foreground/70" : "text-muted-foreground"}`}>{n.message}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
