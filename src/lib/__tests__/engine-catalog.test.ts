import { describe, it, expect } from 'vitest'
import { DEFAULT_PROFILE_CONFIG, MODEL_CATALOG, TASK_TIER_PROFILE, CREDITS_PER_TASK, type CrispTask } from '../crisp-engine-config'
import { MODEL_PRICING_USD_PER_1M } from '../ai-costs'

/**
 * Updating an engine touches three tables; this keeps them in step.
 */
describe('engine catalog', () => {
  it('prices every model the admin screen can select', () => {
    const unpriced = Object.values(MODEL_CATALOG).flat().map((m) => m.id).filter((id) => !MODEL_PRICING_USD_PER_1M[id])
    expect(unpriced).toEqual([])
  })

  it('uses catalogued, priced models for every default profile', () => {
    for (const [profile, cfg] of Object.entries(DEFAULT_PROFILE_CONFIG)) {
      const ids = MODEL_CATALOG[cfg.provider].map((m) => m.id)
      expect(ids, `${profile} → ${cfg.model}`).toContain(cfg.model)
      expect(MODEL_PRICING_USD_PER_1M[cfg.model], `${profile} → ${cfg.model} price`).toBeDefined()
    }
  })

  it('keeps Elite off the premium model for everyday 1–3 credit tasks', () => {
    // Premium is reserved for outputs that change a real-world outcome.
    const premiumOnElite = (Object.keys(TASK_TIER_PROFILE) as CrispTask[]).filter((t) => TASK_TIER_PROFILE[t].elite === 'PREMIUM')
    const allowed = new Set<CrispTask>([
      'brand-pitch', 'rate-calculator', 'competitor-analysis', 'channel-analysis', 'foundation-analysis',
      'thumbnail-analyzer', 'viral-ideas', 'collab-finder', 'cta-optimizer',
    ])
    expect(premiumOnElite.filter((t) => !allowed.has(t))).toEqual([])
    // Every 5+ credit task still gets premium on Elite.
    for (const t of premiumOnElite) expect(CREDITS_PER_TASK[t]).toBeGreaterThanOrEqual(1)
    const expensive = (Object.keys(CREDITS_PER_TASK) as CrispTask[]).filter((t) => CREDITS_PER_TASK[t] >= 5)
    for (const t of expensive) expect(TASK_TIER_PROFILE[t].elite, t).toBe('PREMIUM')
  })
})
