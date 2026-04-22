import Link from "next/link";
import type { Metadata } from "next";
import { PLANS } from "@/lib/stripe";
import { CREDIT_PACKS } from "@/lib/crisp-engine-config";

export const metadata: Metadata = {
  title: "PostCrisp — Your AI Social Media Copilot",
  description: "Generate viral captions, find trending hashtags, and discover the best times to post. Your AI-powered social media copilot.",
  openGraph: {
    title: "PostCrisp — Your AI Social Media Copilot",
    description: "Generate viral captions, find trending hashtags, and discover the best times to post.",
    type: "website",
    siteName: "PostCrisp",
  },
};

const FEATURE_CATEGORIES = [
  {
    icon: "✨",
    title: "Create",
    count: 8,
    desc: "Captions, hashtags, scripts, repurpose, blog-to-social, polls, DMs, comment replies.",
    color: "from-brand-500 to-brand-700",
  },
  {
    icon: "⚙️",
    title: "Optimize",
    count: 5,
    desc: "Best posting times, YouTube SEO, bio optimizer, platform tips, channel analysis.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: "🚀",
    title: "Grow",
    count: 4,
    desc: "Viral ideas, trend radar, sound tracker, collaboration finder.",
    color: "from-emerald-500 to-teal-500",
  },
  {
    icon: "💰",
    title: "Monetize",
    count: 3,
    desc: "Brand pitch generator, rate calculator, competitor analysis.",
    color: "from-amber-500 to-orange-500",
  },
];

const STATS = [
  { value: "20+", label: "AI Tools" },
  { value: "7", label: "Social Platforms" },
  { value: "25+", label: "Creator Niches" },
  { value: "4", label: "Pricing Tiers" },
];

const HOW_IT_WORKS = [
  {
    step: "1",
    icon: "📝",
    title: "Sign up",
    desc: "Free tier — no credit card required. 10 credits to test every tool right away.",
  },
  {
    step: "2",
    icon: "⚡",
    title: "Pick your tool",
    desc: "20+ purpose-built generators for every stage of your content workflow.",
  },
  {
    step: "3",
    icon: "🎯",
    title: "Generate + publish",
    desc: "Copy, save, or export. Upgrade for premium AI quality on monetization features.",
  },
];

const TESTIMONIALS = [
  {
    quote: "PostCrisp saves me 8 hours a week. The brand pitch generator alone landed me a 5-figure deal.",
    name: "Sample Creator",
    handle: "@lifestyle_pro",
    avatar: "L",
    color: "from-pink-500 to-rose-600",
  },
  {
    quote: "The channel analysis pointed out three things I'd been missing for months. Growth unlocked.",
    name: "Sample Creator",
    handle: "@finance_dad",
    avatar: "F",
    color: "from-emerald-500 to-teal-600",
  },
  {
    quote: "I used to burn my weekends writing hooks. Now I write 10 scripts in 30 minutes.",
    name: "Sample Creator",
    handle: "@tech_story",
    avatar: "T",
    color: "from-sky-500 to-blue-600",
  },
];

const FAQ = [
  {
    q: "Is there a free plan?",
    a: "Yes. The Starter plan is free forever — 10 AI credits per day, access to every tool. No credit card required to sign up.",
  },
  {
    q: "What are credits and how do they work?",
    a: "Each generation costs 1–5 credits depending on the feature. Captions and hashtags cost 1 credit; scripts and viral ideas cost 3; premium features like Brand Pitch and Competitor Analysis cost 5. Your allowance refreshes daily (Starter) or monthly (Creator / Team / Elite). You can also buy top-up credit packs that never expire.",
  },
  {
    q: "What's the difference between Creator, Team, and Elite?",
    a: "Creator ($19/mo) gives you 500 credits/month with PostCrisp Engine Pro quality AI. Team ($49/mo) is Creator with 5 seats for agencies. Elite ($79/mo) uses PostCrisp Engine Elite — our highest-tier AI — across every feature, plus 2,000 credits/month. Try Creator first; upgrade to Elite when you feel a quality ceiling.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the billing page — no phone calls, no retention emails. You keep access until the end of your current billing period.",
  },
  {
    q: "Do you store my content?",
    a: "Only what you explicitly save to your library. Generation history lives in your account; you can delete it anytime. We never train our models on your content.",
  },
  {
    q: "Which AI models does PostCrisp use?",
    a: "PostCrisp Engine is our routing layer across Anthropic Claude (Opus, Sonnet, Haiku) and OpenAI (GPT-4o, GPT-4o-mini). Each feature is tuned to the optimal model for quality and speed. Elite tier gets premium models across the board.",
  },
  {
    q: "Which platforms do you support?",
    a: "Instagram, TikTok, YouTube, X, Facebook, Threads, and LinkedIn. Every generator is tuned per-platform for character limits, voice, and format conventions.",
  },
  {
    q: "Is this for beginners or advanced creators?",
    a: "Both. Starter creators get opinionated defaults and guided inputs. Advanced creators get fine-grained controls — custom niches, content type mix, tone variants, and a full content library.",
  },
  {
    q: "How do I get a refund?",
    a: "30-day money-back guarantee on all paid plans. Email captain@postcrisp.com and we'll process it no-questions-asked.",
  },
  {
    q: "What if I need more credits than my tier allows?",
    a: "Buy a top-up credit pack anytime from the billing page: 100 credits ($5), 500 credits ($15), or 1,500 credits ($40). Credit packs stack on your monthly allowance and never expire.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-surface-primary overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-lg shadow-glow">
              ⚡
            </div>
            <span className="text-lg font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
              PostCrisp
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/demo"
              className="px-3 sm:px-4 py-2 text-zinc-300 hover:text-white text-sm font-medium rounded-lg transition-colors min-h-[44px] hidden sm:flex items-center"
            >
              View Demo
            </Link>
            <Link
              href="/login"
              className="px-3 sm:px-4 py-2 text-zinc-300 hover:text-white text-sm font-medium rounded-lg transition-colors min-h-[44px] flex items-center"
            >
              Log In
            </Link>
            <Link
              href="/signup"
              className="px-3 sm:px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-all hover:shadow-glow min-h-[44px] flex items-center"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 text-center overflow-hidden">
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-sm font-medium mb-6">
            <span className="w-2 h-2 rounded-full bg-brand-400 animate-pulse" />
            AI-Powered Content Creation
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold leading-[1.1] mb-6">
            <span className="bg-gradient-to-r from-white via-brand-200 to-brand-400 bg-clip-text text-transparent animate-gradient bg-[length:200%_200%]">
              Your Social Media
            </span>
            <br />
            <span className="text-white">Copilot</span>
          </h1>

          <p className="text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            20+ purpose-built AI tools for creators. Generate captions, pitch brands, analyze competitors, calculate rates — everything in one dashboard.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all hover:shadow-glow-lg hover:scale-[1.02] active:scale-[0.98] text-base min-h-[48px] flex items-center justify-center"
            >
              Start Creating — It&apos;s Free
            </Link>
            <Link
              href="/demo"
              className="px-8 py-3.5 bg-surface-elevated hover:bg-surface-hover text-zinc-300 font-semibold rounded-xl border border-brand-500/20 hover:border-brand-500/40 transition-all text-base min-h-[48px] flex items-center justify-center"
            >
              View Demo →
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-4 sm:px-6 border-y border-brand-500/10">
        <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-brand-300 to-brand-500 bg-clip-text text-transparent">
                {stat.value}
              </div>
              <div className="text-sm text-zinc-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Every tool you need to{" "}
              <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
                grow and monetize
              </span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">
              Four categories. 20+ generators. One dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURE_CATEGORIES.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl bg-surface-secondary border border-brand-500/10 p-6 sm:p-8 hover:border-brand-500/25 transition-all hover:shadow-glow cursor-default"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <div className="flex items-baseline gap-2 mb-2">
                  <h3 className="text-xl font-semibold text-zinc-100">{feature.title}</h3>
                  <span className="text-xs text-brand-400 font-medium bg-brand-500/10 px-2 py-0.5 rounded-full">
                    {feature.count} tools
                  </span>
                </div>
                <p className="text-zinc-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 border-t border-brand-500/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Three steps to better content
            </h2>
            <p className="text-zinc-400 text-lg">Sign up free and you&apos;re creating in under a minute.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.step} className="rounded-2xl bg-surface-secondary border border-brand-500/10 p-6 relative">
                <div className="absolute -top-3 -left-3 w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center font-extrabold text-white shadow-glow">
                  {s.step}
                </div>
                <div className="text-3xl mb-3 mt-2">{s.icon}</div>
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">{s.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 border-t border-brand-500/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Simple, fair pricing
            </h2>
            <p className="text-zinc-400 text-lg">
              Start free. Upgrade when you&apos;re ready. Top up credits anytime.
            </p>
          </div>

          {/* 4-tier cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Starter */}
            <PricingCard
              name="Starter"
              tagline="Try everything"
              price={0}
              highlight={false}
              features={PLANS.starter.features}
              cta="Get started free"
              ctaHref="/signup"
            />
            {/* Creator — POPULAR */}
            <PricingCard
              name="Creator"
              tagline="For serious creators"
              price={PLANS.creator.monthlyPrice}
              highlight
              badge="POPULAR"
              features={PLANS.creator.features}
              cta="Start free, upgrade in-app"
              ctaHref="/signup"
            />
            {/* Team */}
            <PricingCard
              name="Team"
              tagline="For small teams / agencies"
              price={PLANS.team.monthlyPrice}
              highlight={false}
              features={PLANS.team.features}
              cta="Start free, upgrade in-app"
              ctaHref="/signup"
            />
            {/* Elite */}
            <PricingCard
              name="Elite"
              tagline="Maximum quality"
              price={PLANS.elite.monthlyPrice}
              highlight
              badge="PREMIUM"
              premium
              features={PLANS.elite.features}
              cta="Start free, upgrade in-app"
              ctaHref="/signup"
            />
          </div>

          {/* Credit packs */}
          <div className="mt-10 rounded-2xl border border-brand-500/10 bg-surface-secondary p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Need more credits?</h3>
                <p className="text-sm text-zinc-500 mt-0.5">One-time top-up packs. Never expire. Stack on any tier.</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {CREDIT_PACKS.map((pack) => (
                <div key={pack.id} className="rounded-lg bg-surface-tertiary border border-brand-500/5 p-4 text-center">
                  <div className="text-xl sm:text-2xl font-extrabold text-zinc-100">{pack.credits}</div>
                  <div className="text-2xs text-zinc-500">credits</div>
                  <div className="text-sm font-bold text-brand-300 mt-2">${pack.priceDollars}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-center text-xs text-zinc-600 mt-6">
            Cancel anytime · No contracts · 30-day money-back guarantee
          </p>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 sm:px-6 border-t border-brand-500/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              What creators are saying
            </h2>
            <p className="text-zinc-400 text-lg">
              <span className="text-2xs bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/20 align-middle">placeholder</span>{" "}
              <span className="align-middle">— real testimonials roll in after launch</span>
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-2xl bg-surface-secondary border border-brand-500/10 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold`}>
                    {t.avatar}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-zinc-200">{t.name}</div>
                    <div className="text-xs text-zinc-500">{t.handle}</div>
                  </div>
                </div>
                <p className="text-sm text-zinc-300 leading-relaxed italic">&ldquo;{t.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 sm:px-6 border-t border-brand-500/10">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Frequently asked questions
            </h2>
            <p className="text-zinc-400 text-lg">Everything you need to know before signing up.</p>
          </div>

          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border border-brand-500/10 bg-surface-secondary open:border-brand-500/25 transition-colors"
              >
                <summary className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer list-none select-none">
                  <span className="text-sm sm:text-base font-semibold text-zinc-200">{item.q}</span>
                  <span className="text-brand-400 text-lg font-mono group-open:rotate-45 transition-transform">+</span>
                </summary>
                <div className="px-5 pb-5 text-sm text-zinc-400 leading-relaxed">{item.a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center rounded-2xl bg-gradient-to-br from-brand-900/40 to-surface-secondary border border-brand-500/20 p-10 sm:p-14 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-600/5 via-transparent to-brand-600/5" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to level up your content?
            </h2>
            <p className="text-zinc-400 text-lg mb-8 max-w-lg mx-auto">
              Sign up in 30 seconds. 10 free credits to try every tool. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/signup"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all hover:shadow-glow-lg hover:scale-[1.02] active:scale-[0.98] min-h-[48px]"
              >
                Start Creating — It&apos;s Free →
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center justify-center px-8 py-3.5 bg-surface-elevated hover:bg-surface-hover text-zinc-300 font-semibold rounded-xl border border-brand-500/20 hover:border-brand-500/40 transition-colors min-h-[48px]"
              >
                See the Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-brand-500/10 py-8 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="text-lg">⚡</span>
            <span>PostCrisp © {new Date().getFullYear()}</span>
          </div>
          <div className="flex gap-6">
            <Link href="#features" className="hover:text-zinc-300">Features</Link>
            <Link href="#pricing" className="hover:text-zinc-300">Pricing</Link>
            <Link href="#faq" className="hover:text-zinc-300">FAQ</Link>
            <Link href="/demo" className="hover:text-zinc-300">Demo</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─── Pricing card (landing-page variant, no Stripe checkout) ───────────────

interface PricingCardProps {
  name: string;
  tagline: string;
  price: number;
  highlight: boolean;
  premium?: boolean;
  badge?: string;
  features: readonly string[];
  cta: string;
  ctaHref: string;
}

function PricingCard({ name, tagline, price, highlight, premium, badge, features, cta, ctaHref }: PricingCardProps) {
  const ring = premium
    ? "border-amber-500/40 bg-gradient-to-b from-amber-900/20 to-surface-secondary"
    : highlight
    ? "border-brand-500/40 bg-gradient-to-b from-brand-900/20 to-surface-secondary"
    : "border-brand-500/10 bg-surface-secondary";
  const checkColor = premium ? "text-amber-400" : highlight ? "text-brand-400" : "text-emerald-400";
  const cta_classes = premium
    ? "bg-amber-600 hover:bg-amber-500 text-white hover:shadow-glow"
    : highlight
    ? "bg-brand-600 hover:bg-brand-500 text-white hover:shadow-glow"
    : "bg-surface-elevated hover:bg-surface-hover text-zinc-200 border border-brand-500/20";
  const badgeColor = premium ? "bg-amber-600" : "bg-brand-600";
  return (
    <div className={`relative rounded-2xl border p-6 flex flex-col ${ring}`}>
      {badge && (
        <div className={`absolute top-3 right-3 ${badgeColor} text-white text-2xs font-bold px-2 py-0.5 rounded-full`}>
          {badge}
        </div>
      )}
      <h3 className="text-lg font-bold text-zinc-100">{name}</h3>
      <p className="text-xs text-zinc-500 mt-0.5">{tagline}</p>
      <div className="mt-3 flex items-end gap-1">
        <span className="text-3xl font-extrabold text-zinc-100">${price}</span>
        <span className="text-zinc-500 mb-1">/ mo</span>
      </div>
      <ul className="space-y-2 mb-6 mt-5 flex-1">
        {features.slice(0, 5).map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
            <span className={checkColor}>✓</span>
            <span className="flex-1">{f}</span>
          </li>
        ))}
      </ul>
      <Link
        href={ctaHref}
        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-all text-center ${cta_classes}`}
      >
        {cta}
      </Link>
    </div>
  );
}
