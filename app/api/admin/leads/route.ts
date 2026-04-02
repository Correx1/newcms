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

// GET /api/admin/leads — list all leads
export async function GET(request: Request) {
  try {
    const auth = await getAdminUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { searchParams } = new URL(request.url)
    const stage = searchParams.get('stage')

    let query = auth.supabaseAdmin
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })

    if (stage && stage !== 'all') {
      query = query.eq('stage', stage)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ leads: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/admin/leads — create a lead manually
export async function POST(request: Request) {
  try {
    const auth = await getAdminUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const body = await request.json()
    const { full_name, email, phone, company, service, message, contact_submission_id } = body

    if (!full_name) return NextResponse.json({ error: 'full_name is required' }, { status: 400 })

    const { data, error } = await auth.supabaseAdmin
      .from('leads')
      .insert({ full_name, email, phone, company, service, message, contact_submission_id: contact_submission_id || null })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ lead: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
