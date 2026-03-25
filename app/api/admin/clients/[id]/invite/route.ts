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
    const { id: clientId } = await params

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

    // Verify Target Client Identity
    const { data: targetClient, error: clientFetchError } = await adminClient
      .from('profiles')
      .select('email, name')
      .eq('id', clientId)
      .single()

    if (clientFetchError || !targetClient) {
      return NextResponse.json({ error: 'Client not found entirely' }, { status: 404 })
    }

    if (targetClient.email.includes('@noplincms.local') || targetClient.email.startsWith('silent_')) {
      return NextResponse.json({ error: 'Cannot dispatch invite to an unregistered dummy placeholder email. Edit the client first to provide a real email address.' }, { status: 400 })
    }

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
    const redirectTo = `${origin}/auth/callback?next=/setup-password`

    // Emit the recovery link structurally routing out as an invite replacement to securely onboard retroactively
    const { error: inviteError } = await adminClient.auth.resetPasswordForEmail(
      targetClient.email, 
      { redirectTo }
    )

    if (inviteError) {
      console.error('[client-invite] dispatch error:', inviteError.message)
      return NextResponse.json({ error: inviteError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, message: `Deferred invite email dispatched securely to ${targetClient.email}` })
  } catch (err: any) {
    console.error('[client-invite] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
