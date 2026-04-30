import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async rewrites() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const n8nCounseling = process.env.NEXT_PUBLIC_N8N_COUNSELING_WEBHOOK
    const n8nEmail = process.env.NEXT_PUBLIC_N8N_EMAIL_WEBHOOK

    const rewrites: { source: string; destination: string }[] = []

    if (supabaseUrl) {
      rewrites.push({
        // Proxy Supabase Storage through same-origin to avoid browser CORS blocking
        source: '/__supabase_storage__/:path*',
        destination: `${supabaseUrl}/storage/v1/:path*`,
      })
    }

    if (n8nCounseling) {
      rewrites.push({ source: '/api/webhook/counseling', destination: n8nCounseling })
    }

    if (n8nEmail) {
      rewrites.push({ source: '/api/webhook/email', destination: n8nEmail })
    }


    return rewrites
  },
}

export default nextConfig
