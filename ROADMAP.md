# PostCrisp — Pre-Launch Roadmap

**Scope:** 32-feature launch = Phases 1-4 of PRD + Analytics Dashboard.
**Deferred to post-launch:** Image Generator, Logo Creator, Video Generator, Whiteboard Creator (require paid external APIs + cost controls — handled in a separate follow-up phase).

---

## Step 1 — Polish existing features to match PRD spec (~1 day)

Bring the four shipped features in line with the PRD, fix data gaps, add Threads platform.

- [x] **Captions (`/dashboard/generate`)**: content type selector (Post / Reel Hook / Story / Thread Opener / Script Hook), audience input, per-card character count w/ platform limit, regenerate-single, "Generate 5 more" — done 2026-04-18
- [x] **Hashtags (`/dashboard/hashtags`)**: count slider 10-30, mix slider (popular ↔ niche), 3 categorized groups with color-coded badges, selectable chips, Copy Selected / Select Optimal Mix / Save Set — done 2026-04-18
- [x] **Best Times (`/dashboard/best-times`)**: content type pills, audience region dropdown (5 regions), industry/niche dropdown (25 niches), explicit Analyze button, 45s timeout, heatmap with ice-blue→red gradient, responsive cell sizing, in-cell scores — done 2026-04-19
- [x] **Viral Ideas**: full PRD alignment — range slider 5-15, robust JSON extraction (survives truncation + JS comments), generations insert, expanded formats (11) and angles (15) including Short/Reel/TikTok and Humor/Comedy — done 2026-04-19
- [x] **Add Threads platform** — done
- [x] **Generations inserts** in all 4 AI routes (captions, hashtags, best-times, viral-ideas) — done
- [ ] **Unify `MOCK_BEST_TIMES`**: add `facebook`, `youtube`, `threads` keys or delete (currently unused dead code — low priority)

---

## Step 2 — Admin Dashboard Phase 1: AI Engine Config (~1 day) ✅ DONE 2026-04-19

Runtime-configurable AI provider/model per task so we can swap providers (Anthropic ↔ OpenAI ↔ Azure), experiment with models, and respond to outages — without code pushes.

- [x] **Schema**: `role` column on `profiles`, `ai_config_overrides` table with admin-only RLS policies
- [x] **Provider abstraction** (`src/lib/providers/`): `AIProvider` interface + `anthropicProvider` + `openaiProvider`; Azure stubbed (falls back to Anthropic)
- [x] **Engine refactor**: `crisp-engine.ts` (server) reads DB overrides (60s cache), `crisp-engine-config.ts` (client-safe types + catalog)
- [x] **Admin gate**: middleware blocks `/admin/*` for non-admin users
- [x] **Admin layout** (`/admin/*`): sidebar with AI Config active, stubs for User Mgmt / Billing / Analytics / Moderation / Audit Log (Phase 2)
- [x] **AI Config editor** (`/admin/ai-config`): all 19 tasks with provider + model dropdowns, per-row Save/Reset, **bulk edit via checkboxes + sticky action bar**
- [x] **API** (`/api/admin/ai-config`): GET/PUT (single) + POST (bulk), admin-only via `requireAdmin()` helper
- [x] **Captain admin account**: `captain@postcrisp.com` created via bootstrap SQL, upgraded to Pro, 🛡️ Admin button visible in main sidebar for admins
- [x] **Admins bypass daily cap**: `auth-usage.ts` treats `role === 'admin'` as unlimited regardless of tier
- [x] **Loose JSON parsing**: `parseLooseJson()` helper strips markdown fences, JS comments, trailing commas — survives any provider's quirks
- [x] **OpenAI JSON mode**: adapter auto-enables `response_format: json_object` when prompt mentions JSON

## Step 3 — Pricing tier & feature-gating + AI-quality-per-tier (~1-2 days)

**New strategic decision (2026-04-19):** Each subscription tier maps to a different AI quality tier in the PostCrisp Engine. This becomes a core product differentiator, not just an internal cost optimization.

**Locked tier names: Starter / Creator / Elite** (+ Team as a seat-count variant of Creator).

Tier model:
- **Starter (Free, $0/mo)**: cheapest models — Haiku / GPT-4o-mini. Per-user cost ~$1-2/mo even at heavy usage; sustainable as acquisition channel.
- **Creator ($19-29/mo)**: mid models — Sonnet / GPT-4o. Unlimited generations. Main revenue tier.
- **Team ($49/mo, up to 5 seats)**: Creator-quality AI + multi-seat management. Same AI as Creator — value is seats, not better AI.
- **Elite ($59-99/mo — price TBD)**: premium models — Opus / flagship OpenAI, with Opus forced on monetization-critical features (Brand Pitch, Competitor Analysis, Media Kit, Rate Calculator). Unlimited generations. For serious creators whose brand deals justify the spend.

**DB → UI label mapping:** `profiles.subscription_tier` DB values stay as-is (`free`, `pro`, `business`) and get mapped to display labels (`Starter`, `Creator`, `Elite`) in UI code. Add new `business` = Elite row in a migration, or rename later. Team tier needs a new schema treatment (either `team_id` on profiles or a separate `team_members` table) — decide during Step 3.

Implementation:

- [ ] **Extend `TASK_PROFILE` to `TASK_TIER_PROFILE`**: 2D matrix `(task × tier) → {provider, model}` in `crisp-engine-config.ts`
- [ ] **Update `resolveTaskConfig(task, tier)`** in `crisp-engine.ts` to route by both task AND caller's subscription tier
- [ ] **Update `crispGenerate()`** to look up caller's tier (pass through from `auth-usage` result)
- [ ] **Admin UI** changes: 3-column grid per task (Starter / Creator / Elite) with independent provider+model dropdowns per column; bulk edit extends to per-tier bulk changes
- [ ] **Add Elite tier** ($59-99/mo — price TBD after internal cost modeling): Stripe product, billing page card, landing page column
- [ ] **Add Team tier** ($49/mo, up to 5 members): Stripe product + either `team_members` table or `team_id` column on profiles. AI quality = Creator.
- [ ] **Per-feature gating**: helper in `auth-usage.ts` for `requireTier('creator' | 'team' | 'elite')` for tier-locked features (e.g., Brand Pitch is Creator+, Competitor Analysis is Elite-only)
- [ ] **User-facing "powered by" badges**: subtle tag on generation results — "🧠 PostCrisp Engine" (Starter) / "🧠 PostCrisp Engine Pro" (Creator) / "🧠 PostCrisp Engine Elite" (Elite). Never expose underlying provider names.
- [ ] **Rename UI strings**: search and replace "Pro" / "Upgrade to Pro" → "Creator" / "Upgrade to Creator" across `billing/page.tsx`, `UpgradePrompt.tsx`, `dashboard/page.tsx`, landing page, etc. (~15-20 locations)

---

## Step 4 — New AI-text features (15 features, ~2 weeks) ✅ DONE 2026-04-19

All 15 PRD features shipped + one bonus (Channel Analysis). Each has: page + API route + engine task + sidebar nav entry + EngineBadge + save to library + generation-history detail page.

**Infrastructure added:**
- `feature_access` table + `/admin/feature-access` admin UI with per-feature tier min + enabled toggle
- Grouped sidebar with 5 collapsible sections (Create / Optimize / Grow / Monetize / Library), localStorage persistence, auto-expand on active route
- Shared `FeatureGate` component: ghosts locked pages for under-tier users, overlays upgrade CTA with 4 value props per feature
- `/dashboard/generations/[id]` detail page with generic JSON-to-UI renderer for any feature output
- `getUserChannels()` helper + channel URLs section in Settings → auto-filled in YouTube SEO and Channel Analysis

**16 new features shipped:**

Monetize (Creator+ gated, Premium AI default):
- Brand Pitch Generator
- Rate Calculator
- Competitor Analysis

Create (all tiers):
- Script Generator
- Content Repurposer
- Blog-to-Social Converter
- Comment Reply Generator
- DM Template Library
- Poll/Question Generator

Optimize (all tiers, + one Creator-gated):
- YouTube SEO
- Bio Optimizer
- Platform Tips Engine
- **Channel Analysis** (Creator+ gated, bonus add — honest audit of your own channel)

Grow (all tiers):
- Trend Radar
- Sound/Audio Trend Tracker
- Collaboration Finder

**Minor polish in same step:**
- Split Log In / Sign Up on landing page header (was single "Get Started")
- Custom-niche free-text input option on Polls
- Recent Generations links → generation detail page instead of feature home
- `parseLooseJson` upgraded to handle raw control chars inside string literals

---

---

## Step 5 — Moderate-complexity features (~1 week)

- [ ] **Content Calendar** (`/dashboard/calendar`): month/week views, drag-drop rescheduling, "Auto-Fill Week" AI button, status markers, CSV/Google Calendar export. Library: `@dnd-kit` or react-big-calendar.
- [ ] **Media Kit Builder** (`/dashboard/media-kit`): profile data form, 4 template styles, PDF export. Library: `@react-pdf/renderer` or `react-to-pdf`.
- [ ] **Analytics Dashboard** (`/dashboard/analytics`): usage overview, content performance insights, posting consistency streak, AI recommendations. Library: `recharts`.

---

## Step 6 — Landing page completion (~half day)

- [ ] "How it works" 3-step section
- [ ] Pricing section (3 tiers: Free / Pro / Team)
- [ ] Testimonials placeholder with design
- [ ] FAQ accordion (8-10 questions)
- [ ] Final CTA with email capture

---

## Step 6.5 — Cost optimization pre-launch (~half day)

Token economics levers worth pulling before real traffic hits:

- [ ] **Re-map FAST tier default** in `crisp-engine-config.ts` from `claude-haiku-4-5` → `gpt-4o-mini` (~5× cheaper at $0.15/$0.60 per 1M vs Haiku's $0.80/$4)
- [ ] **Prompt caching** — current system prompts are ~12 tokens; caching requires 1,024+. Restructure by relocating stable guidance (platform char limits, content-type guidance, tone definitions, JSON schema examples, output formatting rules) OUT of the user prompt and INTO a bulked-up system prompt. Once over threshold, OpenAI's prefix caching kicks in automatically; Anthropic requires explicit `cache_control` hints in the adapter. Expected 20-40% savings on input tokens at scale.
- [ ] **Token-cost-per-feature dashboard** (part of admin Phase 2 analytics) — so we can see which features are actually expensive and tune per-feature overrides

## Step 7 — Launch prep (~1-2 days)

- [ ] Delete orphaned `src/app/login/actions.ts`
- [ ] Lower `FREE_DAILY_LIMIT` back to 10 (currently 100 for dev)
- [ ] Fix `api/viral-ideas` JSON parse error (Claude sometimes returns malformed arrays)
- [ ] **MFA for admin accounts** — required before launch. Any account with `role = 'admin'` must enroll in Supabase Auth MFA (TOTP). Block `/admin/*` access if admin hasn't enrolled. Use Supabase Auth's built-in MFA flow.
- [ ] Error boundary audit on all new pages
- [ ] Mobile responsive audit
- [ ] `npm run build` green
- [ ] Deploy to Vercel
- [ ] Production env vars
- [ ] Stripe products + webhook pointed at production domain
- [ ] Stripe Billing Portal configured
- [ ] Google OAuth enabled in Supabase
- [ ] Rotate temp admin password (`captain@postcrisp.com` is using `SH@Q5150` during dev)

---

## Other polish done in this session (Apr 18, 2026)

- Demo subtree at `/demo/*` with mock data (showcases all 4 features without real Supabase)
- `utils/supabase/middleware.ts` env-safe (won't crash when keys absent)
- `stagger-children` CSS fix: removed initial `opacity: 0` so elements don't get stuck invisible on skeleton→content transitions
- `globals.css` `@import` moved above `@tailwind` directives (Inter font now loads)
- Added `Threads` platform + 6 brand icons via `react-icons` (Simple Icons + FA for LinkedIn)
- Renamed `twitter` → `x` throughout, including PLATFORMS id, MOCK_BEST_TIMES key, demo mock
- Tones expanded to PRD spec: Casual / Professional / Humorous / Inspirational / Educational / Controversial / Storytelling
- `PLATFORM_LIMITS` helper with optimal/max numeric values
- `CONTENT_TYPES` constant (Post / Reel Hook / Story / Thread Opener / Script Hook)
- `saved_content` table patched with `type`, `content`, `platform`, `topic` columns
- `FREE_DAILY_LIMIT` raised to 100 temporarily (for dev testing) — **remember to drop back to 10 before launch**

---

## Deferred — Post-launch provider expansion

Add new provider adapters as volume + business needs justify them:

- **Gemini** (Vertex AI): Gemini 2.5 Flash Lite is the cheapest model on the market at $0.10/$0.40 per 1M — strong candidate for a new FAST tier or a third option for cost-sensitive customers. Pro tier costs compare favorably to Sonnet for ≤200K context.
- **Azure OpenAI**: same GPT models as OpenAI direct but with different billing/SLA. Value is enterprise compliance (EU data residency, BAAs, negotiated pricing) rather than capability. Wire up when a customer asks.
- **Batch / Flex processing**: for offline jobs (Trend Radar daily refresh, Platform Tips periodic updates), both OpenAI Batch and Anthropic's async modes cut cost ~50%. Useful once we add scheduled features.

## Deferred — Post-launch Phase 2: Admin Dashboard (full)

Phase 1 ships AI config editor only. After launch, build out the rest of admin to run the business:

- **User management**: list/search users, filter by tier/date, grant free Pro, flag/ban, impersonate for support, manual tier changes
- **Billing admin**: Stripe subscription overview, MRR/churn snapshot, failed payment list, manual refunds, manual trial extension, coupon management
- **Analytics dashboard**: DAU/WAU/MAU, sign-up funnel, feature usage breakdown, conversion rate Free→Pro, churn cohorts, revenue by tier, AI token cost by feature
- **Content moderation**: reported content queue, bulk delete, pattern-flagged outputs (e.g., profanity detection on saved content)
- **Support tooling**: view user's saved items / generations history, reset their daily cap, resend welcome email
- **Feature flags**: toggle individual features on/off per user or globally, soft-launch new features to Pro only
- **Audit log**: who changed what and when (admin actions, tier changes, refunds)

Scope: significant — probably 2-3 weeks of focused work. Should happen once there's real user volume to manage.

---

## Deferred — Post-launch Phase 3 (media generation)

These need paid external APIs, per-generation cost tracking, and separate rate limits. Safest to launch without them and add after the text features are validated:

- Image Generator (DALL-E or Stability ~$0.02-0.04/image)
- Logo Creator (image API + programmatic text rendering)
- Video Generator (Runway or Pika ~$0.50-5/video)
- Whiteboard Creator (SVG-based, could be built earlier if desired)

---

## Build order decision record

**Why polish before building new:** The 4 existing features are what users touch first. Fixing gaps and matching PRD spec makes the "feel" of the product coherent before adding more surface area. It also means all 4 share the same "shape" (content type, audience, regenerate patterns) which becomes a template for the 15 new features.

**Why gating infrastructure in Step 2:** The PRD makes ~10 features Pro-only and 3 features Team-only. Building the gating helper once means every new feature gets free tier-checking.

**Why defer media generation:** These are the only features requiring new external APIs, new cost models, and new failure modes. Launching without them is cleaner; adding them later is a well-scoped follow-up.
