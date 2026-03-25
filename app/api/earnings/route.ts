/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

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

    // Use admin key to bypass RLS and get fresh, accurate financials
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('project_assignments')
      .select(`
        id,
        earnings,
        amount_paid,
        projects (
          id,
          title,
          status,
          deadline
        )
      `)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const assignments = (data || []).map((a: any) => ({
      id: a.id,
      project_id: a.projects?.id,
      title: a.projects?.title || 'Unknown Project',
      status: a.projects?.status || 'unknown',
      deadline: a.projects?.deadline,
      earnings: Number(a.earnings) || 0,
      amount_paid: Number(a.amount_paid) || 0,
    }))

    return NextResponse.json({ assignments })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
