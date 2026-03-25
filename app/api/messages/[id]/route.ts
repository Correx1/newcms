import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/messages/[id] — get all messages in a conversation
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cs) {
            try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Verify user is a participant
    const { data: membership } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Fetch messages
    const { data: messages } = await admin
      .from('messages')
      .select('id, sender_id, body, is_read, created_at, profiles!messages_sender_id_fkey(name, role)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    // Mark all unread messages (from the other user) as read
    await admin
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .eq('is_read', false)

    return NextResponse.json({ messages: messages || [] })
  } catch (err: any) {
    console.error('[messages/[id] GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/messages/[id] — send a message to an existing conversation
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: conversationId } = await params
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cs) {
            try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { body, project_id } = await request.json()
    if (!body?.trim()) return NextResponse.json({ error: 'Message body is required' }, { status: 400 })

    const admin = createAdminClient()

    // Verify user is a participant
    const { data: membership } = await admin
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .single()

    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data: newMsg, error: msgErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: body.trim(),
        is_read: false,
        project_id: project_id || null,
      })
      .select('*')
      .single()

    if (msgErr) return NextResponse.json({ error: 'Failed to send' }, { status: 500 })

    return NextResponse.json({ ok: true, message: newMsg })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
