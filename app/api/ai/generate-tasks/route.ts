/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getAIModel } from '../provider'
import { generateObject } from 'ai'
import { z } from 'zod'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll() { return cookieStore.getAll() }, setAll() {} }
    })
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { overview, deliverables } = await req.json()
    if (!overview?.trim()) return NextResponse.json({ error: 'Overview required' }, { status: 400 })

    const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()

    const { object } = await generateObject({
      model: getAIModel(settings),
      system: settings?.ai_prompt_kanban_tasks || 'Break this project down into distinct, actionable task cards based on the overview and deliverables. Give each task a straight-to-the-point title and a 1-sentence description. Do not add fluff.',
      prompt: `Project Overview:\n${overview}\n\nDeliverables:\n${deliverables || 'None specified'}`,
      schema: z.object({
        tasks: z.array(z.object({
          title: z.string().describe('Straight-to-the-point title of the task'),
          description: z.string().describe('A simple 1-sentence description'),
          priority: z.enum(['low', 'medium', 'high', 'urgent']).describe('Inferred priority'),
          subtasks: z.array(z.string()).describe('A list of 2-5 actionable subtasks/checklists needed to complete this task')
        }))
      })
    })

    return NextResponse.json({ tasks: object.tasks })
  } catch (err: any) {
    console.error('[AI Generate Tasks]', err)
    return NextResponse.json({ error: err.message || 'Failed to generate tasks' }, { status: 500 })
  }
}
