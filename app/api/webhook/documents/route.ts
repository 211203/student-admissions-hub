import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const webhookUrl =
      process.env.N8N_DOCUMENT_WEBHOOK_URL ||
      process.env.NEXT_PUBLIC_N8N_DOCUMENT_WEBHOOK_URL

    if (!webhookUrl) {
      return NextResponse.json({ error: 'Document webhook URL is not configured' }, { status: 500 })
    }

    const body = await req.text()
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 min hard cap
    let response: Response
    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
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
      headers: {
        'Content-Type': contentType,
      },
    })
  } catch (e) {
    const message =
      e instanceof Error && e.name === 'AbortError'
        ? 'Webhook timed out after 5 minutes'
        : e instanceof Error
          ? e.message
          : 'Webhook proxy failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
