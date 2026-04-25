// Next.js calls register() once per server runtime on startup. We use it to
// load the Sentry config that matches the active runtime so server + edge
// errors get captured.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

// Forwards uncaught request errors (incl. unhandled errors in route handlers)
// into Sentry. @sentry/nextjs exports the helper; the no-op guard keeps this
// safe if Sentry isn't configured (e.g. local dev without the DSN).
import * as Sentry from '@sentry/nextjs'
export const onRequestError = Sentry.captureRequestError
