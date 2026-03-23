/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(request: Request, context: any) {
  try {
    const params = await Promise.resolve(context.params);
    const id = params.id;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // 1. Verify caller is admin using their session cookie
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cs) {
            try { cs.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch { /* ignore */ }
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Confirm user is admin in the DB using admin client
    const admin = createAdminClient()
    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
    }

    // prevent deleting oneself
    if (user.id === id) {
       return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // 3. Delete the user via Supabase Admin API
    // This removes the user from auth.users and automatically cascades to public.profiles via the FK
    const { error: deleteError } = await admin.auth.admin.deleteUser(id)

    if (deleteError) {
      console.error('[admin/users] delete error:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/users] unexpected:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
