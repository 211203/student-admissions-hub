import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: existingRows, error: existingError } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('student_id', user.id)

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 400 })
    }

    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json({ ok: true, deletedCount: 0 })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const adminSupabase =
      serviceRoleKey
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null

    const deleteClient = adminSupabase ?? supabase
    const { error: deleteError } = await deleteClient
      .from('chat_messages')
      .delete()
      .eq('student_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    const { data: remainingRows, error: verifyError } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('student_id', user.id)

    if (verifyError) {
      return NextResponse.json({ error: verifyError.message }, { status: 400 })
    }

    if ((remainingRows || []).length > 0) {
      return NextResponse.json(
        {
          error: adminSupabase
            ? 'Chat clear did not persist'
            : 'Chat clear blocked by database policy. Set SUPABASE_SERVICE_ROLE_KEY for server-side deletes.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, deletedCount: existingRows.length })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

