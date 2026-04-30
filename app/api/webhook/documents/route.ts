import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

type WebhookKind = 'application' | 'documents'

function detectKind(parsed: unknown): WebhookKind {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    const explicit = obj.webhook
    if (explicit === 'application' || explicit === 'documents') return explicit
    if (Array.isArray(obj.documents)) return 'documents'
  }
  return 'application'
}

async function requireAdmin() {
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
    return { ok: false as const, status: 401, message: 'Unauthorized' }
  }

  const { data: adminProfile, error } = await supabase
    .from('admin_profiles')
    .select('id')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    return { ok: false as const, status: 500, message: error.message }
  }

  if (!adminProfile) {
    return { ok: false as const, status: 403, message: 'Forbidden' }
  }

  return { ok: true as const }
}

export async function POST(req: Request) {
  try {
    const bodyText = await req.text()

    let parsed: unknown = null
    try {
      parsed = JSON.parse(bodyText)
    } catch {
      // allow passthrough of non-JSON bodies
    }

    const kind = detectKind(parsed)

    // Admin-only: document processing webhook
    if (kind === 'documents') {
      const adminCheck = await requireAdmin()
      if (!adminCheck.ok) {
        return NextResponse.json({ error: adminCheck.message }, { status: adminCheck.status })
      }
    }

    const webhookUrl =
      kind === 'documents'
        ? process.env.N8N_DOCUMENT_WEBHOOK_URL || process.env.NEXT_PUBLIC_N8N_DOCUMENT_WEBHOOK_URL
        : process.env.N8N_APPLICATION_WEBHOOK_URL || process.env.NEXT_PUBLIC_N8N_APPLICATION_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json(
        { error: `${kind} webhook URL is not configured` },
        { status: 500 }
      )
    }

    const controller = new AbortController()
    const timeoutMs = kind === 'documents' ? 300000 : 60000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyText,
        redirect: 'follow',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    const contentType = response.headers.get('content-type') || 'text/plain'
    const text = await response.text()

    return new NextResponse(text, {
      status: response.status,
      headers: { 'Content-Type': contentType },
    })
  } catch (e) {
    const message =
      e instanceof Error && e.name === 'AbortError'
        ? 'Webhook timed out'
        : e instanceof Error
          ? e.message
          : 'Webhook proxy failed'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
