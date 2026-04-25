// Sentry init for the browser. Auto-loaded by @sentry/nextjs.
// Browser cannot read SENTRY_DSN (server-only), so we use the public variant.
// If NEXT_PUBLIC_SENTRY_DSN is not set, client-side error capture is disabled
// silently — server-side capture in API routes still works.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

const enabled = !!dsn && (process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' || process.env.NEXT_PUBLIC_VERCEL_ENV === 'preview')

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'development',
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
    // Replay disabled — adds bundle weight; revisit post-launch if needed.
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
  })
}
