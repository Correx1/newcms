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

    const body = await request.json()
    const { email, name, company, phone } = body

    if (!name || !email) {
      return NextResponse.json({ error: 'Name and valid email are required' }, { status: 400 })
    }

    // Update Auth Identity
    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(clientId, {
      email,
      user_metadata: {
        name,
        company: company || null,
        phone: phone || null,
        is_placeholder_email: false,
      }
    })

    if (updateAuthError) {
      console.error('[client-edit] auth update error:', updateAuthError.message)
      return NextResponse.json({ error: updateAuthError.message }, { status: 400 })
    }

    // Update Public Profile directly (redundancy in case triggers mismatch on non-password items)
    const { error: updateProfileError } = await adminClient
      .from('profiles')
      .update({
        email,
        name,
        company: company || null,
        phone: phone || null
      })
      .eq('id', clientId)

    if (updateProfileError) {
      console.error('[client-edit] profile update error:', updateProfileError.message)
      return NextResponse.json({ error: updateProfileError.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true, message: 'Client profile updated successfully' })
  } catch (err: any) {
    console.error('[client-edit] unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
