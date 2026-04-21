# PostCrisp — New Feature Ideas (Flight Brainstorm)
> Generated: April 20, 2026
> Status: Pending PRD Integration
> Source: In-flight brainstorm session

---

## DESIGN PRINCIPLES (Apply to ALL features)

### North Star Principle
PostCrisp does not just generate — it **understands context, scores, explains, and improves.**
Every feature must leverage the user's profile (niche, platform, audience, voice) to produce personalized output. A blank text box that spits out generic AI content is NOT a PostCrisp feature.

### Scoring Opacity Rule
Proprietary scoring algorithms are **never published to users.**
- Users see directional hints only (e.g. "Your consistency could be stronger")
- Full scoring logic lives in codebase and internal PRD only
- Prevents gaming, protects competitive moat, maintains brand partner trust
- Model: FICO credit scoring opacity

### Approved Color System
| Token | Value |
|-------|-------|
| Background | `#080c14` |
| Primary Accent | `#22d3a0` |
| Card Surface | `rgba(255,255,255,0.04)` |
| Tone | Dark, premium, always-on AI |

### Tagline Candidate
> *"PostCrisp is always watching your channel so you don't have to."*

---

## FEATURE IDEAS

---

### IDEA-01 — Support Chatbot Widget
**Category:** Infrastructure / Support
**Tier:** All tiers
**Phase:** Early

**Description:**
Embed a free support chatbot to reduce inbound support volume and handle common user questions automatically.

**Recommended Tools:**
- Crisp (on-brand, free tier, live chat + bot)
- Tawk.to (free forever, solid widget)
- Tidio (free tier, some AI capability)

**Implementation Notes:**
- Simple embed script in Next.js layout component
- No backend required
- Recommended: Crisp or Tawk.to for bootstrapped stage

---

### IDEA-02 — Influencer-Inspired Color Scheme Templates
**Category:** Personalization / Branding
**Tier:** Pro
**Phase:** 2–3
**Depends On:** Social account connections, Claude vision API

**Description:**
User selects 5–10 favorite influencers. PostCrisp analyzes their public visual aesthetic and generates a personalized color palette and theme suggestion inspired by those accounts.

**How It Works:**
1. User searches and adds up to 10 influencers they admire
2. PostCrisp pulls public profile/post imagery
3. Claude analyzes: dominant colors, font vibes, overall aesthetic
4. System generates a blended "inspired by" color scheme
5. User can accept, tweak, or regenerate

**Open Questions:**
- Data source for imagery (Instagram/TikTok/YouTube APIs — access varies)
- Blend all 5–10 or let user pick primary influencer
- Whether to offer individual vs. blended palette options

**Tie-ins:** Feeds into all content generation features, thumbnail generator, video templates

---

### IDEA-03 — In-App Video Generator
**Category:** Content Creation
**Tier:** Pro / Team
**Phase:** 3–4
**Depends On:** Third-party rendering API

**Description:**
CapCut-style video generator. User uploads multiple video clips, PostCrisp assembles and renders a finished short-form video.

**API Candidates:**
| Service | Notes |
|---------|-------|
| Shotstack | JSON timeline-based, purpose-built for SaaS, free tier |
| Creatomate | REST API, SaaS-friendly pricing, great docs |
| Remotion | React-based, open source, fits Next.js stack |

**Recommendation:** Shotstack or Creatomate for v1

**Notes:**
- Video rendering is compute-heavy — Pro/Team tier only
- Helps justify $19–$49/mo pricing
- Repurposed shorts from Content Repurposer (IDEA-11) feed directly here

---

### IDEA-04 — Thumbnail Analyzer
**Category:** Content Optimization
**Tier:** Pro
**Phase:** 2
**Depends On:** Claude vision API

**Description:**
User uploads or links a thumbnail. Claude scores it across key performance factors and returns actionable improvement suggestions.

**Scoring Factors:**
- Text readability (legible at small sizes?)
- Color contrast (pops in crowded feed?)
- Faces/emotion (research shows faces drive clicks)
- Composition (rule of thirds, visual hierarchy)
- Clutter score (too busy vs. clean and focused)

**Output:**
- Score out of 100 with reasoning
- Specific actionable suggestions
- Optional before/after comparison

**Tech:** Pure Claude API vision analysis — no expensive third party needed

**Upgrade Path:**
- Batch analyze multiple thumbnails to find patterns
- A/B suggestion mode — predict which of two thumbnails performs better

**Tie-ins:** Connects to IDEA-02 influencer style profiles

---

### IDEA-05 — Proactive AI Suggestions (Always-On Content Coach)
**Category:** AI Intelligence / UX
**Tier:** Pro / Team
**Phase:** 2–3
**Depends On:** Connected social accounts, posting history, engagement data

**Description:**
PostCrisp quietly monitors user activity and data, then surfaces actionable insights before the user thinks to ask. Feels like a creative director — not a chatbot waiting to be asked.

**Trigger Categories:**
- Performance dips: *"Your Sunday posts consistently underperform. Try Saturday?"*
- Posting gaps: *"You haven't posted in 6 days — your audience drops off after 5."*
- Content pattern recognition: *"How-to content gets 3x more saves than opinion posts."*
- Trending opportunities: Detects trending topics in their niche
- Seasonal awareness: *"Mother's Day is 11 days away — your audience skews 25–40 female."*

**Critical Warning:**
⚠️ This feature lives or dies on data quality. Build social account connections FIRST. A hollow proactive suggestion is worse than no suggestion — it breaks trust permanently.

---

### IDEA-06 — Confidence Indicators
**Category:** AI Transparency / UX
**Tier:** Pro / Team
**Phase:** 3–4
**Depends On:** Real engagement data, historical performance signals

**Description:**
Instead of just giving output, PostCrisp shows its reasoning. Users understand WHY the AI made a choice, which builds trust and helps them learn over time.

**What It Looks Like:**
- Scores with reasoning: *"This hook scores 82/100 — strong curiosity gap, but opening with 'I' underperforms on TikTok"*
- Confidence badges: High / Medium / Low with one-liner explanation
- Comparison context: *"This headline outperforms 73% of similar posts in your niche"*
- Tradeoff transparency: *"Optimized for saves, not comments. Want me to rebalance?"*

**Critical Warning:**
⚠️ Fake confidence scores (percentages without real data) destroy user trust faster than anything. Needs real signal before shipping. Do NOT fake it.

---

### IDEA-07 — Living Dashboard
**Category:** Core UX / Home Screen
**Tier:** All tiers (features gate by tier)
**Phase:** 1 (shell) — features activate as data connects
**Depends On:** Social account connections, all other feature data
**Status:** ✅ Mockup approved — `postcrisp-dashboard.jsx`

**Description:**
Real-time, always-aware command center. The heartbeat of PostCrisp. Feels alive, not static.

**Key Behaviors:**
- Typed daily briefing on login (AI speaks first)
- Metrics show momentum/velocity not snapshots (*"+47 this week, fastest growth in 30 days"*)
- Posts flagged in real time: Taking off 🚀 / Steady 📈 / Needs attention ⚠️
- Proactive suggestions panel (color-coded by urgency: red/orange/green)
- Channel Health Score (circular progress, plain-English explanation)
- Quick actions on every content card

**Design Philosophy:**
Show what to do NEXT — not just what happened. Reporting → Directing.

**Critical Warning:**
⚠️ Empty widgets with spinners = worst first impression. Require minimum data threshold before activating dashboard. Show beautiful onboarding flow instead if data is thin.

**Approved Mockup Colors:** See Design Principles section above.

---

### IDEA-08 — CTA Optimizer
**Category:** Content Optimization
**Tier:** Pro
**Phase:** 2
**Depends On:** Brand AI Voice Trainer (IDEA-12), user niche/platform profile

**Description:**
NOT a generic CTA generator. A personalized CTA optimizer. User pastes their draft CTA and PostCrisp scores it against their specific context, explains why it will or won't work, and offers ranked alternatives.

**Output:**
- Score with reasoning
- 3 improved alternatives ranked by predicted goal performance
- Context: niche, platform, audience, goal (saves / comments / follows / clicks / purchases)

**Key Rule:** Every output must be generated in the user's voice profile. A TikTok fitness creator's CTA reads nothing like a finance newsletter CTA.

---

### IDEA-09 — Brand Deal Maker
**Category:** Monetization / Marketplace
**Tier:** Pro / Team
**Phase:** Phase 1 lite — Phase 5–6 full marketplace
**Depends On:** Pre-signed brand partnerships, Brand Readiness Score (IDEA-10)

**Description:**
Two-phase approach to connecting influencers with brand affiliate opportunities.

**Phase 1 — Launch Ready (Smart Application Layer):**
- Pre-sign 10–20 affiliate brands BEFORE launch
- PostCrisp matches influencers to brands by: niche, audience size, engagement rate, platform, content style
- "Apply for Affiliate Status" menu in dashboard
- Smart application form — PostCrisp pre-fills using existing user profile (minimal friction)
- Submission goes directly to brand's affiliate manager
- PostCrisp takes backend referral cut per successful approval

**Phase 2 — Full Marketplace (Post-Scale):**
- Brands pay to be listed and matched automatically
- Audience becomes the pitch: *"10,000 active influencers on our platform"*
- Two-sided marketplace with automated matching

**Value Prop to Brands:**
Pre-qualified, niche-matched applicants. Every application is AI-screened. Quality over quantity.

**Legal Note:**
⚠️ Verify model doesn't conflict with affiliate platform terms (ShareASale, Impact, etc.) before launch.

---

### IDEA-10 — Brand Readiness Score
**Category:** Gamification / Monetization Gateway
**Tier:** All tiers (visible) / Pro+ (actionable)
**Phase:** 2
**Depends On:** Connected social accounts, engagement data, posting history

**Description:**
Proprietary score displayed on the Living Dashboard from day one. Affiliate dashboard is visible but locked until threshold is reached. Score drives daily engagement as users watch it move.

**Score Levels:**
| Range | Status |
|-------|--------|
| 0–40 | Building — keep going |
| 41–65 | Getting noticed |
| 66–79 | Brand Curious — unlock preview |
| 80–100 | Brand Ready — full access unlocked 🚀 |

**Scoring Input Categories (directional hints only — NEVER publish weights):**
- Follower count
- Engagement rate (weighted higher than follower count)
- Posting consistency
- Niche clarity
- Content quality signals
- Audience demographics
- Platform diversity

**Per-Brand Dynamic Scoring:**
Each brand has unique match criteria. Beyond the global score, show per-brand match % in the locked preview:
> *"You're a 91% match for Canon — 43% for HelloFresh. Here's why."*

**Algorithm Rules:**
- Never expose weights or formula to users
- Each brand's criteria documented internally: minimums, niche requirements, geographic rules, content restrictions
- This criteria database = long-term competitive moat
- Every score factor maps to a PostCrisp feature that helps improve it

**Retention Mechanic:** Users open PostCrisp daily to watch the score move.

---

### IDEA-11 — AI Content Repurposer
**Category:** Content Creation / Automation
**Tier:** Pro
**Phase:** 2–3
**Depends On:** Brand AI Voice Trainer (IDEA-12), transcription API

**Description:**
One long-form video becomes a full suite of platform-optimized content — all generated in the user's voice profile.

**Output Formats:**
| Format | Description |
|--------|-------------|
| Shorts/Reels scripts | 3 punchy 60-second segments from peak moments |
| Tweet thread | 5–10 tweet sequence of key insights |
| Pull quotes | Shareable quotes formatted for Instagram cards |
| Platform captions | Separate versions for TikTok, Instagram, LinkedIn, YouTube |
| Blog post | Long-form, SEO-friendly with headers |
| Email newsletter | Conversational recap for subscriber list |

**Technical Requirement:**
Transcription layer needed to convert video audio → text before Claude analyzes.
- **Whisper** (OpenAI) — accurate, affordable
- **Deepgram** — faster, also affordable

**Tie-ins:**
- Shorts feed into Video Generator (IDEA-03)
- Quotes feed into Thumbnail Analyzer (IDEA-04)
- Captions run through CTA Optimizer (IDEA-08)
- All output generated in voice from Voice Trainer (IDEA-12)

**Marketing:** Strong candidate for headline feature on marketing page.

---

### IDEA-12 — Brand AI Voice Trainer
**Category:** Core Infrastructure / Personalization
**Tier:** Free (basic) / Pro (full)
**Phase:** 1 — MUST BE EARLY
**Depends On:** User content input or connected social accounts
**Priority:** 🔴 CRITICAL — Build first. Everything depends on this.

**Description:**
Analyzes user's existing content to build a living voice profile. The engine underneath every PostCrisp content feature. Without it, all output sounds like generic AI. With it, everything sounds unmistakably like that creator.

**How It Works:**
1. User pastes existing captions, scripts, posts — OR connects social accounts for automatic ingestion
2. Claude analyzes across dimensions:
   - Sentence length and rhythm
   - Vocabulary level and complexity
   - Tone (casual, authoritative, funny, inspirational)
   - Signature phrases and patterns
   - How they open and close content
   - Emoji usage and punctuation style
   - Energy level
3. Voice profile is built and stored as a living document
4. Profile improves with more content over time
5. User can review and manually adjust: *"I'm actually more sarcastic than this"*
6. Multiple profiles supported: TikTok voice ≠ newsletter voice

**Strategic Importance:**
- Deepest retention mechanic in the product
- User's creative identity lives inside PostCrisp
- Switching cost becomes enormous over time — they can't take their voice profile to a competitor

**Implementation Rule:**
Integrate into ONBOARDING. Users should not have full feature access until a baseline voice profile exists. First impressions of generic output are permanent and unrecoverable.

---

## FEATURE DEPENDENCY MAP

```
IDEA-12 (Voice Trainer)          → Build FIRST. Everything depends on this.
    ├── IDEA-11 (Repurposer)
    ├── IDEA-08 (CTA Optimizer)
    └── IDEA-05 (Proactive Suggestions)

Social Account Connections        → Build SECOND. Data source for everything.
    ├── IDEA-05 (Proactive Suggestions)
    ├── IDEA-10 (Brand Readiness Score)
    └── IDEA-07 (Living Dashboard — full activation)

IDEA-07 (Living Dashboard)        → Shell launches early, features activate gradually
    ├── IDEA-10 (Brand Readiness Score)
    ├── IDEA-05 (Proactive Suggestions)
    └── IDEA-06 (Confidence Indicators)

IDEA-10 (Brand Readiness Score)   → Gateway to monetization
    └── IDEA-09 (Brand Deal Maker)

IDEA-03 (Video Generator)         → Receives output from Repurposer
IDEA-04 (Thumbnail Analyzer)      → Receives quotes from Repurposer
IDEA-02 (Color Schemes)           → Feeds into all content features
```

---

## PHASE PLACEMENT SUGGESTIONS

| Idea | Feature | Suggested Phase |
|------|---------|----------------|
| IDEA-12 | Brand AI Voice Trainer | Phase 1 |
| IDEA-07 | Living Dashboard (shell) | Phase 1 |
| IDEA-01 | Support Chatbot | Phase 1 |
| IDEA-04 | Thumbnail Analyzer | Phase 2 |
| IDEA-08 | CTA Optimizer | Phase 2 |
| IDEA-10 | Brand Readiness Score | Phase 2 |
| IDEA-05 | Proactive AI Suggestions | Phase 2–3 |
| IDEA-11 | AI Content Repurposer | Phase 2–3 |
| IDEA-02 | Color Scheme Templates | Phase 2–3 |
| IDEA-06 | Confidence Indicators | Phase 3–4 |
| IDEA-03 | Video Generator | Phase 3–4 |
| IDEA-09 | Brand Deal Maker (lite) | Phase 3 |
| IDEA-09 | Brand Deal Maker (marketplace) | Phase 5–6 |
