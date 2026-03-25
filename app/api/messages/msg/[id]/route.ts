import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// PATCH /api/messages/msg/[id] — edit a message body
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: msgId } = await params
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

    const { body } = await request.json()
    if (!body?.trim()) return NextResponse.json({ error: 'Message body required' }, { status: 400 })

    const admin = createAdminClient()

    // Only sender can edit
    const { data: msg } = await admin.from('messages').select('sender_id').eq('id', msgId).single()
    if (!msg || msg.sender_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: updated, error } = await admin
      .from('messages')
      .update({ body: body.trim(), edited_at: new Date().toISOString() })
      .eq('id', msgId)
      .select('*')
      .single()

    if (error) return NextResponse.json({ error: 'Failed to edit message' }, { status: 500 })

    return NextResponse.json({ ok: true, message: updated })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/messages/msg/[id] — soft-delete a message
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: msgId } = await params
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

    // Only sender can delete
    const { data: msg } = await admin.from('messages').select('sender_id').eq('id', msgId).single()
    if (!msg || msg.sender_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await admin
      .from('messages')
      .update({ is_deleted: true, deleted_at: new Date().toISOString(), body: 'This message was deleted.' })
      .eq('id', msgId)

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
