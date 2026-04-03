import { NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll() { return cookieStore.getAll() }, setAll() {} }
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Must be admin
    const { data: profile } = await supabase.from('profiles').select('role, id').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 })
    }

    const { subject, body } = await req.json()
    if (!subject || !body) {
      return NextResponse.json({ error: "Subject and body are required" }, { status: 400 })
    }

    // 1. Fetch Resend Configuration from Settings
    const { data: settings } = await supabase.from('settings').select('resend_api_key, resend_sender_identity').eq('id', 1).single()
    
    if (!settings || !settings.resend_api_key || !settings.resend_sender_identity) {
      return NextResponse.json({ error: "Resend Email Engine is not configured in Settings." }, { status: 400 })
    }

    // 2. Fetch the Lead's Email
    const { data: lead } = await supabase.from('leads').select('email').eq('id', params.id).single()
    if (!lead || !lead.email) {
      return NextResponse.json({ error: "Lead does not have an email address." }, { status: 400 })
    }

    // 3. Dispatch Email via native Fetch to Resend API
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.resend_api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: settings.resend_sender_identity,
        to: [lead.email],
        reply_to: settings.resend_sender_identity,
        subject: subject,
        // Replace newlines with <br> for simple HTML formatting
        html: `<p>${body.replace(/\n/g, '<br/>')}</p>`
      })
    })

    const resendData = await resendRes.json()

    if (!resendRes.ok) {
      return NextResponse.json({ error: `Resend Error: ${resendData.message || resendData.name || 'Failed to send'}` }, { status: 500 })
    }

    // 4. Log the Email in the CRM Timeline
    const formattedNote = `[EMAIL SENT]\nSubject: ${subject}\n\n${body}`
    
    await supabase.from('lead_notes').insert({
      lead_id: params.id,
      content: formattedNote
    })

    return NextResponse.json({ message: "Email dispatched successfully" })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
