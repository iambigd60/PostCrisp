// Sentry init for the Edge runtime (middleware + edge route handlers).
// Loaded via src/instrumentation.ts when NEXT_RUNTIME === 'edge'.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN
const enabled = !!dsn && (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview')

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  })
}
