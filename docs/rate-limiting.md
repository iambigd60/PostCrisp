# Rate limiting (Vercel WAF)

Edge rate limiting is enforced by **Vercel Firewall (WAF)**, not by application
code. This keeps abuse blocking at the CDN edge (before a function invocation is
billed) and removes the previous Upstash Redis dependency.

Two controls work together:

1. **Vercel WAF** — per-IP request-rate ceilings at the edge (anti-bot / anti-DoS).
2. **Credit + daily-quota system** — the per-*user* business control, enforced in
   `checkAuthAndUsage` and the `consume_user_credits` RPC. This is unchanged and
   remains the authoritative per-user cap. WAF does **not** replace it.

There are no `UPSTASH_*` (or any rate-limit) environment variables. Absence of
config never causes a 503 — the old fail-closed behavior is gone.

---

## Route classification

**Expensive AI-generation routes (POST)** — each calls Anthropic/OpenAI and costs
real money per request. These are the priority surface for edge limiting:

```
/api/best-times          /api/comment-reply        /api/rate-calculator
/api/bio-optimizer       /api/competitor-analysis  /api/repurpose
/api/blog-to-social      /api/cta-optimizer        /api/script
/api/brand-pitch         /api/dm-template          /api/sounds
/api/channel-analysis    /api/foundation-analysis  /api/thumbnail-analyzer
/api/collab-finder       /api/generate             /api/trend-radar
                         /api/hashtags             /api/viral-ideas
                         /api/platform-tips        /api/youtube-seo
                         /api/polls
```

**Ordinary routes** — cheap DB/auth work (`/api/saved`, `/api/channels`,
`/api/user/*`, `/api/feedback`, `/api/access-control/*`, `/api/stripe/checkout`,
`/api/stripe/portal`, `/api/stripe/credit-pack`) and all page/asset loads.

**Must NOT be rate limited:** `/api/stripe/webhook` (Stripe sends verified bursts
and automatic retries; throttling it drops billing events) and everything outside
`/api/` (page loads, `_next/*`, static assets).

---

## Rules to configure

In the Vercel dashboard: **Project → Firewall → Custom Rules**. Both rules key on
client IP and use a fixed window. Order matters — Vercel evaluates top-down, so
put Rule 1 above Rule 2.

### Rule 1 — AI generation limiter (priority)

| Field | Value |
|---|---|
| Name | `ai-generation-limit` |
| Condition | **Request Path** `matches regex` `^/api/(best-times\|bio-optimizer\|blog-to-social\|brand-pitch\|channel-analysis\|collab-finder\|comment-reply\|competitor-analysis\|cta-optimizer\|dm-template\|foundation-analysis\|generate\|hashtags\|platform-tips\|polls\|rate-calculator\|repurpose\|script\|sounds\|thumbnail-analyzer\|trend-radar\|viral-ideas\|youtube-seo)/?$` |
| AND | **Request Method** `equals` `POST` |
| Action | **Rate Limit** |
| Key | IP address |
| Window | 60 seconds (fixed) |
| Limit | **60** requests |
| On exceed | Deny (HTTP 429) for the remainder of the window |

Rationale: a human using the dashboard fires a handful of generations per minute;
60/min/IP leaves headroom for a few users behind one NAT while a scripted loop
(hundreds/min) is blocked within seconds. Per-user cost is already bounded by
credits, so this rule only needs to stop edge-level flooding.

### Rule 2 — general API backstop (excludes the Stripe webhook)

| Field | Value |
|---|---|
| Name | `api-backstop-limit` |
| Condition | **Request Path** `starts with` `/api/` |
| AND | **Request Path** `does not equal` `/api/stripe/webhook` |
| Action | **Rate Limit** |
| Key | IP address |
| Window | 60 seconds (fixed) |
| Limit | **200** requests |
| On exceed | Deny (HTTP 429) for the remainder of the window |

Rationale: covers cheap routes (incl. `/api/feedback`, which previously had an
app-level 10/hour/user cap) at a loose ceiling so normal SPA navigation and
polling are never blocked, while a crawler hammering the API is stopped. The
explicit `/api/stripe/webhook` exclusion protects Stripe delivery. Non-`/api`
paths are never matched, so page loads and assets are untouched.

Start conservative (high) and tighten only if you observe abuse — a launch-day
false 429 is worse than a slightly loose ceiling, because credits already cap
real cost per user.

---

## How to verify

1. **Deploy** this branch, then add both rules in the Firewall UI (they apply to
   production immediately; no redeploy needed for rule edits).
2. **Normal use** — click through the dashboard generating content; confirm no 429s
   under ordinary use.
3. **AI limit** — from one IP, script 70 POSTs to `/api/hashtags` inside 60s:
   ```
   for i in $(seq 1 70); do curl -s -o /dev/null -w "%{http_code}\n" \
     -X POST https://postcrisp.com/api/hashtags -H 'Cookie: <auth>' -d '{}'; done
   ```
   Expect `200`/`402` (credits) up to the limit, then `429` once the window fills.
4. **Webhook safe** — confirm `/api/stripe/webhook` still receives events during a
   burst (Stripe CLI `stripe trigger` or dashboard "Resend"): it must never 429.
5. **Observe** — Firewall → Logs shows rule hits; use these to tune thresholds.

---

## Caveats

- **Per-IP, not per-user.** WAF keys on IP. Users behind shared NAT (offices,
  campuses, mobile carriers, corporate VPNs) share a counter and could collectively
  trip a limit; conversely, a distributed attacker across many IPs is not stopped by
  IP-keyed limits. The credit/quota system is the real per-user guarantee — WAF is a
  coarse edge backstop. Optionally add a JA4 fingerprint to the key to reduce NAT
  collisions, at some risk of false grouping.
- **Regional / eventual consistency.** Vercel enforces rate limits per edge region;
  counts are aggregated and can be slightly approximate near the threshold, so the
  effective limit may be a little higher than the configured number under
  geographically distributed traffic. Treat thresholds as soft ceilings.
- **Plan requirement.** Configurable WAF rate-limit rules require a Vercel Pro/Enterprise
  plan. If unavailable, the credit/quota system still bounds per-user cost; add the
  rules when the plan allows.
- **IPv6.** Prefer keying on the full address as Vercel provides it; if offered a
  choice of prefix aggregation, /64 grouping for IPv6 avoids trivial rotation.
