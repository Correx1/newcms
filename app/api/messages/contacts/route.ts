/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/messages/contacts
 * Returns the list of users this person is allowed to message.
 * - Admins: can message all staff, clients, and other admins
 * - Staff/Clients: can only message admins
 */
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

    const admin = createAdminClient()

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    let query = admin.from('profiles').select('id, name, email, role').neq('id', user.id)

    if (callerProfile.role === 'client') {
      // Clients can only message admins
      query = query.eq('role', 'admin')
    } else if (callerProfile.role === 'staff') {
      // Staff can message admins and other staff
      query = query.in('role', ['admin', 'staff'])
    }

    const { data: contacts } = await query.order('name')

    return NextResponse.json({ contacts: contacts || [] })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
