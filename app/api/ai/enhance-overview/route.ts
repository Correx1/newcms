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
      cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } // read-only safe
    })
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { prompt } = await req.json()
    if (!prompt?.trim()) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })

    const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single()

    const { text } = await generateText({
      model: getAIModel(settings),
      system: settings?.ai_prompt_overview || 'You are an expert agency project manager. Rewrite the provided brief into a clear, single-paragraph project overview. Do not make it overly long. Output only the final overview text, with no introductory filler. No yapping.',
      prompt: prompt,
    })

    return NextResponse.json({ text })
  } catch (err: any) {
    console.error('[AI Enhance Overview]', err)
    return NextResponse.json({ error: err.message || 'Failed to generate overview' }, { status: 500 })
  }
}
