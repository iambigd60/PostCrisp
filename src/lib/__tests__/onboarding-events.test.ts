import { describe, it, expect, vi } from 'vitest'
import { logOnboardingEvent, ONBOARDING_EVENT_NAMES, isOnboardingEventName } from '@/lib/onboarding-events'

function fakeWriter(
  calls: unknown[],
  opts: { throwOnInsert?: boolean; resolveWithError?: { message: string } } = {},
) {
  return {
    from(table: string) {
      return {
        insert(row: unknown) {
          if (opts.throwOnInsert) throw new Error('simulated write failure')
          calls.push({ table, row })
          if (opts.resolveWithError) return Promise.resolve({ error: opts.resolveWithError })
          return Promise.resolve({ error: null })
        },
      }
    },
  }
}

describe('logOnboardingEvent', () => {
  it('writes user, name and detail to onboarding_events', async () => {
    const calls: unknown[] = []
    await logOnboardingEvent('user-1', 'stage_viewed', { stage: 'ask' }, fakeWriter(calls) as never)
    expect(calls[0]).toMatchObject({
      table: 'onboarding_events',
      row: { user_id: 'user-1', name: 'stage_viewed', detail: { stage: 'ask' } },
    })
  })

  it('defaults detail to an empty object', async () => {
    const calls: unknown[] = []
    await logOnboardingEvent('user-1', 'first_session_completed', undefined, fakeWriter(calls) as never)
    expect(calls[0]).toMatchObject({ row: { detail: {} } })
  })

  it('NEVER throws when the write fails — telemetry must not break the flow', async () => {
    const calls: unknown[] = []
    await expect(
      logOnboardingEvent('user-1', 'pack_requested', {}, fakeWriter(calls, { throwOnInsert: true }) as never),
    ).resolves.toBeUndefined()
  })

  it('also never throws AND logs it when the write resolves with a PostgREST error instead of throwing — the realistic failure mode, since supabase-js resolves rather than rejects on a query error (e.g. a missing relation before the migration is applied)', async () => {
    const calls: unknown[] = []
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(
      logOnboardingEvent(
        'user-1',
        'artifact_failed',
        {},
        fakeWriter(calls, {
          resolveWithError: { message: 'relation "public.onboarding_events" does not exist' },
        }) as never,
      ),
    ).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith(
      '[onboarding-events] write returned an error',
      expect.objectContaining({ userId: 'user-1', name: 'artifact_failed' }),
    )

    consoleError.mockRestore()
  })
})

describe('isOnboardingEventName', () => {
  it('accepts every name in the union', () => {
    for (const name of ONBOARDING_EVENT_NAMES) {
      expect(isOnboardingEventName(name)).toBe(true)
    }
  })

  it('rejects an arbitrary string — this is the route\'s validation', () => {
    expect(isOnboardingEventName('anything_a_client_invents')).toBe(false)
  })

  it('rejects non-strings', () => {
    expect(isOnboardingEventName(42)).toBe(false)
    expect(isOnboardingEventName(null)).toBe(false)
  })
})
