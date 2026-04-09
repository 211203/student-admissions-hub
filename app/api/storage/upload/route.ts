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

    const formData = await req.formData()
    const docType = String(formData.get('docType') || '')
    const file = formData.get('file')
    const studentName = String(formData.get('studentName') || user.user_metadata?.full_name || '')
    const studentEmail = String(formData.get('studentEmail') || user.email || '')

    if (!docType || !(file instanceof File)) {
      return NextResponse.json({ error: 'docType and file are required' }, { status: 400 })
    }

    const filePath = `${user.id}/${docType}`

    const { error: uploadError } = await supabase.storage
      .from(STUDENT_DOCUMENTS_BUCKET)
      .upload(filePath, file, { upsert: true })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 400 })
    }

    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(STUDENT_DOCUMENTS_BUCKET)
      .createSignedUrl(filePath, 3600)

    if (signedUrlError || !signedUrlData?.signedUrl) {
      return NextResponse.json(
        { error: signedUrlError?.message || 'Failed to create signed URL' },
        { status: 400 }
      )
    }

    // Keep documents table in sync with storage
    await supabase.from('documents').delete().eq('student_id', user.id).eq('document_type', docType)

    // Ensure student profile row exists for FK-backed tables
    await supabase.from('student_profiles').upsert(
      { id: user.id, full_name: studentName || 'Student', email: studentEmail || `${user.id}@unknown.local` },
      { onConflict: 'id' }
    )

    const { error: docInsertError } = await supabase.from('documents').insert({
      student_id: user.id,
      document_type: docType,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
    })

    if (docInsertError) {
      return NextResponse.json(
        {
          error: `Document uploaded but DB update failed: ${docInsertError.message}`,
          filePath,
          fileName: file.name,
          signedUrl: signedUrlData.signedUrl,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      docType,
      filePath,
      fileName: file.name,
      signedUrl: signedUrlData.signedUrl,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
