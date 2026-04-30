import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { STUDENT_DOCUMENTS_BUCKET } from '@/lib/supabase/storage'

export const runtime = 'nodejs'

export async function POST(req: Request) {
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

    const body = (await req.json().catch(() => ({}))) as {
      filePaths?: string[]
      docIds?: string[]
    }
    const rawPaths = Array.isArray(body.filePaths) ? body.filePaths : []
    const rawDocIds = Array.isArray(body.docIds) ? body.docIds : []
    const safePaths = rawPaths.filter((p) => typeof p === 'string' && p.startsWith(`${user.id}/`))
    const safeDocIds = rawDocIds.filter((id) => typeof id === 'string' && id.trim().length > 0)

    if (safePaths.length === 0 && safeDocIds.length === 0) {
      return NextResponse.json({ error: 'No valid document identifiers' }, { status: 400 })
    }

    const targetsById = new Map<string, { id: string; file_path: string }>()
    if (safeDocIds.length > 0) {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_path')
        .eq('student_id', user.id)
        .in('id', safeDocIds)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      for (const row of data || []) {
        targetsById.set(row.id, row)
      }
    }

    if (safePaths.length > 0) {
      const { data, error } = await supabase
        .from('documents')
        .select('id, file_path')
        .eq('student_id', user.id)
        .in('file_path', safePaths)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      for (const row of data || []) {
        targetsById.set(row.id, row)
      }
    }

    const targetRows = Array.from(targetsById.values())
    if (targetRows.length === 0) {
      return NextResponse.json({ error: 'No matching documents found for this student' }, { status: 404 })
    }

    const targetIds = targetRows.map((row) => row.id)
    const targetPaths = targetRows.map((row) => row.file_path)

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const adminSupabase =
      serviceRoleKey
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null

    const deleteClient = adminSupabase ?? supabase
    const { error: deleteError } = await deleteClient
      .from('documents')
      .delete()
      .in('id', targetIds)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 })
    }

    const { data: remainingRows, error: verifyError } = await supabase
      .from('documents')
      .select('id')
      .eq('student_id', user.id)
      .in('id', targetIds)

    if (verifyError) {
      return NextResponse.json({ error: verifyError.message }, { status: 400 })
    }

    const remainingIds = new Set((remainingRows || []).map((row) => row.id))
    const deletedIds = targetIds.filter((id) => !remainingIds.has(id))
    const deletedPathSet = new Set(
      targetRows.filter((row) => deletedIds.includes(row.id)).map((row) => row.file_path)
    )

    if (deletedIds.length === 0) {
      return NextResponse.json(
        {
          error: adminSupabase
            ? 'Document delete did not persist'
            : 'Document delete blocked by database policy. Set SUPABASE_SERVICE_ROLE_KEY for server-side deletes.',
        },
        { status: 500 }
      )
    }

    const pathsToRemove = targetPaths.filter((path) => deletedPathSet.has(path))
    if (pathsToRemove.length > 0) {
      const { error: storageError } = await supabase.storage.from(STUDENT_DOCUMENTS_BUCKET).remove(pathsToRemove)
      const storageNotFound =
        !!storageError &&
        (/not found/i.test(storageError.message) || /No such object/i.test(storageError.message))
      if (storageError && !storageNotFound) {
        return NextResponse.json({ error: storageError.message }, { status: 400 })
      }
    }

    return NextResponse.json({ ok: true, deletedIds, deletedPaths: Array.from(deletedPathSet) })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
