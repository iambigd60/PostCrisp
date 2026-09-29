import { describe, expect, it } from 'vitest'
import { isMaintenanceGatedPath } from '@/lib/maintenance-gate'

describe('isMaintenanceGatedPath', () => {
  it('gates signed-in app pages', () => {
    for (const path of ['/dashboard', '/dashboard/settings', '/onboarding', '/accept-terms']) {
      expect(isMaintenanceGatedPath(path)).toBe(true)
    }
  })

  it('gates signed-in API routes, including Stripe checkout and portal', () => {
    for (const path of ['/api/generate', '/api/feedback', '/api/stripe/checkout', '/api/stripe/portal']) {
      expect(isMaintenanceGatedPath(path)).toBe(true)
    }
  })

  it('leaves public pages and the Stripe webhook open', () => {
    for (const path of ['/', '/login', '/signup', '/auth/callback', '/demo', '/api/stripe/webhook']) {
      expect(isMaintenanceGatedPath(path)).toBe(false)
    }
  })

  it('does not match look-alike paths', () => {
    expect(isMaintenanceGatedPath('/dashboards')).toBe(false)
    expect(isMaintenanceGatedPath('/onboarding-guide')).toBe(false)
  })
})
