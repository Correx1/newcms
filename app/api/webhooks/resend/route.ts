import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// We use the admin service role because webhooks are unauthenticated external calls.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function extractEmail(fromField: string) {
  // Extract email from formats like "John Doe <john@doe.com>"
  const match = fromField.match(/<(.*?)>/)
  return match ? match[1].toLowerCase() : fromField.toLowerCase().trim()
}

export async function POST(req: Request) {
  try {
    const payload = await req.json()

    // 1. Validate this is an inbound email received event
    if (payload.type !== 'email.received' || !payload.data) {
      return NextResponse.json({ message: "Ignored: Process only email.received drops" })
    }

    const { from, subject, text, html } = payload.data
    const cleanEmail = extractEmail(from)

    // 2. Identify the lead by matching their email address
    const { data: lead } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('email', cleanEmail)
      .single()

    if (!lead) {
      // If we don't recognize the lead, just swallow the webhook successfully
      return NextResponse.json({ message: `No lead matches email ${cleanEmail}` })
    }

    // 3. Document the email directly into the CRM Notes timeline!
    // Try to strip excessive HTML tags if standard text is missing, 
    // but Resend 'text' parameter is usually well-formatted plain text.
    const messageBody = text || html || "[No message body]"
    const formattedLog = `[CLIENT REPLY]\nSubject: ${subject}\n\n${messageBody.trim()}`

    const { error } = await supabaseAdmin.from('lead_notes').insert({
      lead_id: lead.id,
      admin_id: null, // Indicates System/Client origin
      content: formattedLog
    })

    if (error) throw error

    return NextResponse.json({ message: "Lead reply processed and logged into Timeline." })
  } catch (error: any) {
    console.error("Resend Inbound Webhook Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
