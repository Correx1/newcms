/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getAIModel } from '../provider'
import { generateText } from 'ai'
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

    const { overview } = await req.json()
    if (!overview?.trim()) return NextResponse.json({ error: 'Overview is required' }, { status: 400 })

    const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()

    const { text } = await generateText({
      model: getAIModel(settings),
      system: settings?.ai_prompt_deliverables || 'Analyze the following project overview. Extract and generate the exact deliverables required to complete it. Output ONLY a bulleted list of deliverables. Do not use paragraphs. Keep descriptions concise.',
      prompt: overview,
    })

    return NextResponse.json({ text })
  } catch (err: any) {
    console.error('[AI Generate Deliverables]', err)
    return NextResponse.json({ error: err.message || 'Failed to generate deliverables' }, { status: 500 })
  }
}
