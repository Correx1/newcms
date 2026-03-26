/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/messages — list all conversations for the current user
export async function GET() {
  try {
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

    // Get all conversation IDs this user is part of
    const { data: participations } = await admin
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', user.id)

    if (!participations?.length) return NextResponse.json({ conversations: [] })

    const convIds = participations.map(p => p.conversation_id)

    // For each conversation, get the other participant's profile and last message
    const { data: allParticipants } = await admin
      .from('conversation_participants')
      .select('conversation_id, user_id, profiles(id, name, email, role)')
      .in('conversation_id', convIds)
      .neq('user_id', user.id)

    const { data: lastMessages } = await admin
      .from('messages')
      .select('conversation_id, body, created_at, sender_id, is_read')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })

    // Group last message per conversation
    const lastMsgMap: Record<string, any> = {}
    for (const msg of lastMessages || []) {
      if (!lastMsgMap[msg.conversation_id]) {
        lastMsgMap[msg.conversation_id] = msg
      }
    }

    // Count unread per conversation (messages not sent by me and not read)
    const { data: unreadCounts } = await admin
      .from('messages')
      .select('conversation_id')
      .in('conversation_id', convIds)
      .neq('sender_id', user.id)
      .eq('is_read', false)

    const unreadMap: Record<string, number> = {}
    for (const row of unreadCounts || []) {
      unreadMap[row.conversation_id] = (unreadMap[row.conversation_id] || 0) + 1
    }

    const conversations = convIds.map(cid => {
      const otherParticipants = allParticipants?.filter(p => p.conversation_id === cid).map(p => p.profiles) || []
      return {
        id: cid,
        other_user: otherParticipants[0] ?? null,
        other_users: otherParticipants,
        last_message: lastMsgMap[cid] ?? null,
        unread_count: unreadMap[cid] ?? 0,
      }
    }).filter(c => c.other_user) // skip broken conversations
      .sort((a, b) => {
        const dateA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0
        const dateB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0
        return dateB - dateA
      })

    return NextResponse.json({ conversations })
  } catch (err: any) {
    console.error('[messages GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/messages — start a new conversation with one or more recipients + optional project tag
export async function POST(request: Request) {
  try {
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

    const body = await request.json()
    // Support both single recipient_id (legacy) and multiple recipient_ids
    const recipientIds: string[] = Array.isArray(body.recipient_ids)
      ? body.recipient_ids
      : body.recipient_id ? [body.recipient_id] : []

    const messageBody: string = body.body
    const projectId: string | null = body.project_id || null

    if (!recipientIds.length || !messageBody?.trim()) {
      return NextResponse.json({ error: 'recipient_ids and body are required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const isGroup = recipientIds.length > 1
    let conversationId: string | null = null

    if (!isGroup) {
      // 1-on-1: reuse existing conversation if already exists
      const { data: myConvs } = await admin
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', user.id)

      const myConvIds = myConvs?.map(c => c.conversation_id) || []

      if (myConvIds.length > 0) {
        const { data: shared } = await admin
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', recipientIds[0])
          .in('conversation_id', myConvIds)

        if (shared && shared.length > 0) {
          const sharedIds = shared.map(s => s.conversation_id)
          const { data: counts } = await admin
            .from('conversation_participants')
            .select('conversation_id')
            .in('conversation_id', sharedIds)

          const countMap: Record<string, number> = {}
          counts?.forEach(c => {
            countMap[c.conversation_id] = (countMap[c.conversation_id] || 0) + 1
          })
          
          const directConvId = sharedIds.find(id => countMap[id] === 2)
          if (directConvId) {
            conversationId = directConvId
          }
        }
      }
    }

    // Create new conversation (always for groups, or if 1-on-1 not found)
    if (!conversationId) {
      const convTitle = isGroup ? (body.title?.trim() || 'Group Conversation') : null
      const { data: newConv, error: convErr } = await admin
        .from('conversations')
        .insert({ title: convTitle })
        .select('id')
        .single()

      if (convErr || !newConv) {
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }

      conversationId = newConv.id

      const participants = [
        { conversation_id: conversationId, user_id: user.id },
        ...recipientIds.map(rid => ({ conversation_id: conversationId!, user_id: rid }))
      ]
      await admin.from('conversation_participants').insert(participants)
    }

    // Insert the message
    const { data: newMsg, error: msgErr } = await admin
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        body: messageBody.trim(),
        is_read: false,
        project_id: projectId,
      })
      .select('*')
      .single()

    if (msgErr) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, conversation_id: conversationId, message: newMsg })
  } catch (err: any) {
    console.error('[messages POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
