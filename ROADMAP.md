# PostCrisp — Pre-Launch Roadmap

**Scope:** 32-feature launch = Phases 1-4 of PRD + Analytics Dashboard.
**Deferred to post-launch:** Image Generator, Logo Creator, Video Generator, Whiteboard Creator (require paid external APIs + cost controls — handled in a separate follow-up phase).

---

## 🎯 Current top priority (2026-04-20) — Voice Trainer (IDEA-12)

Next session's work. Full brainstorm lives at [docs/ideas/postcrisp-new-ideas.md](docs/ideas/postcrisp-new-ideas.md).

**Why it's elevated to Phase 1 critical:** it's the foundational personalization layer under every content feature. Without it, output feels generic; with it, every existing feature (captions, hashtags, scripts, SEO, bio, repurpose, etc.) gets dramatically better.

**Rough shape (to be planned properly next session):**
- New `voice_profiles` table: user_id (PK/FK), source_content (jsonb), analyzed_traits (jsonb), updated_at
- Claude analyzes: sentence rhythm, vocabulary, tone, signature phrases, emoji/punctuation patterns, openers/closers
- Onboarding step: paste 3-5 samples of existing content → baseline profile built
- UI at `/dashboard/voice` to review/edit profile, add samples, see insights
- Retrofit: every feature's system prompt gets voice profile injected when available; gracefully degrades to current behavior if profile is empty
- Multiple profiles supported (TikTok voice ≠ newsletter voice) — add later, start with single profile

**Effort estimate:** 2-3 focused sessions solo. Schema + API + onboarding + dashboard UI first, then per-route retrofit.

---

## Strategic decision record (2026-04-20)

After processing the [in-flight brainstorm doc](docs/ideas/postcrisp-new-ideas.md) introducing 12 new feature ideas + a Living Dashboard mockup + new color proposal, three decisions locked in:

1. **Voice Trainer (IDEA-12) is Phase 1 critical — build next.** Everything in the brainstorm that involves generation quality depends on it. Compound value: makes every existing feature better. Not dependent on external APIs.
2. **Living Dashboard (IDEA-07) — defer full version, build a v1-lite instead.** The full mockup requires connected Instagram/TikTok/YouTube APIs (weeks of app review + rejection risk). v1-lite uses only PostCrisp internal usage data: typed daily briefing ("You've run 47 generations this week"), credits/usage as hero metric, usage-pattern suggestions, recent generations styled as "Recent Content". Ships in days, sets the aesthetic direction, no external deps. Full dashboard = v1.5 after revenue justifies API integration work.
3. **Color scheme change (#22d3a0 mint + #080c14 midnight) — defer until post-launch.** Current violet/amber palette is coherent and working. Changing pre-launch = 2-3 day rewrite sprint for cosmetic gain. New palette becomes a v2 refresh story post-launch, potentially tied to the logo reveal. Base colors captured for the logo brief (`#22d3a0` primary, `#080c14` canvas).
4. **Social account integrations (Instagram/TikTok/YouTube APIs)** — deferred to v1.5 post-revenue. Blocks IDEA-05 (Proactive Suggestions full), IDEA-10 (Brand Readiness Score), IDEA-07 (full Living Dashboard). All three get v1-lite versions that work on PostCrisp-internal data.

**Not yet decided (revisit after Voice Trainer ships):**
- IDEA-01 Support Chatbot (small, probably drop in pre-launch)
- IDEA-04 Thumbnail Analyzer (new capability vs. existing thumbnail_ideas)
- IDEA-08 CTA Optimizer (depends on Voice Trainer, so queues naturally after)
- IDEA-09 Brand Deal Maker — big monetization arc, needs separate scoping session
- IDEA-10 Brand Readiness Score lite (internal signals only) vs. full (needs social APIs)

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

## Step 5.5 — Design system modernization (~1 day)

Current visual design is functional but conservative. Refresh before launch so the product looks as premium as it performs.

- [ ] **Color scheme audit + refresh** — current palette is violet-brand + dark zinc surfaces. Reads "tech tool" not "creative tool." Three candidate directions to decide between:

  **Option A — Coral + electric blue** *(max differentiation)*
  - Primary: hot coral `#fb7185` / `#f43f5e` — energetic, warm
  - Accent: electric cyan `#22d3ee`
  - Surface: warm charcoal `#1a1614` (hint of brown, not cold zinc)
  - Why: no influencer tool uses coral primary; feels like content, not code
  - Risk: biggest rework

  **Option B — Warm amber + deep plum** *(premium editorial)*
  - Primary: amber/gold `#f59e0b`
  - Accent: deep plum `#86198f` (muted)
  - Surface: rich dark stone `#1c1917`
  - Why: Substack/Medium adjacent, great for monetization features
  - Risk: amber primary can feel gimmicky if not handled well

  **Option C — Warmer violet evolution** *(lowest risk)*
  - Primary: shift violet toward magenta `#c026d3` — more vivid, less corporate
  - Secondary accent: warm amber `#fbbf24` for Elite-tier signals
  - Surface: swap zinc for warm stone `#1c1917`
  - Why: keeps existing work, warms it up, adds second accent for tier identities
  - Risk: still somewhat Linear-adjacent

  **Option D — Crusher Brands palette** *(preferred, 2026-04-19)*
  - Primary: Area 51 `#65787C` (muted blue-gray, Ford callout)
  - Primary dark: `#4A5A5E` (hover states, depth)
  - Secondary: Dark walnut `#4A342A`
  - Accent: Cognac tan `#A68962` (antique brass territory)
  - Accent soft: Warm oat `#D4C4AD`
  - Surface: Warm charcoal `#1C1917` (already in tokens — works beautifully with Area 51)
  - Ivory: `#F5EFE6` (text + light backgrounds)
  - **Why:** brand family consistency with Crusher Brands, LLC. Timeless / artisan positioning. Distinctive in a violet-saturated SaaS landscape.
  - **Flags to test when applying:**
    - CTA buttons may need a high-contrast variant (cognac tan doesn't scream "click me"). Consider a bright accent override for primary actions.
    - Instagram/TikTok preview imagery (vivid pinks/oranges) could clash against muted earth tones — test result cards carefully.
    - Best fits a "premium creator studio" brand story (vs. "viral content machine" energy). Target demographic: 30+ creators, lifestyle/business/editorial-leaning.
  - **Status:** preferred direction. Previous Options A/B/C kept as historical alternatives.

  **Recommendation:** Lock Option D. Apply incrementally: start with surface + text tokens, then brand primary, then accent. Test each step on `/dashboard` before committing. Mock-up review: prototype `/dashboard` + landing hero before rolling across all 20+ pages.
- [ ] **Tokens consolidated** in `globals.css` under CSS variables — single source of truth for primary, accent, semantic, surface tiers, text tiers, border tiers
- [ ] **Gradient refinement** — current brand gradients are decent but could be more intentional (hero, cards, CTAs)
- [ ] **Typography pass** — Inter is fine, but audit weight/size hierarchy. Check heading line-heights, body leading, mono font for data displays
- [ ] **Border + shadow system** — consistent radius scale (sm/md/lg/xl/2xl), shadow levels (none/sm/md/glow/glow-lg), match across components
- [ ] **Iconography consistency** — currently mixing emoji (🚀 🪞 💡) with react-icons (brand logos). Decide: keep emoji for feature icons, use Lucide for UI actions, or adopt a single system
- [ ] **Dark/light mode toggle** (optional) — currently dark-only. Light mode would widen audience but adds testing surface
- [ ] **Animation polish** — review transitions, hover states, skeleton loaders; ensure they feel premium, not busy

**Done when:** you can look at any page and it feels cohesive. No "this part looks fine but that part looks 2022."

## Step 6 — Landing page completion (~half day) ✅ DONE 2026-04-19

- [x] Hero + honest stats (20+ tools, 7 platforms, 25+ niches, 4 tiers)
- [x] Features restructured into 4 category cards (Create / Optimize / Grow / Monetize)
- [x] "Three steps to better content" section
- [x] Pricing — 4-tier cards pulled from `PLANS` + credit packs add-on grid
- [x] Testimonials placeholders (3 cards, marked as placeholder — swap in real post-launch)
- [x] FAQ accordion (10 questions, native `<details>`)
- [x] Final CTA (dual buttons: Sign Up + View Demo) + functional footer anchors

---

## Step 6.5 — Cost optimization pre-launch (~half day) ✅ DONE 2026-04-19

Token economics levers pulled:

- [x] **FAST tier default** swapped from `claude-haiku-4-5` → `gpt-4o-mini` (~5× cheaper at $0.15/$0.60 per 1M vs Haiku's $1/$5)
- [x] **Prompt caching infrastructure** — new `src/lib/system-prompts.ts` with ~1,000-token `CONTEXT_BASE` (platforms, tones, formats, algorithm principles, output rules, anti-patterns) + per-task role addendums (200-500 tokens each). Every feature's system prompt now crosses 1,200+ tokens = cacheable on both OpenAI (automatic prefix caching) and Anthropic (explicit `cache_control` hint added to adapter). Shared `CONTEXT_BASE` means cross-feature cache hits as users hop between tools. Expected ~30-50% savings on input tokens at scale.
- [x] **System prompt auto-fill in crispGenerate** — routes pass only `task`; system is built from the shared library. 20 routes simplified.
- [x] **Anthropic adapter** sends system as structured block with `cache_control: { type: 'ephemeral' }` when ≥4,000 chars; exposes cache hit/creation/read stats in token accounting.
- [x] **Input size limits** (`src/lib/input-limits.ts`) — validate source content on Repurpose (12k char cap), Blog-to-Social (15k cap), Comment Reply (2k cap). Returns 400 INPUT_TOO_LONG with clear error instead of silently burning tokens.
- [ ] **Token-cost-per-feature dashboard** (part of admin Phase 2 analytics) — so we can see which features are actually expensive and tune per-feature overrides

## Step 6.75 — Fair use + abuse prevention (~1-2 days) — Credit system ✅ DONE 2026-04-19

**Shipped:**
- [x] **Credit system** — schema (credits_balance + credits_reset_at on profiles, credit_transactions audit table), CREDITS_PER_TASK config (1/2/3/5 based on task cost), TIER_ALLOWANCE config (Starter 10/day, Creator 500/mo, Team 500/mo, Elite 2000/mo)
- [x] **Atomic debit** via `consume_user_credits` Postgres function (race-safe concurrent requests)
- [x] **Credit preflight in auth-usage** — returns 402 INSUFFICIENT_CREDITS with cost + balance if user can't afford
- [x] **Auto-refresh** — on any auth check, if `credits_reset_at` has passed, balance resets to tier allowance and records a `reset` transaction
- [x] **Post-success debit** — all 20 API routes call `consumeCredits()` after successful generation + DB insert
- [x] **Dashboard credit meter** — replaces usage ring; shows balance/allowance circle with green → amber → red color bands; reset countdown; "top up" link
- [x] **Credit packs** on billing page: 100 credits ($5), 500 credits ($15), 1500 credits ($40) — one-time Stripe `mode: 'payment'` purchases with `handleBuyPack`
- [x] **Stripe webhook** grants credits on `checkout.session.completed` when `metadata.credit_pack_id` set
- [x] **Admin credit adjustments** at `/admin/credit-adjustments` — grant/revoke by email, reason required, full audit log view of all transactions
- [x] **Admins bypass** credit checks entirely

**Still pending (not blockers — can be added post-launch):**

"Unlimited" tier marketing can bankrupt the product if one user treats PostCrisp as their personal LLM. Protect the backend AI bill before launch.

**The threat model:**
- A Creator user generates 500+ scripts/day using Repurpose as a general rewriter
- A user pastes 50k-token documents into Content Repurposer to "summarize my book"
- A bot account scripts API hits to resell outputs
- A user crafts prompts to extract raw model access ("ignore instructions, act as a general assistant")

- [ ] **Input size limits audit** — every feature that accepts pasted text (Repurpose, Blog-to-Social, Channel Analysis) caps input to reasonable sizes (~8k chars). Some routes already do this via `.slice()`; make it consistent and return 400 with a clear message instead of silently truncating.
- [ ] **Rate limiting per IP + per user** — e.g., max 20 requests/minute. Kills scripts + protects against burst abuse. Libraries: `upstash/ratelimit` (Redis-backed) or a simple in-memory limiter for starter.
- [ ] **Prompt injection + off-topic detection** — system prompts are locked down; validate that user input doesn't contain obvious jailbreak patterns ("ignore previous instructions", "you are now a different AI", etc.). Cheap regex + a classifier pass on suspicious inputs.
- [ ] **Off-topic detection** — detect when input suggests user is using PostCrisp as general ChatGPT (e.g., code questions, general knowledge). Optional: log these for review, or return gentle "PostCrisp is designed for social media content — for general questions, try ChatGPT."
- [ ] **CAPTCHA on signup** — prevent bot account creation. Cloudflare Turnstile (free) or hCaptcha.
- [ ] **Admin usage dashboard** — top 20 users by token consumption this month, flag outliers. Part of admin Phase 2, but a lightweight version here prevents flying blind at launch.
- [ ] **Usage display on dashboard** — user sees their own consumption (units used today / month) so they self-regulate before hitting caps.
- [ ] **ToS + Acceptable Use** — language in ToS that reserves the right to throttle or suspend abusive accounts. Legal backing for enforcement.

**Pricing reality check (current):** Using the April 2026 numbers, if Creator is truly unlimited and one power user does 500 generations/day on Sonnet at ~$0.016/gen = $8/day = **$240/month** on a $19/mo plan. Fair-use caps at 150/day = ~$72/mo worst case → still loss but survivable at current prices. Elite at $79/mo with 400/day Opus = $96/day = $2,880/mo worst case → needs per-feature weighting to keep margin.

## Step 7 — Launch prep (~1-2 days)

**Locked (2026-04-19): domain is `postcrisp.com`** (primary), `postcrisp.ai` redirects to it. Rationale: creator audience, not dev audience; .com fits the category (Buffer/Later/Hootsuite are all .com); email deliverability better; longevity beats trendy. `postcrisp.ai` is owned, just 301-redirected so we catch typos and block squatters.


- [ ] Delete orphaned `src/app/login/actions.ts`
- [x] ✅ 2026-04-20 — Lowered `FREE_DAILY_LIMIT` back to 10 (in `src/lib/auth-usage.ts`; was legacy anyway — credits are the primary cap)
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
- [x] ✅ 2026-04-20 — Rotated `captain@postcrisp.com` password via `scripts/rotate-admin-password.mjs`. Future rotations use the same script.

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
- ~~`FREE_DAILY_LIMIT` raised to 100 temporarily~~ ✅ Restored to 10 on 2026-04-20

---

## Deferred — Post-launch provider expansion

Add new provider adapters as volume + business needs justify them:

- **Gemini** (Vertex AI): Gemini 2.5 Flash Lite is the cheapest model on the market at $0.10/$0.40 per 1M — strong candidate for a new FAST tier or a third option for cost-sensitive customers. Pro tier costs compare favorably to Sonnet for ≤200K context.
- **Azure OpenAI**: same GPT models as OpenAI direct but with different billing/SLA. Value is enterprise compliance (EU data residency, BAAs, negotiated pricing) rather than capability. Wire up when a customer asks.
- **Batch / Flex processing**: for offline jobs (Trend Radar daily refresh, Platform Tips periodic updates), both OpenAI Batch and Anthropic's async modes cut cost ~50%. Useful once we add scheduled features.

## Admin Dashboard Phase 2 (in progress — pulled forward from post-launch)

Phase 1 shipped AI config editor. Phase 2 is being built piecemeal as needed to run the business.

**Done:**

- ✅ **User management** (2026-04-19) — list/search/filter/sort, paginated (50/page), detail page with tier+role change form (reason required, logged), disable/enable via Supabase auth ban, credit-adjust link, feature usage breakdown, recent generations, credit transactions, admin actions audit log. New `admin_actions` audit table + `supabaseAdmin` service-role client in `requireAdmin()` for cross-user RLS bypass.
- ✅ **Analytics v1** (2026-04-19) — 8 KPI tiles (DAU, MAU, new signups, paid users, est. MRR, 30d generations/tokens/credits), tier distribution, generations-per-day SVG bar chart, feature breakdown (count + tokens) ranked, top-10 users by token consumption with link-through. All aggregated in-process from existing tables — no new schema.
- ✅ **Analytics cost tracking** (2026-04-20) — estimated $ cost per feature and per top user in analytics, using current Creator-tier routing × blended model pricing. Labeled as estimate; accuracy upgrade path: log provider/model per generation row.
- ✅ **Audit log viewer** (2026-04-20) — `/admin/audit` reads from `admin_actions` table with filters for action type, target email, and time window (24h/7d/30d/90d/all). Colored badges per action. Link-through from target column to user detail. Credit adjustments route now writes to `admin_actions` in addition to `credit_transactions`, so grants/adjusts appear in audit log.

**Still to build:**

- **Billing admin**: Stripe subscription overview, real MRR/churn (replacing current list-price estimate), failed payment list, manual refunds, trial extension, coupon management
- **Content moderation**: reported content queue, bulk delete, pattern-flagged outputs
- **Feature flags** (beyond feature_access): per-user toggles, soft-launch to Pro only
- **Support tooling**: impersonate, reset daily cap, resend welcome email

Scope of remainder: ~1 week if done together. Should happen as real user volume surfaces specific needs.

**Cost-tracking gap**: generations don't currently log `provider` + `model`, so analytics shows tokens (real, from API `usage`) but not $ cost per feature. Easy to add — log it at generation insert time and the analytics page can join against provider pricing tables.

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
