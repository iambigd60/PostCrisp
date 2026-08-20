# Codex — independent diagnosis: onboarding_events telemetry pipeline

**Run:** Codex job `task-mt041f1w-pntwrk` (session `01a01a25-e371-76e1-9e05-a94536a17095`), 2026-08-19, 11m 30s, read-only.
**Brief:** determine whether the write path is actually functional, and identify every way it can fail silently.
**Analysed commit:** `fc3d305` — i.e. BEFORE the hardening in `f9c72ee`.

## How this reads today

Reproduced verbatim below. Three notes for anyone reading it later:

- Its headline finding ("not verified functional end-to-end") was true when written and has since been **settled**: the admin probe wrote and read back row `id 1` in production on 2026-08-19, and a direct service-role query confirmed it independently.
- Silent-failure modes **7, 8, 10, 11, 12, 13 and 18** were closed by `f9c72ee`. Mode **17** (unawaited emit immediately before `router.replace`) was closed afterwards by adding `keepalive: true` to the shared emitter.
- Modes **1, 4, 5 and 6** are producer-side gates that only server-side emission would cover — the deliberately skipped "part 4". They remain open, and this document is the best evidence for revisiting that decision.
- Its one unresolved clue — whether the 5 `tutorial_redemptions` rows postdated the deploy — resolves in favour of its own conclusion: they are dated 2026-04-25 → 04-27, from the migration backfill.

---

## 1. Summary verdict

The production write path is deployed and schema-ready, but it is **not verified functional end-to-end** because no production request has reached `/api/onboarding/event` and no successful production insert has been observed.

The strongest explanation for 0 rows is upstream of Supabase:

- Production is running current commit `fc3d305`; its build includes `/api/onboarding/event`.
- `public.onboarding_events` exists with the expected five columns, RLS enabled, no policies, and 0 rows.
- The migration is recorded in production.
- Since deployment, Vercel recorded one `GET /onboarding` at `2026-08-19 02:12:43 UTC`, followed by dashboard requests one second later.
- There were no `/api/onboarding/event` requests and no `[onboarding-events]` failure logs.
- Production signup is currently `invite`-only.
- Therefore that observed visit most likely belonged to an already-onboarded account that hit the completion gate and was redirected before either entry event was emitted.

The database side is unlikely to be the present root cause. The table and columns match, and another production endpoint using the same `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` successfully called Supabase’s admin API after this deployment.

However, the pipeline is fragile: the client ignores every telemetry HTTP result, while the API deliberately returns `{ok:true}` even when the database insert failed. Thus a future RLS, grant, migration, environment, or database failure can still produce 0 rows without any user-visible failure.

## 2. Silent-failure modes

1. **Already-completed accounts return before the first producer call — confirmed and most likely.**

   In [`OnboardingPage` lines 53-88](/C:/Projects/postcrisp/src/app/onboarding/page.tsx:53):

   ```ts
   if (hasFinishedFirstSession(!!tp?.completed, prefs.onboarded_at)) {
     router.replace('/dashboard')
     return
   }
   ...
   logEvent(tp ? 'first_session_resumed' : 'first_session_started')
   ```

   [`hasFinishedFirstSession` lines 59-64](/C:/Projects/postcrisp/src/lib/first-session-state.ts:59) treats either completed state or any non-null `onboarded_at` value as finished:

   ```ts
   return tutorialCompleted || onboardedAt != null
   ```

   Silence mechanism: the event function is never called, so there is no API request, database error, or telemetry log. This matches the live `/onboarding` → dashboard sequence.

2. **Existing password logins do not automatically enter onboarding — confirmed routing behavior.**

   [`login()` lines 36-38](/C:/Projects/postcrisp/src/app/(auth)/login/actions.ts:36) always sends a successful password login to the dashboard:

   ```ts
   revalidatePath('/', 'layout')
   redirect('/dashboard')
   ```

   Google/email callback routing also sends completed users directly to the dashboard in [`chooseDestination` lines 47-65](/C:/Projects/postcrisp/src/lib/post-auth-destination.ts:47).

   Silence mechanism: ordinary app usage by existing users generates no onboarding telemetry. “The app is running” therefore says little about whether the producer is being exercised.

3. **Invite-only signup sharply limits eligible new onboarding sessions — confirmed live configuration.**

   Production currently reports:

   ```json
   {"signup_mode":"invite","login_enabled":true}
   ```

   The corresponding gate is [`signup()` lines 25-49](/C:/Projects/postcrisp/src/app/(auth)/signup/actions.ts:25):

   ```ts
   if (access.signup_mode === 'closed') return ...
   if (access.signup_mode === 'invite') {
     if (!inviteCode) return ...
     ...
   }
   ```

   Only successful signups reach the explicit `redirect('/onboarding')` at [lines 93-98](/C:/Projects/postcrisp/src/app/(auth)/signup/actions.ts:93). This is not an insertion failure, but it can legitimately leave the table empty.

4. **The legal-acceptance layout can prevent the client producer from mounting.**

   [`OnboardingLayout` lines 8-15](/C:/Projects/postcrisp/src/app/onboarding/layout.tsx:8) runs:

   ```ts
   await requireAlphaAcceptance('/onboarding')
   ```

   [`requireAlphaAcceptance` lines 35-45](/C:/Projects/postcrisp/src/lib/alpha-agreement-server.ts:35) redirects accounts without current acceptance:

   ```ts
   if (hasCurrentAcceptance(...)) return
   redirect(`/accept-terms?next=...`)
   ```

   Silence mechanism: the client page and its `useEffect` never render, so no event is attempted. This does not appear to explain the observed 200 response, but it is an independent producer gate.

5. **Missing/expired client authentication returns before event emission.**

   [`OnboardingPage` lines 53-60](/C:/Projects/postcrisp/src/app/onboarding/page.tsx:53):

   ```ts
   const { data: { user } } = await supabase.auth.getUser()
   if (!user) {
     router.replace('/login')
     return
   }
   ```

   Silence mechanism: the returned Supabase Auth `error` is ignored, and no diagnostic is logged before redirecting. The client Sentry configuration also explicitly suppresses `AuthRetryableFetchError` and similar messages at [`sentry.client.config.ts` lines 41-49](/C:/Projects/postcrisp/sentry.client.config.ts:41).

6. **Hydration, JavaScript, or an exception before the effect reaches `logEvent` eliminates all telemetry.**

   All entry telemetry exists inside the client-only `useEffect` at [`page.tsx` lines 53-89](/C:/Projects/postcrisp/src/app/onboarding/page.tsx:53). Its async IIFE has no outer `try/catch`:

   ```ts
   ;(async () => {
     await supabase.auth.getUser()
     ...
     logEvent(...)
   })()
   ```

   Silence mechanism: a hydration/chunk failure, early page close, or thrown preflight error prevents the request. A page-level server `GET /onboarding` does not prove this browser effect ran.

7. **Every browser producer swallows network failures.**

   The page wrapper at [`page.tsx` lines 107-113](/C:/Projects/postcrisp/src/app/onboarding/page.tsx:107) is:

   ```ts
   void fetch('/api/onboarding/event', { ... }).catch(() => {})
   ```

   The same pattern is duplicated in [`PackStage.emitOnboardingEvent` lines 64-70](/C:/Projects/postcrisp/src/components/onboarding/PackStage.tsx:64) and [`OwnStage.savePack` lines 60-64](/C:/Projects/postcrisp/src/components/onboarding/OwnStage.tsx:60).

   Silence mechanism: offline failures, connection resets, request blocking, and other rejected fetches are discarded with an empty catch—no console message, retry, queue, or UI signal.

8. **HTTP 4xx/5xx responses are treated as success by the client.**

   Those same wrappers never await the response or inspect `response.ok`.

   Browser `fetch()` resolves normally for HTTP errors; consequently `.catch(() => {})` does not run for a 400, 401, or 500.

   Silence mechanism: the request can be rejected by the application while the producer observes nothing at all.

9. **Route authentication failure returns an unlogged 401.**

   [`POST` lines 16-19](/C:/Projects/postcrisp/src/app/api/onboarding/event/route.ts:16):

   ```ts
   const { data: { user } } = await supabase.auth.getUser()
   if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
   ```

   Silence mechanism: `auth.getUser()`’s error is not inspected, the route emits no server log, and the browser ignores the 401 response.

10. **Payload validation failures return unlogged 400s; producer typing does not prevent name drift.**

    [`POST` lines 21-40](/C:/Projects/postcrisp/src/app/api/onboarding/event/route.ts:21) returns 400 for malformed JSON, an unknown name, or detail over 2,000 bytes.

    Meanwhile both helpers accept `name: string`, not `OnboardingEventName`, at [`page.tsx` line 107](/C:/Projects/postcrisp/src/app/onboarding/page.tsx:107) and [`PackStage.tsx` line 65](/C:/Projects/postcrisp/src/components/onboarding/PackStage.tsx:65).

    Silence mechanism: a future spelling drift compiles, returns 400, and is ignored. Current names all match the union at [`onboarding-events.ts` lines 15-31](/C:/Projects/postcrisp/src/lib/onboarding-events.ts:15), and current details are small, so this is latent rather than the present cause.

11. **The API returns `{ok:true}` even when the database insert failed.**

    [`POST` lines 43-45](/C:/Projects/postcrisp/src/app/api/onboarding/event/route.ts:43):

    ```ts
    await logOnboardingEvent(user.id, name, safeDetail)
    return NextResponse.json({ ok: true })
    ```

    But [`logOnboardingEvent` lines 52-68](/C:/Projects/postcrisp/src/lib/onboarding-events.ts:52) catches or absorbs all failures and returns `void`.

    Silence mechanism: even an awaited caller would receive HTTP 200 after a failed insert.

12. **PostgREST errors resolve instead of throwing; `try/catch` alone would miss them.**

    [`logOnboardingEvent` lines 54-63](/C:/Projects/postcrisp/src/lib/onboarding-events.ts:54) correctly checks the returned `error`, but only logs and drops it:

    ```ts
    const { error } = await client.from('onboarding_events').insert(...)
    if (error) console.error(...)
    ```

    Supabase’s current documentation confirms that database calls return a `{data, error}` pair unless `.throwOnError()` is used. [Supabase error handling](https://supabase.com/docs/guides/api/handling-errors-in-supabase-js), [throwOnError](https://supabase.com/docs/reference/javascript/using-modifiers-throwonerror).

    Silence mechanism: error is visible only as a server console line; the route still returns 200 and the client ignores it.

13. **Missing, invalid, or cross-project Supabase environment values are absorbed.**

    [`serviceWriter()` lines 38-43](/C:/Projects/postcrisp/src/lib/onboarding-events.ts:38):

    ```ts
    createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      ...
    )
    ```

    The `!` assertions provide no runtime validation.

    - Missing URL/key can throw and be caught at lines 64-68.
    - An invalid key can resolve with an authorization error.
    - A wrong URL can fail because the table is absent—or successfully write to another project.

    All cases are logged and dropped, followed by HTTP 200. Current live evidence makes this unlikely: the same variables power successful admin Supabase calls in [`getAdminClient()` lines 9-13](/C:/Projects/postcrisp/src/app/api/admin/users/[id]/route.ts:9).

14. **RLS/grant configuration blocks every non-service-role insert.**

    The migration intentionally enables RLS with no policies and revokes client roles at [`20260819010835_onboarding_events.sql` lines 14-18](/C:/Projects/postcrisp/supabase/migrations/20260819010835_onboarding_events.sql:14):

    ```sql
    ALTER TABLE ... ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ... FROM PUBLIC, anon, authenticated;
    GRANT SELECT, INSERT ... TO service_role;
    GRANT USAGE, SELECT ON SEQUENCE ... TO service_role;
    ```

    Live security advisors confirm that no policies exist. A genuine service-role Authorization header bypasses RLS, as documented by Supabase. [RLS service-key behavior](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z).

    Silent failure occurs if the environment accidentally contains the anon/publishable key, if table/sequence grants are missing, or if the Data API cannot expose the table. The resulting error is logged, dropped, and converted to route HTTP 200. Exact live grants could not be queried.

15. **Missing or drifted migration/schema failures are deliberately non-fatal.**

    The repo explicitly warns that a missing table “silently blinds” the funnel at [`supabase/migrations/README.md` lines 20-22](/C:/Projects/postcrisp/supabase/migrations/README.md:20).

    Table creation is `CREATE TABLE IF NOT EXISTS` at [`20260819010835_onboarding_events.sql` lines 1-7](/C:/Projects/postcrisp/supabase/migrations/20260819010835_onboarding_events.sql:1). Missing table, missing column, stale PostgREST schema cache, or incompatible pre-existing table would return an insert error that is absorbed as above.

    This is ruled out for current production: the migration is recorded and live columns are exactly `id`, `user_id`, `name`, `detail`, and `created_at`.

16. **Foreign-key and database-runtime failures are hidden from the caller.**

    The live/migrated `user_id` references `auth.users(id)` at [`migration` line 3](/C:/Projects/postcrisp/supabase/migrations/20260819010835_onboarding_events.sql:3). A user deleted between `getUser()` and insert, database exhaustion, quota limits, PostgREST outage, timeout, or transient network error can reject the write.

    Silence mechanism: resolved errors or thrown exceptions both terminate inside `logOnboardingEvent`; the API still responds 200.

17. **Immediate navigation makes late events less reliable.**

    [`handleLater` lines 115-119](/C:/Projects/postcrisp/src/app/onboarding/page.tsx:115) and [`handleFinish` lines 142-148](/C:/Projects/postcrisp/src/app/onboarding/page.tsx:142) emit an unawaited event and immediately call `router.replace('/dashboard')`.

    There is no `keepalive`, `sendBeacon`, retry, or acknowledgment. Next.js client navigation usually permits an in-flight fetch to continue, so this is not deterministic, but page unload/close or a hard navigation can lose it. It cannot explain missing entry events that should fire while Ask remains visible.

18. **Handled insert failures do not become durable Sentry errors.**

    Server instrumentation forwards only uncaught request errors at [`instrumentation.ts` lines 13-17](/C:/Projects/postcrisp/src/instrumentation.ts:13). Insert errors are caught and reduced to `console.error`, while [`sentry.server.config.ts` lines 10-19](/C:/Projects/postcrisp/sentry.server.config.ts:10) contains no explicit capture for these handled errors.

    Silence mechanism: no alert or exception event; the only trace is a Vercel console log subject to query windows and retention. There is also no success log.

No batching, queue, or flush mechanism exists. Repository-wide searches found one direct insert, three fetch wrappers, and zero onboarding queue/batch/flush code.

## 3. Likelihood ranking

1. **No eligible onboarding session after telemetry deployment / completed-state redirect — high confidence.** The code was deployed only at 01:28 UTC, signup is invite-only, and the sole observed `/onboarding` request immediately transitioned into dashboard traffic without calling the event endpoint.

2. **The observed visit’s client effect never reached the producer—high-to-medium confidence.** Completion redirect is the best explanation; client authentication failure or hydration/lifecycle failure are alternatives.

3. **Fire-and-forget request loss or ignored HTTP response during a genuine eligible session — medium confidence if someone can confirm they saw the Ask screen after 01:28 UTC.** There is no production endpoint-hit evidence yet.

4. **Route-level 401 caused by session/cookie state — medium-low confidence.** It would be completely silent to the producer, but no event route request was observed.

5. **Service-role/RLS/grant/environment failure — low confidence.** The correct table exists, service-role operations work elsewhere, RLS is intentionally policyless, and no logger error appeared.

6. **Migration/table/column mismatch — very low confidence and currently ruled out by live schema metadata.**

One unresolved clue: `tutorial_redemptions` has 5 live rows. Their timestamps were unavailable. If they were created by real onboarding runs after 01:28 UTC, the “no eligible session” conclusion would weaken substantially and client dispatch would become the leading suspect.

## 4. Live checks still required

- **Profile eligibility:** Count production profiles where neither `tutorial_progress.completed` nor non-null `onboarded_at` is set. This confirms whether any account could reach the producer.
- **Redemption timestamps:** Inspect the five `tutorial_redemptions.redeemed_at` values and associated feature counts. Determine whether they predate the telemetry-capable deployment or prove a post-deployment Pack run.
- **Exact grants:** Query `information_schema.role_table_grants` and `has_sequence_privilege()` for `service_role`, `onboarding_events`, and `onboarding_events_id_seq`. Raw SQL access was rejected by the connector, so only the committed migration—not current grants—was verified.
- **Vercel environment:** Confirm the production-scoped URL and service key are present, refer to `sikabeqzypvllimyostg`, and are available to the newest deployment. Current behavior strongly implies this but does not expose the actual values.
- **Authenticated eligible browser trace:** With a non-production or deliberately eligible test account, verify:
  1. `POST /api/onboarding/event` appears in Network,
  2. it returns 200,
  3. Supabase logs show `POST /rest/v1/onboarding_events`,
  4. the table count increments.
- **Route integration coverage:** The existing 48 relevant tests pass, but the telemetry tests inject a fake writer at [`onboarding-events.test.ts` lines 23-65](/C:/Projects/postcrisp/src/lib/__tests__/onboarding-events.test.ts:23). There is no test covering browser producer → authenticated route → service-role client → real RLS/grants/database.

No repository files were changed; the worktree remains clean.


Codex session ID: 01a01a25-e371-76e1-9e05-a94536a17095
Resume in Codex: codex resume 01a01a25-e371-76e1-9e05-a94536a17095
