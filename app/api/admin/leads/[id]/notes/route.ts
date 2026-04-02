/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAdminUser() {
  const cookieStore = await cookies()
  const supabaseSession = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cs) {
          try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* ignore */ }
        },
      },
    }
  )
  const { data: { user }, error } = await supabaseSession.auth.getUser()
  if (error || !user) return null

  const supabaseAdmin = createAdminClient()
  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single()
  if (!profile || profile.role !== 'admin') return null

  return { user, supabaseAdmin }
}

// POST /api/admin/leads/[id]/notes — add a note to a lead
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAdminUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params
    const { content } = await request.json()

    if (!content?.trim()) return NextResponse.json({ error: 'Note content is required' }, { status: 400 })

    const { data, error } = await auth.supabaseAdmin
      .from('lead_notes')
      .insert({ lead_id: id, content: content.trim() })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ note: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
