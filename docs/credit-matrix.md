# PostCrisp Credit Matrix

Source of truth: `src/lib/crisp-engine-config.ts`

Last reviewed: 2026-05-24

## Tier Allowances

| Tier | Allowance | Reset Cycle | Current Price |
|---|---:|---|---:|
| Starter | 10 credits | Daily | Free |
| Creator | 500 credits | Monthly | $19/mo or $190/yr |
| Elite | 2,000 credits | Monthly | $79/mo or $790/yr |

## Credit Packs

| Pack | Credits | Price | Effective Price / Credit |
|---|---:|---:|---:|
| Small | 100 | $5 | $0.050 |
| Medium | 500 | $15 | $0.030 |
| Large | 1,500 | $40 | $0.027 |

## Per-Service Credit Costs

| Service | Task Key | Credits | Current Cost Band | Notes |
|---|---|---:|---|---|
| Caption Generator | `captions` | 1 | Fast | Short text output. Good fit for trial/free usage. |
| Hashtag Finder | `hashtags` | 1 | Fast | Short structured output. Good fit for trial/free usage. |
| Comment Replies | `comment-reply` | 1 | Fast | Short text output. Good fit for trial/free usage. |
| Polls / Questions | `polls` | 1 | Fast | Short ideation output. Good fit for trial/free usage. |
| Best Posting Times | `posting-times` | 2 | Standard | Deterministic/structured recommendation output. |
| Script Generator | `script` | 2 | Standard | Currently priced lower than other long-form tools; worth watching. |
| DM Templates | `dm-template` | 2 | Standard | Short-to-medium output. |
| Platform Tips | `platform-tips` | 2 | Standard | Advice output. |
| Bio Optimizer | `bio-optimizer` | 2 | Standard | High perceived value for low cost. Good conversion feature. |
| CTA Optimizer | `cta-optimizer` | 2 | Standard | Multi-option output with reasoning. May need review if output length grows. |
| Viral Ideas | `viral-ideas` | 3 | Heavy | Multi-idea output. |
| Content Repurposer | `repurpose` | 3 | Heavy | Multi-part output. |
| Blog-to-Social | `blog-to-social` | 3 | Heavy | Long input plus multiple outputs. |
| YouTube SEO | `youtube-seo` | 3 | Heavy | Multi-field structured output. |
| Collaboration Finder | `collab-finder` | 3 | Heavy | Strategic ideation output. |
| Trend Radar | `trend-radar` | 3 | Heavy | Discovery-style output. |
| Sound Tracker | `sound-tracker` | 3 | Heavy | Discovery-style output. |
| Thumbnail Analyzer | `thumbnail-analyzer` | 4 | Vision | Multimodal image analysis. |
| Brand Pitch | `brand-pitch` | 5 | Premium | Monetization feature; premium model routing. |
| Rate Calculator | `rate-calculator` | 5 | Premium | Monetization feature; premium model routing. |
| Competitor Analysis | `competitor-analysis` | 5 | Premium | Strategic output; likely higher token use. |
| Media Kit Bio Optimizer | `media-kit-bio` | 5 | Premium | Configured in engine but no obvious dashboard page in current navigation. |
| Channel Analysis | `channel-analysis` | 5 | Premium | Strategic self-assessment. |
| Foundation Analysis | `foundation-analysis` | 8 | Premium | Elite-only flagship analysis and Creator Profile creation. |

## Trial Planning Impact

For the proposed no-card Creator trial:

| Phase | Duration | Suggested Allowance | What It Buys |
|---|---:|---:|---|
| Creator Trial | 3 days | 10 credits/day | 10 one-credit generations, 3 heavy generations, 2 premium generations, or 1 Foundation Analysis if enabled. |
| Grace Period | 3 days | 1 generation/day | Should be implemented as 1 low-cost generation/day or 1 credit/day; clarify before build. |
| Locked | Day 7+ | 0 | Read-only access until subscription. |

Recommendation: implement grace as **1 credit/day**, not "any 1 generation/day". Otherwise a grace user could spend the one daily action on a 5-credit premium tool or an 8-credit Foundation Analysis.

## Balance Questions Before Launch

- `script` is currently 2 credits even though scripts can be long-form. Watch real token usage; it may belong at 3 credits.
- `bio-optimizer` at 2 credits is a strong trial/conversion feature and should probably stay cheap.
- `thumbnail-analyzer` at 4 credits is reasonable only if image calls stay bounded and file limits remain enforced.
- `Foundation Analysis` at 8 credits should stay Elite-only unless we intentionally use it as a paid conversion event.
- Credit packs currently make Creator's monthly 500 credits equivalent to the $15 one-time pack. That can weaken subscription value unless subscription includes feature access/model quality, not just credits.
- The product copy says paid tiers have "unlimited generations" in some places, but the engine enforces monthly credit allowances. Public copy should say credits/allowance, not unlimited.

## Cost Ledger

New provider/model call rows are stored in `generation_ai_calls` for the highest-risk cost surfaces:

- Foundation Analysis
- Channel Analysis
- Thumbnail Analyzer

Admin analytics uses these ledger rows when present and falls back to the older token-estimate method for historical or unwired generations. Extend ledger recording to the remaining generator routes before using the dashboard as a complete all-feature margin report.
