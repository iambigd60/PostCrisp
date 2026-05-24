# Beta Wave 1 — Launch Notes (operational scratch, NOT committed)

**Wave:** Beta Wave 1 — Foundation Analysis + Team-drop + NDA v1.1
**Cutover:** Soft B (canary Sat → wave Sun)
**Recruitment:** Saturday 2026-05-02 video → user hand-picks testers

---

## 2026-05-24 launch-readiness update

- Cost tracking is ready after deploy: `generation_ai_calls` records model, token, cache-token, role, tier, feature, and estimated USD cost for wired features.
- Wired cost-ledger coverage: Foundation Analysis, Channel Analysis, Thumbnail Analyzer.
- Foundation Analysis refine is disabled unless `ENABLE_FOUNDATION_REFINE=true`; leave it off for public testing until async/background processing is introduced.
- Foundation Analysis evidence is now hybrid. Users can add top-post URLs, but every URL must match the selected platform or the analysis is blocked.
- Saved social Channel URLs also enforce platform-domain matching.
- Before public cost trials, confirm production Supabase has the latest `src/lib/supabase-schema.sql` and Vercel has `SUPABASE_SERVICE_ROLE_KEY`.

---

## Monitoring tabs (open Saturday AM, refresh every 2-3 hours)

| Service | URL | What to watch |
|---|---|---|
| Sentry | https://sentry.io/ → PostCrisp → Issues, filter `is:unresolved level:error`, last 24h | Error count vs baseline. >5× = potential rollback |
| Anthropic Usage | https://console.anthropic.com/ → Usage | Spend curve. Flat = good. Exponential = bad. >$30/h sustained = rollback |
| OpenAI Usage | https://platform.openai.com/usage | Same as Anthropic. >$15/h sustained = rollback |
| Stripe webhooks | https://dashboard.stripe.com/webhooks | Should stay quiet — zero Stripe activity expected. Activity = signal something's wrong |
| Vercel deployments | https://vercel.com/[your-team]/postcrisp/deployments | Confirm current deploy ID + know which is "previous" for rollback |

---

## Current production state (post-merge 2026-05-01)

- **Current Vercel deploy:** `dpl_AT7y2BAPtqX7voFTRrjLjDMqjFys`
- **Current main HEAD:** `df47019` (merge commit: foundation-analysis branch)
- **Previous-good Vercel deploy:** _**FILL IN FROM VERCEL DASHBOARD** — the deploy that was live before `df47019` was promoted_
- **Previous-good main HEAD:** `0790e3d` (the parent of the merge commit on main)

---

## Backout criteria (rollback IMMEDIATELY if any of these)

- **Sentry error rate > 5× baseline.** Baseline ≈ _N events/hour pre-launch_ (note this Saturday morning before invites)
- **Anthropic spend > $30/hour sustained**
- **OpenAI spend > $15/hour sustained**
- **Critical user-flow regression reported by canary tester:**
  - Cannot sign in
  - Cannot access Foundation Analysis / Captions / Voice Trainer
  - Lost work — generations not persisted to DB
  - NDA acceptance loop (re-prompts after accepting and accept doesn't stick)
  - Production 500-ing on dashboard load
- **Email deliverability spam complaints** from canary testers

**Principle: stabilize first, diagnose after.** Rollback is the fast path back to safety. Diagnosis happens offline on a fresh branch, not under fire.

---

## Rollback procedure (when triggered)

1. **Vercel:** Dashboard → Deployments → previous-good deployment (see above) → "..." menu → **Promote to Production**. Production domain `postcrisp.com` now serves the previous build.
2. **Git:** revert the merge commit on main, push:
   ```
   git checkout main
   git revert -m 1 df47019
   git push origin main
   ```
   This creates a revert commit. Do NOT force-push.
3. **Comms to canary testers:** "Hi — we've rolled back today's update while we investigate an issue. Your account is fine; please pause testing until you hear from us. We'll be back online within 24-48 hours. Thanks for your patience."
4. **Diagnose offline:** open a new branch from main; investigate Sentry errors / canary feedback / logs. Fix forward; do NOT re-merge until cause identified and fix verified.

---

## Saturday AM checklist (before sending any invites)

- [ ] All monitoring tabs open + refresh test
- [ ] Sentry baseline noted (events/hour right now)
- [ ] Anthropic baseline spend noted
- [ ] Generated 8 invite codes at `/admin/invite-codes` (6-tester wave + 25% buffer)
- [ ] Confirm `FEEDBACK_NOTIFICATION_EMAIL` (or `captain@` forwarding) lands in real inbox — submit a test feedback message via FeedbackButton from a non-admin account
- [ ] Confirm `beta@postcrisp.com` forwarding is live (test from external email)

## Per-tester provisioning checklist (repeat for each canary)

- [ ] Tester signed up via single-use invite code
- [ ] Tester accepted NDA v1.1 at `/accept-terms`
- [ ] Set `subscription_tier` via `/admin/users/[id]`:
  - 2 of 3 canary → `elite` (FA gate open)
  - 1 of 3 canary → `creator` (validate non-FA flow)
- [ ] Granted +100 credits via `/admin/credit-adjustments` with reason "Beta wave 1 canary"
- [ ] Sent personal invite email from `beta@postcrisp.com` with `docs/beta-tester-feedback-focus.md` attached/inlined
- [ ] Confirmed signup + tier-up + credits via SQL:
  ```sql
  select email, subscription_tier, alpha_nda, credits_balance, created_at
  from profiles
  where email = '<canary-email>';
  ```

## Saturday afternoon — go/no-go criteria for Sunday wave-blast

**GO if all true:**
- [ ] Zero critical regressions reported
- [ ] Sentry error rate within 2× baseline
- [ ] Anthropic spend < $5 for the day
- [ ] ≥1 canary tester completed FA end-to-end successfully
- [ ] Email deliverability not flagging spam complaints

**NO-GO if any one true:**
- [ ] Critical user-flow regression reported
- [ ] Sentry error rate > 5× baseline
- [ ] Anthropic spend > $30/hour at any point
- [ ] Email deliverability complaints
- [ ] Tester says "I can't sign in" / "lost my work"

---

## Wave success criteria (Sunday evening review)

- [ ] ≥80% of invited testers completed signup
- [ ] ≥50% finished 5-step tutorial
- [ ] Sentry error rate stayed within 2× baseline through the weekend
- [ ] Zero invite-code race-condition incidents
- [ ] ≥2 testers ran FA end-to-end with downstream coherence (captions / viral-ideas / bio-optimizer reflected the saved profile)
- [ ] Anthropic total spend < $20 for the wave
- [ ] Zero NDA-acceptance-flow regressions reported

---

## Decisions log (fill in live)

| Time | Event | Decision / action |
|------|-------|------------------|
| _e.g. Sat 09:00_ | _Sentry baseline noted: 2 events/hour_ | _OK to proceed_ |
| | | |
