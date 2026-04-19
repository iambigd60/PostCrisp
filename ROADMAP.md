# PostCrisp — Pre-Launch Roadmap

**Scope:** 32-feature launch = Phases 1-4 of PRD + Analytics Dashboard.
**Deferred to post-launch:** Image Generator, Logo Creator, Video Generator, Whiteboard Creator (require paid external APIs + cost controls — handled in a separate follow-up phase).

---

## Step 1 — Polish existing features to match PRD spec (~1 day)

Bring the four shipped features in line with the PRD, fix data gaps, add Threads platform.

- [x] **Captions (`/dashboard/generate`)**: content type selector (Post / Reel Hook / Story / Thread Opener / Script Hook), audience input, per-card character count w/ platform limit, regenerate-single, "Generate 5 more" — done 2026-04-18
- [x] **Hashtags (`/dashboard/hashtags`)**: count slider 10-30, mix slider (popular ↔ niche), 3 categorized groups with color-coded badges, selectable chips, Copy Selected / Select Optimal Mix / Save Set — done 2026-04-18
- [ ] **Best Times (`/dashboard/best-times`)**: add content type dropdown (Post / Reel / Story / Carousel / Live / Long-form), audience location dropdown, industry/niche dropdown, wire into the API prompt
- [ ] **Viral Ideas**: verify against PRD spec — already close
- [x] **Add Threads platform** — done
- [x] **Generations inserts** in `/api/generate` and `/api/hashtags` — done. **Still missing in `/api/best-times` and `/api/viral-ideas`.**
- [ ] **Unify `MOCK_BEST_TIMES`**: add `facebook`, `youtube`, `threads` keys or delete (currently unused dead code)

---

## Step 2 — Pricing tier & feature-gating infrastructure (~half day)

- [ ] **Add Team tier** ($49/mo, up to 5 members) to `lib/stripe.ts` `PLANS`, billing page, pricing card
- [ ] **Schema**: add `team_members` table or `team_id` column to profiles (TBD based on simpler path)
- [ ] **Per-feature gating**: helper in `auth-usage.ts` for `requireTier('pro' | 'team')` so PRO-only features cleanly block Free users
- [ ] **Update pricing table** on landing page to include Team column

---

## Step 3 — New Claude-text features (15 features, ~2 weeks)

All follow the same pattern as existing captions/hashtags: dashboard page + API route calling Claude. Ordered by user value:

**Monetization first (fastest revenue-relevant features):**
- [ ] 3.1 Brand Pitch Generator (`/dashboard/brand-pitch` + `/api/brand-pitch`)
- [ ] 3.2 Rate Calculator (`/dashboard/rate-calculator` + `/api/rate-calculator`)
- [ ] 3.3 Competitor Analysis (`/dashboard/competitor-analysis` + `/api/competitor-analysis`)

**Content creation power tools:**
- [ ] 3.4 Script Generator (`/dashboard/scripts` + `/api/script`)
- [ ] 3.5 Content Repurposer (`/dashboard/repurpose` + `/api/repurpose`)
- [ ] 3.6 Blog-to-Social Converter (`/dashboard/blog-to-social` + `/api/blog-to-social`)

**Platform optimization:**
- [ ] 3.7 YouTube SEO (`/dashboard/youtube-seo` + `/api/youtube-seo`)
- [ ] 3.8 Bio Optimizer (`/dashboard/bio-optimizer` + `/api/bio`)
- [ ] 3.9 Platform Tips Engine (`/dashboard/platform-tips` + `/api/platform-tips`)

**Engagement & community:**
- [ ] 3.10 Comment Reply Generator (`/dashboard/comment-replies` + `/api/comment-reply`)
- [ ] 3.11 DM Template Library (`/dashboard/dm-templates` + `/api/dm-template`)
- [ ] 3.12 Poll/Question Generator (`/dashboard/polls` + `/api/polls`)

**Growth:**
- [ ] 3.13 Trend Radar (`/dashboard/trends` + `/api/trends`)
- [ ] 3.14 Sound/Audio Trend Tracker (`/dashboard/sounds` + `/api/sounds`)
- [ ] 3.15 Collaboration Finder (`/dashboard/collab-finder` + `/api/collab-finder`)

---

## Step 4 — Moderate-complexity features (~1 week)

- [ ] **Content Calendar** (`/dashboard/calendar`): month/week views, drag-drop rescheduling, "Auto-Fill Week" AI button, status markers, CSV/Google Calendar export. Library: `@dnd-kit` or react-big-calendar.
- [ ] **Media Kit Builder** (`/dashboard/media-kit`): profile data form, 4 template styles, PDF export. Library: `@react-pdf/renderer` or `react-to-pdf`.
- [ ] **Analytics Dashboard** (`/dashboard/analytics`): usage overview, content performance insights, posting consistency streak, AI recommendations. Library: `recharts`.

---

## Step 5 — Landing page completion (~half day)

- [ ] "How it works" 3-step section
- [ ] Pricing section (3 tiers: Free / Pro / Team)
- [ ] Testimonials placeholder with design
- [ ] FAQ accordion (8-10 questions)
- [ ] Final CTA with email capture

---

## Step 6 — Launch prep (~1-2 days)

- [ ] Delete orphaned `src/app/login/actions.ts`
- [ ] Lower `FREE_DAILY_LIMIT` back to 10 (currently 100 for dev)
- [ ] Fix `api/viral-ideas` JSON parse error (Claude sometimes returns malformed arrays)
- [ ] Error boundary audit on all new pages
- [ ] Mobile responsive audit
- [ ] `npm run build` green
- [ ] Deploy to Vercel
- [ ] Production env vars
- [ ] Stripe products + webhook pointed at production domain
- [ ] Stripe Billing Portal configured
- [ ] Google OAuth enabled in Supabase

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

## Deferred — Post-launch Phase 2 (media generation)

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
