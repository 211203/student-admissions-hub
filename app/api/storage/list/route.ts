import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { STUDENT_DOCUMENTS_BUCKET } from '@/lib/supabase/storage'

export const runtime = 'nodejs'

export async function GET() {
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

    const { data: objects, error } = await supabase.storage.from(STUDENT_DOCUMENTS_BUCKET).list(user.id, {
      limit: 200,
      offset: 0,
      sortBy: { column: 'created_at', order: 'desc' },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const { data: dbDocs } = await supabase
      .from('documents')
      .select('id, document_type, file_name, uploaded_at, file_path')
      .eq('student_id', user.id)
      .order('uploaded_at', { ascending: false })

    const normalizeDocType = (fileName: string) => {
      const base = fileName.replace(/\.[^/.]+$/, '')
      // Back-compat: older uploads used names like "10th_marksheet_1712345678901.pdf"
      return base.replace(/_\d+$/, '')
    }

    const storageDocs = (objects || [])
      .filter((o) => o.id)
      .map((o) => {
        const name = o.name
        return {
          id: o.id || name,
          document_type: normalizeDocType(name),
          file_name: name,
          uploaded_at: o.created_at || o.updated_at || new Date().toISOString(),
          file_path: `${user.id}/${name}`,
        }
      })

    // Merge Storage + DB, prefer DB as source of truth, dedupe by document_type
    const byType = new Map<string, (typeof storageDocs)[number]>()
    for (const d of storageDocs) byType.set(d.document_type, d)
    for (const d of dbDocs || []) byType.set(d.document_type, d)

    const documents = Array.from(byType.values()).sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    )

    return NextResponse.json({ documents })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
