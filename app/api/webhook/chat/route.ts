import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

type ChatWebhookPayload = {
  message?: string
  query?: string
  studentId?: string
  studentName?: string | null
  studentEmail?: string | null
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
}

function extractReply(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return payload.trim() || null
  }

  if (Array.isArray(payload)) {
    for (const item of payload) {
      const found = extractReply(item)
      if (found) return found
    }
    return null
  }

  if (!payload || typeof payload !== 'object') return null
  const obj = payload as Record<string, unknown>

  const directFields = ['reply', 'message', 'answer', 'response', 'text', 'output']
  for (const field of directFields) {
    const value = obj[field]
    if (typeof value === 'string' && value.trim()) return value
  }

  const nestedFields = ['data', 'result', 'body', 'json']
  for (const field of nestedFields) {
    const found = extractReply(obj[field])
    if (found) return found
  }

  for (const value of Object.values(obj)) {
    const found = extractReply(value)
    if (found) return found
  }

  return null
}

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

    const body = (await req.json().catch(() => ({}))) as ChatWebhookPayload
    const message = String(body.message || body.query || '').trim()
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const webhookUrl = process.env.N8N_CHAT_WEBHOOK_URL || process.env.NEXT_PUBLIC_N8N_CHAT_WEBHOOK
    if (!webhookUrl) {
      return NextResponse.json({ error: 'Chat webhook URL is not configured' }, { status: 500 })
    }

    const payload = {
      message,
      query: message,
      userQuery: message,
      studentId: body.studentId || user.id,
      studentName: body.studentName || user.user_metadata?.full_name || null,
      studentEmail: body.studentEmail || user.email || null,
      history: Array.isArray(body.history) ? body.history : [],
      timestamp: new Date().toISOString(),
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    let response: Response
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    const rawText = await response.text()
    if (!response.ok) {
      return NextResponse.json(
        { error: rawText || `Chat webhook failed with ${response.status}` },
        { status: 502 }
      )
    }

    let parsed: unknown = rawText
    try {
      parsed = JSON.parse(rawText)
    } catch {
      // keep plain text payload as-is
    }

    const reply = extractReply(parsed)
    if (!reply) {
      return NextResponse.json({ error: 'Webhook response did not include a reply' }, { status: 502 })
    }

    return NextResponse.json({ reply, raw: parsed })
  } catch (e) {
    const message =
      e instanceof Error && e.name === 'AbortError'
        ? 'Chat webhook timed out'
        : e instanceof Error
          ? e.message
          : 'Chat webhook proxy failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

