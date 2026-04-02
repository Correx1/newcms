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

// GET /api/admin/leads/[id] — get single lead with notes
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAdminUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params

    const { data: lead, error } = await auth.supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })

    const { data: notes } = await auth.supabaseAdmin
      .from('lead_notes')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ lead, notes: notes || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/admin/leads/[id] — update stage, etc.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAdminUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params
    const body = await request.json()

    const allowed = ['stage', 'full_name', 'email', 'phone', 'company', 'service', 'message']
    const updates: any = {}
    for (const key of allowed) {
      if (key in body) updates[key] = body[key]
    }

    const { data, error } = await auth.supabaseAdmin
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json({ lead: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/admin/leads/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAdminUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params
    const { error } = await auth.supabaseAdmin.from('leads').delete().eq('id', id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
