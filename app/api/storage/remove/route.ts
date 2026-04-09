import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
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

    const body = (await req.json().catch(() => ({}))) as { filePaths?: string[] }
    const rawPaths = Array.isArray(body.filePaths) ? body.filePaths : []
    const safePaths = rawPaths.filter((p) => typeof p === 'string' && p.startsWith(`${user.id}/`))

    if (safePaths.length === 0) {
      return NextResponse.json({ error: 'No valid file paths' }, { status: 400 })
    }

    const { error } = await supabase.storage.from(STUDENT_DOCUMENTS_BUCKET).remove(safePaths)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const normalizeDocType = (fileName: string) => {
      const base = fileName.replace(/\.[^/.]+$/, '')
      return base.replace(/_\d+$/, '')
    }

    for (const filePath of safePaths) {
      const fileName = filePath.split('/').pop() || ''
      const docType = normalizeDocType(fileName)

      // Prefer deleting by exact file_path (most reliable)
      await supabase.from('documents').delete().eq('student_id', user.id).eq('file_path', filePath)

      // Fallback cleanup for legacy rows keyed by document_type
      await supabase.from('documents').delete().eq('student_id', user.id).eq('document_type', docType)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
