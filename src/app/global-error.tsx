'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

/**
 * App Router catch-all for unhandled React render errors. Without this file,
 * Sentry can't see render errors that bubble past per-route error boundaries
 * (which is what triggered the build-time warning we'd been getting).
 *
 * Per Sentry's Next.js manual-setup guide: client-side render errors only
 * reach Sentry when this file calls Sentry.captureException in its
 * useEffect.
 *
 * Pattern matches Sentry's recommended template — minimal UI so we don't
 * accidentally render JSX that itself throws while we're trying to display
 * an error.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0E1216',
          color: '#E8ECEF',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 480, padding: '0 24px' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Something went wrong.</h1>
          <p style={{ fontSize: 14, color: '#8C949C', marginTop: 12, lineHeight: 1.5 }}>
            We&apos;ve been notified and we&apos;re looking into it. Try refreshing,
            or head back to the dashboard.
          </p>
          {error.digest && (
            <p style={{ fontSize: 11, color: '#5A6068', marginTop: 16, fontFamily: 'monospace' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={() => window.location.assign('/dashboard')}
            style={{
              marginTop: 24,
              padding: '10px 20px',
              borderRadius: 8,
              border: '1px solid #4A9EE0',
              background: 'rgba(74, 158, 224, 0.1)',
              color: '#4A9EE0',
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Back to dashboard
          </button>
        </div>
      </body>
    </html>
  )
}
