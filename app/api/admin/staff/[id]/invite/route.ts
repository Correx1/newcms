/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: staffId } = await params

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { /* ignore */ }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (callerProfile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { data: targetStaff, error: staffFetchError } = await adminClient
      .from('profiles')
      .select('email, name')
      .eq('id', staffId)
      .single()

    if (staffFetchError || !targetStaff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 })
    }

    if (targetStaff.email === 'No mail provided' || targetStaff.email.includes('@noplincms.local') || targetStaff.email.startsWith('silent_')) {
      return NextResponse.json({ error: 'Cannot send invite to a missing email.' }, { status: 400 })
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent('/reset-password?via=recovery')}`

    const { error: inviteError } = await adminClient.auth.resetPasswordForEmail(
      targetStaff.email, 
      { redirectTo }
    )

    if (inviteError) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, message: `Invite email dispatched to ${targetStaff.email}` })
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
