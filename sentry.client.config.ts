// Sentry init for the browser. Auto-loaded by @sentry/nextjs.
// Browser cannot read SENTRY_DSN (server-only), so we use the public variant.
//
// Init fires whenever NEXT_PUBLIC_SENTRY_DSN is set in the build environment.
// To keep local dev silent, leave the var unset in .env.local — set it only
// in Vercel's Production (and Preview, if desired) env vars.
//
// (We deliberately don't gate on NEXT_PUBLIC_VERCEL_ENV: Vercel does not
// auto-expose VERCEL_ENV with the NEXT_PUBLIC_ prefix, so that gate would
// always be undefined client-side and disable init even when the DSN is set.)
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? 'production',
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
    // Replay disabled — adds bundle weight; revisit post-launch if needed.
    replaysOnErrorSampleRate: 0,
    replaysSessionSampleRate: 0,
    sendDefaultPii: false,
  })
}
