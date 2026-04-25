/** @type {import('next').NextConfig} */

// Pragmatic CSP for Phase 0 hardening. Permits 'unsafe-inline' for scripts
// and styles because Next.js 14 App Router hydration depends on it without a
// nonce-based pipeline (a future tightening pass). Origins:
//   - Self for app-served chunks/api/images
//   - data: for inline-encoded images (Tailwind, icons)
//   - blob: for client-generated previews
//   - https://*.supabase.co for auth/REST/storage assets
//   - wss://*.supabase.co for realtime channels
//   - https://js.stripe.com + https://m.stripe.network for Checkout JS
//   - https://api.stripe.com for direct Stripe calls if any
//   - https://*.ingest.sentry.io for Sentry error transport (added in Phase 0)
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.network",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://*.ingest.sentry.io https://*.ingest.us.sentry.io",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'Content-Security-Policy',   value: cspDirectives },
]

const nextConfig = {
  images: {
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
