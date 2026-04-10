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

// POST /api/admin/leads/[id]/convert — convert lead to client profile
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAdminUser()
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

    const { id } = await params

    // Fetch lead
    const { data: lead, error: leadError } = await auth.supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()

    if (leadError || !lead) return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    if (lead.converted_client_id) {
      return NextResponse.json({ error: 'Lead already converted', client_id: lead.converted_client_id }, { status: 400 })
    }

    // Use real email if present, otherwise fallback to placeholder
    const emailToUse = lead.email ? lead.email.trim() : `lead_${id.split('-')[0]}@noplincms.local`
    
    let newUserId: string

    if (lead.email) {
      const origin = _req.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
      // Route through auth/callback so the PKCE code is exchanged server-side.
      // auth/callback redirects to /setup-password?via=invite once done.
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent('/setup-password?via=invite')}`
      
      const { data: authData, error: authError } = await auth.supabaseAdmin.auth.admin.inviteUserByEmail(emailToUse, {
        data: { name: lead.full_name, role: 'client' },
        redirectTo
      })

      if (authError) {
        if (authError.message.includes('already registered')) {
           return NextResponse.json({ error: 'A user with this email already exists in the system.' }, { status: 400 })
        }
        throw authError
      }
      newUserId = authData.user.id
    } else {
      const { data: authData, error: authError } = await auth.supabaseAdmin.auth.admin.createUser({
        email: emailToUse,
        email_confirm: true,
        user_metadata: { name: lead.full_name, role: 'client' }
      })

      if (authError) throw authError
      newUserId = authData.user.id
    }

    // Create client profile
    const { data: profile, error: profileError } = await auth.supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        name: lead.full_name,
        email: emailToUse,
        phone: lead.phone || null,
        company: lead.company || null,
        role: 'client',
      })
      .select()
      .single()

    if (profileError) throw profileError

    // Update lead to mark as converted + won
    await auth.supabaseAdmin
      .from('leads')
      .update({ stage: 'won', converted_client_id: newUserId })
      .eq('id', id)

    // Add a conversion note
    await auth.supabaseAdmin.from('lead_notes').insert({
      lead_id: id,
      content: `Lead converted to client profile. Client ID: ${newUserId}`
    })

    return NextResponse.json({ success: true, client_id: newUserId, client: profile })
  } catch (err: any) {
    console.error('Lead convert error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
