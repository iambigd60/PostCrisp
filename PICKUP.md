# PostCrisp — Where We Left Off

**Last updated:** 2026-04-18 (session 2)
**Build status:** ✅ `npm run build` passes clean
**Dev server:** Run `npm run dev` (currently on port 3003 due to stale ports holding 3000-3002)

---

## What changed this session

- Agreed on 32-feature launch scope (PRD Phases 1-4 + Analytics, media gen deferred)
- Full roadmap written to [ROADMAP.md](ROADMAP.md)
- **Step 1 (polish) progress: 2 of 4 features done**
  - ✅ Captions: content type, audience, char count, regenerate-single, generate-more
  - ✅ Hashtags: count/mix sliders, 3 categorized groups with colored chips, select optimal mix, save set
  - ⏳ Best Times: pending (add content type / region / industry dropdowns)
  - ⏳ Viral Ideas: pending (verify against PRD)
- Demo subtree at `/demo/*` (mock-data showcase)
- Brand icons via `react-icons` (Simple Icons + FontAwesome LinkedIn)
- Added Threads platform, Facebook, YouTube; renamed Twitter → X
- Extended tones: +Controversial, +Storytelling
- `saved_content` schema patched with `type`, `content`, `platform`, `topic` columns
- Multiple bug fixes: stagger-children animation leaving elements invisible, middleware crash when env vars missing, `@import` after `@tailwind` blocking Inter font

---

## Next session — start here

**Continue Step 1 of [ROADMAP.md](ROADMAP.md):**

1. **Best Times polish** (`/dashboard/best-times` + `/api/best-times`):
   - Add content type dropdown: Post / Reel / Story / Carousel / Live / Long-form Video
   - Add audience location dropdown: North America / Europe / Asia-Pacific / Latin America / Global
   - Add industry/niche dropdown
   - Wire all three into the Claude prompt
   - Add generations table insert

2. **Viral Ideas verify** (`/dashboard/viral-ideas`): compare against PRD spec, add any missing inputs/output fields. Also add generations insert + fix the JSON parse error Claude occasionally throws.

3. Then Step 2 of roadmap: pricing tier infra (Team tier, feature gating helper).

---

## Known issues to flag
- `FREE_DAILY_LIMIT` is 100 in `src/lib/auth-usage.ts` (for dev) — **drop back to 10 before launch**
- Stale Node processes hold ports 3000, 3001, 3002 — harmless but dev server keeps bumping up. Restart machine to clear.
- Don't run `npm run build` while `npm run dev` is running — they fight over `.next` and the dev server breaks.

---

## Manual setup still pending (for production launch, not needed for local dev)
- Stripe products (Pro Monthly, Pro Annual) + webhook + portal
- Google OAuth provider in Supabase
- Vercel deploy + production env vars
