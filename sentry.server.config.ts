// Sentry init for Node.js (API routes + server components).
// Loaded via src/instrumentation.ts when NEXT_RUNTIME === 'nodejs'.
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.SENTRY_DSN

// Only enable in deployed environments. Local dev errors stay quiet.
const enabled = !!dsn && (process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview')

if (enabled) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    // Sample 10% of traces in production. We don't need full perf telemetry yet.
    tracesSampleRate: 0.1,
    // Don't ship PII to Sentry by default.
    sendDefaultPii: false,
  })
}
