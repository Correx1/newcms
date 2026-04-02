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

// POST /api/admin/contact-submissions/[id]/promote — promote a submission to a lead
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAdminUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params

    // Fetch the submission
    const { data: submission, error: subError } = await auth.supabaseAdmin
      .from('contact_submissions')
      .select('*')
      .eq('id', id)
      .single()

    if (subError || !submission) return NextResponse.json({ error: 'Submission not found' }, { status: 404 })

    // Check not already promoted
    const { data: existing } = await auth.supabaseAdmin
      .from('leads')
      .select('id')
      .eq('contact_submission_id', id)
      .maybeSingle()

    if (existing) return NextResponse.json({ error: 'Already promoted to lead', lead_id: existing.id }, { status: 400 })

    // Create the lead
    const { data: lead, error: leadError } = await auth.supabaseAdmin
      .from('leads')
      .insert({
        contact_submission_id: id,
        full_name: submission.full_name,
        email: submission.email,
        phone: submission.phone,
        company: submission.company,
        service: submission.service,
        message: submission.message,
        stage: 'new',
      })
      .select()
      .single()

    if (leadError) throw leadError

    return NextResponse.json({ lead })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
