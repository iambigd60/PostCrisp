import { withSentryConfig } from '@sentry/nextjs'

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
  // Avatar fetch chain: unavatar.io serves channel profile pictures,
  // typically via 302 redirect to the platform's CDN. CSP checks redirect
  // targets too, so each major CDN must be allowlisted. Failing pictures
  // fall back to the platform emoji client-side, so an incomplete list
  // here only degrades aesthetics, never breaks the dashboard.
  "img-src 'self' data: blob: https://*.supabase.co https://unavatar.io https://*.unavatar.io https://*.googleusercontent.com https://*.ggpht.com https://*.cdninstagram.com https://*.fbcdn.net https://*.twimg.com https://*.tiktokcdn-us.com https://*.tiktokcdn.com https://*.licdn.com",
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

// Sentry webpack plugin wrap. Source-map upload is gated on SENTRY_AUTH_TOKEN
// being set in the Vercel build env; without it, the wrap is still safe
// (errors will still be captured at runtime, just without symbolicated stacks).
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Don't fail the Vercel build if Sentry source-map upload errors.
  errorHandler: () => {},
  // Trim @sentry/nextjs bundles to keep first-load JS small.
  hideSourceMaps: true,
  disableLogger: true,
})
