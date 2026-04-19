# PostCrisp — Where We Left Off

**Last updated:** 2026-04-19 (session 3)
**Build status:** ✅ compiling clean via HMR
**Dev server:** `npm run dev` (currently on port 3001 — stale ports held 3000)

---

## Session 3 progress — huge session

### ✅ Step 1 complete (PRD-aligned polish for all 4 core features)

- **Best Times** got content-type pills, audience region dropdown, 25-niche dropdown, 45s timeout, and a full heatmap redesign: ice-blue→red gradient, responsive cell sizing (14–32px), in-cell score readouts, legend now says Cold/Hot
- **Viral Ideas** got range slider (5–15), robust JSON parsing that survives mid-array truncation and JS-style comments, dedicated `viral_idea` save type, **full-content save** (title, meta tags, why-viral, hook, outline, hashtags, best time)
- Centralized `VIRAL_FORMATS` (11 options including Short/Reel/TikTok, Podcast, Meme) and `VIRAL_ANGLES` (15 options including Humor/Comedy) in constants
- Generations table inserts added to all 4 AI routes

### ✅ Step 2 complete — Admin Dashboard Phase 1

- **Crisp Engine** abstraction: single entry point `crispGenerate({ task, ... })`, provider-agnostic
- **Provider adapters**: `anthropicProvider` (existing) + `openaiProvider` (new, with auto JSON mode)
- **Runtime config**: admin can change AI provider/model per task from `/admin/ai-config`, no code push needed; 60s cache invalidation
- **Bulk edit**: checkboxes + sticky action bar to change multiple features at once
- **Admin account**: `captain@postcrisp.com` created via bootstrap SQL; `role=admin` column on profiles; middleware gates `/admin/*`
- **File split** for client/server safety: `crisp-engine.ts` (server) vs `crisp-engine-config.ts` (client), `providers/types.ts` (client-safe) vs `providers/index.ts` (server-only registry)

### ✅ Saved Content overhauled

- `viral_idea` type added as first-class filter tab (alongside Captions, Hashtags)
- Count badges on each filter tab
- Emerald-green card styling for viral ideas
- **Expand/Collapse** — long saved content gets a "▼ Show more" button
- Full-content save format for viral ideas

### ✅ Whitelabel the AI

- All `Claude`/`Anthropic` references removed from user-visible contexts
- Crisp Engine is the product-facing name; Anthropic/OpenAI are internal implementation detail
- Admin UI shows provider names in the dropdowns (admin-only, not user-facing)

### ✅ Other polish

- `iambigd@gmail.com` promoted to Pro tier
- `saved_content` schema patched with `type`, `content`, `platform`, `topic` columns
- Brand icons via `react-icons` (Simple Icons + FontAwesome for LinkedIn)
- Added Facebook, YouTube, Threads; renamed Twitter → X everywhere
- Tones expanded: +Humorous, +Controversial, +Storytelling
- `stagger-children` CSS fix so animations don't leave elements stuck invisible
- `@import` moved above `@tailwind` in `globals.css` so Inter font loads
- `FREE_DAILY_LIMIT` raised to 100 temporarily (for dev)

---

## Roadmap status after this session

| Step | Status |
|---|---|
| Step 1 — Polish existing | ✅ Done |
| Step 2 — Admin Phase 1 (AI config) | ✅ Done |
| Step 3 — Pricing + feature gating | ⏳ Next |
| Step 4 — 15 new AI-text features | ⏳ |
| Step 5 — Moderate features (Calendar, Media Kit, Analytics) | ⏳ |
| Step 6 — Landing page polish | ⏳ |
| Step 7 — Launch prep (MFA, Stripe, deploy) | ⏳ |
| Post-launch Phase 2 — Full admin (users/billing/analytics/moderation) | 📋 planned |
| Post-launch Phase 3 — Media generation (image/video/logo) | 📋 deferred |

---

## Next session — start here

**Step 3 in [ROADMAP.md](ROADMAP.md) — Pricing tiers + AI quality routing:**

### 🔒 Locked product decisions (2026-04-19):
- **Tier names: Starter / Creator / Elite** (+ Team as a seat-count variant of Creator)
- **Each tier maps to a Crisp Engine quality level:**
  - Starter (Free) → Haiku / GPT-4o-mini
  - Creator ($19-29/mo) → Sonnet / GPT-4o
  - Team ($49/mo, 5 seats) → same AI as Creator
  - Elite ($59-99/mo) → Opus / top OpenAI, + forced Opus on premium features
- **Never expose model names to users** — whitelabel everything as "Crisp Engine" / "Crisp Engine Pro" / "Crisp Engine Elite"
- **Per-feature badges** in the UI so users see which engine tier is running

### Implementation checklist:
- Extend `TASK_PROFILE` → `TASK_TIER_PROFILE` (2D matrix: task × tier → model)
- Update `resolveTaskConfig(task, tier)` signature, thread tier through `crispGenerate()`
- Admin UI: 3-column grid per task with per-tier provider+model dropdowns
- Add Elite + Team Stripe products (price Elite at $59, $79, or $99 — decide after cost modeling)
- `requireTier('creator' | 'team' | 'elite')` helper
- UI string rename: "Pro" → "Creator" across billing, upgrade prompts, landing, dashboard (~15-20 spots)
- "Powered by" badge component on feature results

OR we can pivot to **Step 4** (new AI features) if you'd rather keep building visible features before doing the tier rework. Both are unblocked.

---

## SQL changes you've run this session (for your records)

```sql
-- saved_content patch
ALTER TABLE public.saved_content
  ADD COLUMN IF NOT EXISTS type     TEXT NOT NULL DEFAULT 'caption',
  ADD COLUMN IF NOT EXISTS content  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS platform TEXT,
  ADD COLUMN IF NOT EXISTS topic    TEXT;

-- Admin role column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'admin'));

-- ai_config_overrides table + RLS (admins-only)
CREATE TABLE public.ai_config_overrides (...);
ENABLE ROW LEVEL SECURITY; (two admin-only policies)

-- Captain admin bootstrap (full script in the earlier message)
-- Creates auth.users row + auth.identities + sets role=admin

-- Set captain to Pro
UPDATE public.profiles SET subscription_tier = 'pro' WHERE email = 'captain@postcrisp.com';

-- Set your personal account to Pro
UPDATE public.profiles SET subscription_tier = 'pro' WHERE email = 'iambigd@gmail.com';
```

---

## Known issues to flag
- `FREE_DAILY_LIMIT` is 100 in `src/lib/auth-usage.ts` (dev only) — drop back to 10 before launch
- Admin account password `SH@Q5150` is temporary — rotate before launch
- Azure OpenAI provider shows in dropdowns but falls back to Anthropic — wire up when needed
- `MOCK_BEST_TIMES` in constants.ts is dead code — clean up at some point

## Manual setup still pending (for production launch, not dev)
- Stripe products (Pro Monthly, Pro Annual, **Team**) + webhook + portal
- Google OAuth provider in Supabase
- Vercel deploy + production env vars
- MFA enrollment for admin accounts
