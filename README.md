# PostCrisp

AI-powered content platform for social-media creators. Built on Next.js 14 (App Router), Supabase, Stripe, and routed AI providers (Anthropic + OpenAI) via the in-house PostCrisp Engine.

Currently in invite-only alpha (`Crusher Brands, LLC`).

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Next.js ESLint |
| `npm run typecheck` | `tsc --noEmit` — strict TS check |
| `npm test` | Vitest run (single pass) |
| `npm run test:watch` | Vitest watch mode |

## Environment variables

Required (server, set in Vercel + `.env.local`):

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (browser-safe) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only — bypasses RLS, used by admin routes |
| `ANTHROPIC_API_KEY` | PostCrisp Engine — Anthropic provider |
| `OPENAI_API_KEY` | PostCrisp Engine — OpenAI provider |
| `STRIPE_SECRET_KEY` | Stripe billing (test/prod modes via key prefix) |
| `STRIPE_WEBHOOK_SECRET` | Verifies inbound Stripe events |
| `STRIPE_CREATOR_MONTHLY_PRICE_ID` | + `_YEARLY_`, `STRIPE_TEAM_*`, `STRIPE_ELITE_*` per tier/cycle |
| `RESEND_API_KEY` | Transactional email (auth, feedback notifications) |

Required (observability + rate limiting, both server + client):

| Var | Purpose |
|---|---|
| `SENTRY_DSN` | Server-side error capture (API routes, edge runtime) |
| `NEXT_PUBLIC_SENTRY_DSN` | Browser-side error capture — same value as `SENTRY_DSN`, but `NEXT_PUBLIC_` prefix is required for browser bundle inlining |
| `UPSTASH_REDIS_REST_URL` | Rate limiter backend |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiter auth |

Optional:

| Var | Purpose |
|---|---|
| `SENTRY_ORG`, `SENTRY_PROJECT` | Sentry source-map upload metadata |
| `SENTRY_AUTH_TOKEN` | Enables source-map upload on build |
| `FEEDBACK_NOTIFICATION_EMAIL` | Override admin notification address (default: captain@postcrisp.com) |

Sentry is gated on `VERCEL_ENV === 'production' || 'preview'` — it intentionally does not capture from local dev.

## CI

GitHub Actions runs `lint`, `typecheck`, and `test` on every PR and push to `main`. Failed checks block merge. Workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Deploy

Auto-deploys to Vercel on push to `main`. No manual step required.
