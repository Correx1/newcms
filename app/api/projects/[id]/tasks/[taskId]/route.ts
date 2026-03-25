/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: projectId, taskId } = await params
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

    // Only Admin and Staff can update
    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role === 'client') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (profile.role === 'staff') {
      const { data: assignment } = await admin.from('project_assignments').select('project_id').eq('project_id', projectId).eq('user_id', user.id).single()
      if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const updates = await request.json()
    
    // Safety check, remove id/project_id from updates if accidentally passed
    const safeUpdates: any = { updated_at: new Date().toISOString() }
    if (updates.title !== undefined) safeUpdates.title = updates.title.trim()
    if (updates.description !== undefined) safeUpdates.description = updates.description?.trim() || null
    if (updates.status !== undefined) safeUpdates.status = updates.status
    if (updates.assignee_id !== undefined) safeUpdates.assignee_id = updates.assignee_id || null
    if (updates.priority !== undefined) safeUpdates.priority = updates.priority
    if (updates.due_date !== undefined) safeUpdates.due_date = updates.due_date
    if (updates.subtasks !== undefined) safeUpdates.subtasks = updates.subtasks

    const { data: updatedTask, error } = await admin
      .from('tasks')
      .update(safeUpdates)
      .eq('id', taskId)
      .eq('project_id', projectId)
      .select('*, assignee:profiles!tasks_assignee_id_fkey(name, email)')
      .single()

    if (error) return NextResponse.json({ error: 'Failed to update task' }, { status: 500 })

    return NextResponse.json({ task: updatedTask })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const { id: projectId, taskId } = await params
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

    // Only Admin and Staff can delete
    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role === 'client') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (profile.role === 'staff') {
      const { data: assignment } = await admin.from('project_assignments').select('project_id').eq('project_id', projectId).eq('user_id', user.id).single()
      if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { error } = await admin
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .eq('project_id', projectId)

    if (error) return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 })

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
