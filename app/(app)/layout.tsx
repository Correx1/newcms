"use client"

import { useAuth } from "@/lib/auth-context"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { DashboardSkeleton } from "@/components/ui/page-skeleton"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading, hasSession } = useAuth()
  const router = useRouter()

  // Only block rendering on the VERY FIRST cold load (user has never been set).
  // On subsequent navigations auth-context may briefly set loading=true while
  // it re-validates, but user is already populated — we should not tear the
  // layout down and show a blank page in that case.
  const isFirstLoad = loading && !user

  useEffect(() => {
    if (!loading && !hasSession) {
      router.replace("/")
    }
  }, [hasSession, loading, router])

  if (isFirstLoad) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex min-h-screen w-full">
          {/* Sidebar placeholder */}
          <div className="hidden md:flex w-64 h-screen bg-card border-r flex-col gap-4 p-4">
            <div className="h-8 w-32 bg-muted animate-pulse rounded-lg" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-9 w-full bg-muted animate-pulse rounded-md" />
            ))}
          </div>
          {/* Main content skeleton */}
          <div className="flex-1 flex flex-col">
            <div className="h-14 border-b bg-card px-6 flex items-center gap-4">
              <div className="h-6 w-48 bg-muted animate-pulse rounded" />
              <div className="ml-auto h-8 w-8 bg-muted animate-pulse rounded-full" />
            </div>
            <div className="p-6 md:p-8">
              <DashboardSkeleton />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="flex min-h-screen w-full bg-background/50">
      <AppSidebar />
      <div className="flex w-full flex-col h-screen overflow-hidden">
        <AppHeader />
        <main className="flex-1 overflow-auto bg-muted/20 w-full animate-in fade-in duration-500">
          <div className="p-2 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
