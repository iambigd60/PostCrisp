import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const queryResult = vi.hoisted(() => ({ current: { data: [] as unknown, error: null as unknown } }))
const createClientMock = vi.hoisted(() => vi.fn())

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock.mockImplementation(() => ({
    from: () => ({ select: () => Promise.resolve(queryResult.current) }),
  })),
}))

import { invalidateAccessCache, resolveFeatureAccess } from '@/lib/feature-access'

describe('resolveFeatureAccess', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-key')
    invalidateAccessCache()
    createClientMock.mockClear()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('reads overrides with the service role, so an admin disable applies to every user', async () => {
    queryResult.current = { data: [{ feature: 'captions', min_tier: 'starter', enabled: false }], error: null }
    const access = await resolveFeatureAccess('captions', 'elite')
    expect(createClientMock).toHaveBeenCalledWith('https://example.supabase.co', 'service-key', expect.anything())
    expect(access).toMatchObject({ allowed: false, reason: 'feature_disabled' })
  })

  it('applies a raised minimum tier', async () => {
    queryResult.current = { data: [{ feature: 'captions', min_tier: 'elite', enabled: true }], error: null }
    expect(await resolveFeatureAccess('captions', 'creator')).toMatchObject({ allowed: false, reason: 'tier_too_low' })
  })

  it('denies instead of falling back to defaults when the policy read fails', async () => {
    queryResult.current = { data: null, error: { message: 'permission denied' } }
    expect(await resolveFeatureAccess('captions', 'elite')).toMatchObject({ allowed: false, reason: 'policy_unavailable' })
  })

  it('denies when service-role credentials are missing', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '')
    expect(await resolveFeatureAccess('captions', 'elite')).toMatchObject({ allowed: false, reason: 'policy_unavailable' })
    expect(createClientMock).not.toHaveBeenCalled()
  })

  it('does not cache a failed read', async () => {
    queryResult.current = { data: null, error: { message: 'blip' } }
    await resolveFeatureAccess('captions', 'starter')
    queryResult.current = { data: [], error: null }
    expect(await resolveFeatureAccess('captions', 'starter')).toMatchObject({ allowed: true })
  })
})
