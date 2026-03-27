/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll() { return cookieStore.getAll() }, setAll() {} }
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: settings, error } = await supabase.from('settings').select('*').eq('id', 1).single()
    if (error && error.code !== 'PGRST116') {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ settings: settings || null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch settings' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll() { return cookieStore.getAll() }, setAll() {} }
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch the requesting user's profile to enforce Admin strictly at the API border
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Permission Denied: Admins Only' }, { status: 403 })
    }

    const body = await req.json()

    // Enforce Singleton ID strictly
    const updates = {
      ...body,
      id: 1,
      updated_at: new Date().toISOString()
    }

    const { data, error } = await supabase.from('settings').upsert(updates, { onConflict: 'id' }).select()
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ message: 'Settings saved gracefully!', settings: data[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to apply settings' }, { status: 500 })
  }
}
