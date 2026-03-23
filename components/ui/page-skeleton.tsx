"use client"

import { Skeleton } from "@/components/ui/skeleton"

/** 
 * Generic page-level skeleton — shown while data is loading.
 * Replaces full-screen spinners with a content-aware placeholder.
 */
export function PageSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-56 rounded-lg" />
        <Skeleton className="h-4 w-80 rounded-md" />
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-8 w-16 rounded" />
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-xl border bg-card shadow-sm">
        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
        {/* Search bar */}
        <div className="px-6 py-3 border-b">
          <Skeleton className="h-9 w-64 rounded-md" />
        </div>
        {/* Table rows */}
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
              <Skeleton className="h-8 w-20 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Dashboard-specific skeleton with stat cards + recent table */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="space-y-2">
        <Skeleton className="h-9 w-64 rounded-lg" />
        <Skeleton className="h-4 w-48 rounded" />
      </div>

      {/* 4-column stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="h-5 w-5 rounded" />
            </div>
            <Skeleton className="h-8 w-14 rounded" />
          </div>
        ))}
      </div>

      {/* Recent items table */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="px-6 py-4 border-b">
          <Skeleton className="h-5 w-40 rounded" />
        </div>
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-56 rounded" />
                <Skeleton className="h-3 w-36 rounded" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Detail page skeleton (client, staff, project detail views) */
export function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>

      {/* Profile / info card */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-40 rounded" />
            <Skeleton className="h-4 w-28 rounded" />
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-16 rounded" />
              <Skeleton className="h-4 w-40 rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Related table */}
      <div className="rounded-xl border bg-card shadow-sm">
        <div className="px-6 py-4 border-b">
          <Skeleton className="h-5 w-32 rounded" />
        </div>
        <div className="divide-y">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48 rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
