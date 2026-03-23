import { PageSkeleton } from "@/components/ui/page-skeleton"

/**
 * Next.js route-segment loading UI.
 * This is shown INSTANTLY on navigation (no JS needed) while the page
 * component and its data are being prepared.
 * Replaces the blank-white-page experience between menu clicks.
 */
export default function Loading() {
  return <PageSkeleton />
}
