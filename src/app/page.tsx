import Link from "next/link";
import type { Metadata } from "next";

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

const FEATURES = [
  { icon: "✍️", title: "Caption Generator", desc: "AI-powered captions tailored to your platform and tone. Never stare at a blank screen again.", color: "from-violet-500 to-purple-600" },
  { icon: "🏷️", title: "Hashtag Finder", desc: "Discover trending hashtags with engagement scores. Maximize your reach with data-driven tags.", color: "from-blue-500 to-cyan-500" },
  { icon: "⏰", title: "Best Time Analyzer", desc: "Visual heatmaps show when your audience is most active. Post at the perfect moment.", color: "from-amber-500 to-orange-500" },
  { icon: "💾", title: "Content Library", desc: "Save and organize your best captions and hashtag sets. Build your personal content vault.", color: "from-emerald-500 to-teal-500" },
];

const STATS = [
  { value: "10K+", label: "Captions Generated" },
  { value: "500K+", label: "Hashtags Found" },
  { value: "98%", label: "User Satisfaction" },
  { value: "4.9★", label: "App Rating" },
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
        {/* Background glow effects */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 left-1/4 w-[300px] h-[300px] bg-blue-600/5 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-4xl mx-auto stagger-children">
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
            Generate viral captions, find trending hashtags, and discover the best times to post — all powered by AI.
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
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Everything You Need to{" "}
              <span className="bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
                Go Viral
              </span>
            </h2>
            <p className="text-zinc-400 text-lg max-w-xl mx-auto">
              Four powerful tools in one dashboard. No switching between apps.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group relative rounded-2xl bg-surface-secondary border border-brand-500/10 p-6 sm:p-8 hover:border-brand-500/25 transition-all hover:shadow-glow cursor-default"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-zinc-100 mb-2">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center rounded-2xl bg-gradient-to-br from-brand-900/40 to-surface-secondary border border-brand-500/20 p-10 sm:p-14 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-600/5 via-transparent to-brand-600/5" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Level Up Your Content?
            </h2>
            <p className="text-zinc-400 text-lg mb-8 max-w-lg mx-auto">
              Join thousands of creators using PostCrisp to create better content, faster.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center px-8 py-3.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl transition-all hover:shadow-glow-lg hover:scale-[1.02] active:scale-[0.98] min-h-[48px]"
            >
              Get Started Free →
            </Link>
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
            <span className="hover:text-zinc-300 cursor-default">Privacy</span>
            <span className="hover:text-zinc-300 cursor-default">Terms</span>
            <span className="hover:text-zinc-300 cursor-default">Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
