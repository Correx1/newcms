/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// GET /api/projects/[id]/tasks - Fetch all tasks for a project
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
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

    // Check project access
    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    if (profile.role !== 'admin') {
      if (profile.role === 'client') {
        const { data: project } = await admin.from('projects').select('id').eq('id', projectId).eq('client_id', user.id).single()
        if (!project) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      } else {
        const { data: assignment } = await admin.from('project_assignments').select('project_id').eq('project_id', projectId).eq('user_id', user.id).single()
        if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Fetch tasks
    const { data: tasks, error } = await admin
      .from('tasks')
      .select('*, assignee:profiles!tasks_assignee_id_fkey(name, email)')
      .eq('project_id', projectId)
      .order('order', { ascending: true })

    if (error) return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 })

    return NextResponse.json({ tasks: tasks || [] })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/projects/[id]/tasks - Create a new task
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
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

    // Only Admin and Staff can create tasks
    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role === 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (profile.role === 'staff') {
      const { data: assignment } = await admin
        .from('project_assignments')
        .select('project_id')
        .eq('project_id', projectId)
        .eq('user_id', user.id)
        .single()
      if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { title, description, assignee_id, status, priority, due_date, subtasks } = await request.json()
    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    const taskStatus = status || 'todo'

    // Get highest order for the status column
    const { data: existingTasks } = await admin
      .from('tasks')
      .select('order')
      .eq('project_id', projectId)
      .eq('status', taskStatus)
      .order('order', { ascending: false })
      .limit(1)

    const nextOrder = existingTasks && existingTasks.length > 0 ? existingTasks[0].order + 1 : 0

    const { data: newTask, error } = await admin
      .from('tasks')
      .insert({
        project_id: projectId,
        title: title.trim(),
        description: description?.trim() || null,
        status: taskStatus,
        assignee_id: assignee_id || null,
        order: nextOrder,
        priority: priority || 'medium',
        due_date: due_date || null,
        subtasks: subtasks || []
      })
      .select('*, assignee:profiles!tasks_assignee_id_fkey(name, email)')
      .single()

    if (error) return NextResponse.json({ error: 'Failed to create task' }, { status: 500 })

    return NextResponse.json({ task: newTask })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/projects/[id]/tasks - Bulk reorder tasks
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params
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

    // Only Admin and Staff can reorder
    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role === 'client') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (profile.role === 'staff') {
      const { data: assignment } = await admin.from('project_assignments').select('project_id').eq('project_id', projectId).eq('user_id', user.id).single()
      if (!assignment) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { updates } = await request.json()
    if (!updates || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Updates must be an array' }, { status: 400 })
    }

    // Bulk update approach using a loop for simplicity and safety, since it's usually small arrays
    for (const update of updates) {
      if (update.id) {
        await admin
          .from('tasks')
          .update({
            status: update.status,
            order: update.order,
            updated_at: new Date().toISOString()
          })
          .eq('id', update.id)
          .eq('project_id', projectId) // safety guard
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
