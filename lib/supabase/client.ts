import { createBrowserClient } from '@supabase/ssr'

const DEFAULT_TIMEOUT_MS = 60000

function rewriteSupabaseStorageUrl(input: RequestInfo | URL): RequestInfo | URL {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!supabaseUrl) return input

  const storagePrefix = `${supabaseUrl}/storage/v1/`

  if (typeof input === 'string') {
    return input.startsWith(storagePrefix)
      ? input.replace(storagePrefix, '/__supabase_storage__/')
      : input
  }

  if (input instanceof URL) {
    const asString = input.toString()
    return asString.startsWith(storagePrefix)
      ? asString.replace(storagePrefix, '/__supabase_storage__/')
      : input
  }

  // If a Request is passed, keep it unchanged (supabase-js usually passes strings)
  return input
}

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

  // Merge any existing signal (if provided) with our timeout signal
  const providedSignal = init?.signal
  if (providedSignal) {
    if (providedSignal.aborted) controller.abort()
    else providedSignal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  const mergedInit: RequestInit = {
    ...init,
    signal: controller.signal,
  }

  const rewrittenInput = rewriteSupabaseStorageUrl(input)

  return fetch(rewrittenInput, mergedInit).finally(() => clearTimeout(timeoutId))
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: fetchWithTimeout,
      },
    }
  )
}
