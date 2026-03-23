import { createBrowserClient } from '@supabase/ssr'

// Singleton — reuse the same instance across renders so the auth listener
// isn't re-created on every render cycle (which caused session restore hangs).
let _client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (_client) return _client
  _client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy'
  )
  return _client
}
