# PostCrisp — Where We Left Off

**Last updated:** 2026-04-19 (session 5 — Step 3 + Step 4 + paywall teasers shipped)
**Build status:** ✅ HMR running clean last time we checked
**Dev server:** `npm run dev` (port 3000 or next available)

---

## What this session shipped (it was a big one)

### Step 3 — Tier architecture (locked)
- Tier names: **Starter / Creator / Team / Elite** (Team mirrors Creator AI)
- `TASK_TIER_PROFILE` 2D matrix: every task × tier has its own PowerProfile
- `crispGenerate({ task, tier, ... })` threads tier through the engine
- `ai_config_overrides` table now composite-keyed `(task, tier)` — admin can route each cell independently
- `/admin/ai-config` shows a 3-column grid (Starter / Creator / Elite) with bulk edit + tier multi-select
- "Pro" → "Creator" renamed throughout billing, upgrade prompts, landing, dashboard
- 4-tier pricing cards on `/dashboard/billing` + feature comparison matrix
- `EngineBadge` component on every feature result header ("🧠 PostCrisp Engine" / "Pro" / "Elite" based on tier)

### Step 4 — 16 new features
- **Monetize:** Brand Pitch · Rate Calculator · Competitor Analysis (Creator+ gated)
- **Create:** Script Generator · Content Repurposer · Blog-to-Social · Comment Reply · DM Templates · Polls
- **Optimize:** YouTube SEO · Bio Optimizer · Platform Tips · **Channel Analysis** (Creator+)
- **Grow:** Trend Radar · Sound Tracker · Collab Finder

### Platform infrastructure
- **Feature access admin** — `/admin/feature-access` lets you change per-feature min tier + enabled toggle at runtime
- **FeatureGate component** — locked pages render ghosted+blurred with centered upgrade CTA overlay (value props per feature). Admins bypass.
- **Grouped sidebar** — 5 sections (Create / Optimize / Grow / Monetize / Library), collapsible with chevron, localStorage persistence, auto-expand on active route
- **Channel URLs in Settings** — stored in `preferences.channels` JSONB, no schema change. Auto-filled in YouTube SEO + Channel Analysis. Extensible to other features.
- **`/dashboard/generations/[id]`** — detail page with generic JSON-to-UI renderer for any feature's output. Supports Save-to-library, Delete, and Run-again.
- **Dashboard Recent Generations** — every feature type gets icon + meaningful preview line

### Misc polish
- Landing page: Log In and Sign Up split into separate buttons in header
- Hero "Start Creating" CTA now goes to `/signup` directly
- Polls page: toggle between preset niche dropdown and free-text custom niche
- "PostCrisp Engine" renamed from "Crisp Engine" (brand collision with real "Crisp AI" company)
- `parseLooseJson` hardened: handles control chars inside string literals (GPT occasionally returns raw newlines inside values)
- OpenAI adapter auto-enables `response_format: json_object` when JSON is requested
- Preferences API now merges instead of overwrites (so saving channels doesn't wipe platform/tone defaults)

---

## Status snapshot

| Step | Status |
|---|---|
| Step 1 — Polish existing | ✅ Done |
| Step 2 — Admin Phase 1 (AI config) | ✅ Done |
| Step 3 — Tiers (Starter/Creator/Team/Elite) | ✅ Done |
| Step 4 — 16 new features + paywalls | ✅ Done |
| Step 5 — Moderate features (Calendar, Media Kit, Analytics) | ⏳ Next option |
| Step 6 — Landing page polish | ⏳ |
| Step 6.5 — Cost optimization (prompt caching, FAST→4o-mini) | ⏳ |
| Step 7 — Launch prep (MFA, Stripe prod, Vercel) | ⏳ |
| Post-launch Phase 2 — Full admin | 📋 Planned |
| Post-launch Phase 3 — Media generation | 📋 Deferred |

---

## Next session — decision point

Two paths:

**A. Ship sooner** (3-4 days): Step 6 (landing) → 6.5 (cost) → 7 (deploy). Content Calendar / Media Kit / Analytics become post-launch roadmap. Get real users faster.

**B. Feature-rich launch** (10-14 days): Step 5 first. Content Calendar (drag-drop + AI auto-fill week), Media Kit Builder (PDF export), Analytics Dashboard (charts). Then 6-7.

Pick one when you come back.

---

## SQL migrations run this session (for your records)

```sql
-- Step 3: Tier values + composite-keyed AI config overrides
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_subscription_tier_check;
UPDATE public.profiles SET subscription_tier = 'creator' WHERE subscription_tier = 'pro';
UPDATE public.profiles SET subscription_tier = 'elite'   WHERE subscription_tier = 'business';
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'creator', 'team', 'elite'));

DROP TABLE IF EXISTS public.ai_config_overrides;
CREATE TABLE public.ai_config_overrides (
  task TEXT NOT NULL, tier TEXT NOT NULL CHECK (tier IN ('starter','creator','elite')),
  provider TEXT NOT NULL, model TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (task, tier)
);
ALTER TABLE public.ai_config_overrides ENABLE ROW LEVEL SECURITY;
-- + admin-only RLS policies

-- Step 4: Feature access
CREATE TABLE IF NOT EXISTS public.feature_access (
  feature TEXT PRIMARY KEY,
  min_tier TEXT NOT NULL CHECK (min_tier IN ('starter','creator','team','elite')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.feature_access ENABLE ROW LEVEL SECURITY;
-- + admin-only RLS policies
```

No new SQL needed next session unless Step 5 adds schema (Content Calendar would need a `scheduled_posts` table).

---

## Known issues / punchlist
- `FREE_DAILY_LIMIT = 100` in `src/lib/auth-usage.ts` — drop to 10 before launch
- Admin password `SH@Q5150` — rotate before launch
- Azure provider shows in admin dropdowns but falls back to Anthropic (not yet wired)
- `MOCK_BEST_TIMES` constant is dead code, safe to delete
- Feature rename: Step 7 punchlist includes turning code references of `crisp-engine*` → `postcrisp-engine*` if we ever care (not user-facing, low priority)

## Manual setup still pending (for production, not dev)
- Create Stripe products: Creator Monthly/Yearly, Team Monthly/Yearly, Elite Monthly/Yearly (6 price IDs total)
- Configure Stripe Billing Portal
- Register webhook endpoint for production
- Google OAuth in Supabase Auth settings
- Vercel project + production env vars
- MFA enrollment for `captain@postcrisp.com`
