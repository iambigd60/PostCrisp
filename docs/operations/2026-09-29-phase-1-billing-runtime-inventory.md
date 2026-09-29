# Phase 1 billing and runtime-control inventory

**Status:** Phase 1 started 2026-09-29 by owner decision. This is a read-only configuration and code inventory, not billing activation or proof that Phase 0 technical gates passed. See the [transition record](2026-09-29-phase-transition.md).

## Live Vercel configuration observed

The authenticated `postcrisp` Vercel project in `iambigd-6945s-projects` showed these Project variable **names** in Settings → Environment Variables on 2026-09-29. Values were not revealed.

| Production-applicable Project names | Scope | Vercel type/status |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN` | Production and Preview | Secret |
| `BETA_NOTIFICATION_EMAIL`, `FEEDBACK_NOTIFICATION_EMAIL` | Production and Preview | Config |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All Environments | Config |
| `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` | All Environments | Config; each flagged **Needs Attention** as a value that looks like a secret |

The Shared tab showed `RESEND_API_KEY` as a Secret for Production and Preview. Neither tab listed a `STRIPE_*` variable. This establishes absence from the visible Project/Shared inventory, not a paid-checkout runtime test. Both AI providers remain in scope at the owner's request; key presence does not identify their provider accounts or establish spend limits.

## Billing route configuration contract

| Flow | Server-side variables used | Current Production inventory result |
| --- | --- | --- |
| Subscription checkout | `STRIPE_SECRET_KEY`; Creator monthly/yearly price IDs (`STRIPE_PRO_MONTHLY_PRICE_ID` / `STRIPE_PRO_YEARLY_PRICE_ID` or `STRIPE_CREATOR_MONTHLY_PRICE_ID` / `STRIPE_CREATOR_YEARLY_PRICE_ID`); `STRIPE_ELITE_MONTHLY_PRICE_ID`; `STRIPE_ELITE_YEARLY_PRICE_ID`; `NEXT_PUBLIC_APP_URL` | All listed Stripe names absent; app URL name present |
| Credit-pack checkout | `STRIPE_SECRET_KEY`; `STRIPE_CREDIT_PACK_SMALL_PRICE_ID`, `STRIPE_CREDIT_PACK_MEDIUM_PRICE_ID`, `STRIPE_CREDIT_PACK_LARGE_PRICE_ID`; `NEXT_PUBLIC_APP_URL` | All listed Stripe names absent; app URL name present |
| Billing portal | `STRIPE_SECRET_KEY`; `NEXT_PUBLIC_APP_URL` | Stripe name absent; app URL name present |
| Webhook | `STRIPE_SECRET_KEY`; `STRIPE_WEBHOOK_SECRET`; `NEXT_PUBLIC_SUPABASE_URL`; `SUPABASE_SERVICE_ROLE_KEY` | Both Stripe names absent; both Supabase names present |

Sources: `src/lib/stripe.ts`, `src/lib/crisp-engine-config.ts`, and the four routes under `src/app/api/stripe/`. The subscription route checks for a missing tier/cycle price and returns 400, even though this is server configuration rather than invalid user input. The credit-pack route returns 500 with its missing variable name. The portal and webhook rely on non-null assertions for Stripe credentials, so missing configuration is handled only by later errors. None of these observations prove a successful or failed live payment.

## Next Phase 1 work

1. Add a shared server-side billing configuration check so checkout, credit-pack checkout, portal, and webhook have deliberate responses when their required Stripe settings are absent. Keep price selection server-authoritative and avoid logging secret values. Treat webhook absence as a server configuration error without weakening signature verification.
2. Keep paid billing unavailable until the intended Stripe account, mode, products/prices, webhook endpoint, and Secret values are configured and reviewed. A phase label alone does not authorize account setup or a financial transaction.
3. Resolve Vercel's Config-versus-Secret warnings for the service-role and AI keys through a controlled credential change, and prove provider account ownership, effective spend controls, and rate limits without exposing key material. Retain both OpenAI and Anthropic.
4. Carry the recovery, full migration parity, Auth hook, real generation, firewall enforcement, and independent-review work in the [transition record](2026-09-29-phase-transition.md); do not mark those checks complete based on this inventory.
