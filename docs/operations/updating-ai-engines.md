# Updating AI engines

PostCrisp routes every feature × tier to a provider + model through three tables and one admin screen.

## Where the models live

| What | Where | Used by |
|---|---|---|
| Code defaults per power profile (FAST / STANDARD / PREMIUM) | `DEFAULT_PROFILE_CONFIG` in `src/lib/crisp-engine-config.ts` | The engine, when no override exists |
| Which profile each feature × tier uses | `TASK_TIER_PROFILE` in the same file | The engine |
| Models the admin screen can pick | `MODEL_CATALOG` in the same file | `/admin/ai-config` dropdowns |
| Price per 1M tokens | `MODEL_PRICING_USD_PER_1M` in `src/lib/ai-costs.ts` | The cost ledger (`generation_ai_calls`) |
| Runtime overrides per feature × tier | table `ai_config_overrides` | The engine, first; wins over code defaults |

`src/lib/__tests__/engine-catalog.test.ts` fails the build if a catalogued model has no price, or if a default profile points at a model that is not catalogued.

## To add a new engine

1. Add it to `MODEL_CATALOG` with its list price in the note.
2. Add its price to `MODEL_PRICING_USD_PER_1M`. A model without a price is costed at $0 and its spend disappears from the ledger.
3. Run `npm test`.
4. Deploy. The model is now selectable in `/admin/ai-config`; nothing routes to it yet.

## To move traffic to it

- **A few cells:** in `/admin/ai-config`, change the cell and save. Takes effect within 10 seconds (the engine caches overrides for that long).
- **A whole tier or profile:** select the features, choose the tier(s), pick the model in the bulk bar, apply.
- **Back to code defaults:** select features and tiers, click bulk reset. The engine then follows `DEFAULT_PROFILE_CONFIG` and `TASK_TIER_PROFILE`.

**Production carries an override for every feature × tier** (set 2026-04-20/23), so changing the code defaults alone changes nothing live. Reset the overrides, or re-apply the new models through the bulk bar.

## Provider notes

- Anthropic calls go through `src/lib/providers/anthropic.ts` on `@anthropic-ai/sdk`. Opus 5 and Sonnet 5 run adaptive thinking by default; the adapter sends no `thinking` or `effort` parameter, so the model decides how much to think per request. Thinking tokens are billed as output.
- OpenAI calls go through `src/lib/providers/openai.ts` using `chat.completions` with `max_completion_tokens`, which the GPT-5 family accepts.
- Prices above are list prices as of 2026-09-19. Check the provider pricing page when adding a model.
