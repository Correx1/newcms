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

// GET /api/admin/contact-submissions — list raw submissions not yet promoted to leads
export async function GET() {
  try {
    const auth = await getAdminUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    // Get all contact_submission_ids already promoted
    const { data: promoted } = await auth.supabaseAdmin
      .from('leads')
      .select('contact_submission_id')
      .not('contact_submission_id', 'is', null)

    const promotedIds = (promoted || []).map((l: any) => l.contact_submission_id).filter(Boolean)

    let query = auth.supabaseAdmin
      .from('contact_submissions')
      .select('*')
      .order('submitted_at', { ascending: false })

    if (promotedIds.length > 0) {
      query = query.not('id', 'in', `(${promotedIds.map((id: string) => `"${id}"`).join(',')})`)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ submissions: data || [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
