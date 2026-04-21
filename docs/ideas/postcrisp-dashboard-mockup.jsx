// Living Dashboard mockup — concept reference for IDEA-07 in postcrisp-new-ideas.md
// Approved color system embedded (bg #080c14, accent #22d3a0).
// This file is a design reference, NOT production code. Do not import from /src.

import { useState, useEffect, useRef } from "react";

const metrics = [
  { label: "Followers", value: 24817, delta: "+47", trend: "up", sub: "fastest growth in 30 days" },
  { label: "Avg. Engagement", value: "6.4%", delta: "+1.2%", trend: "up", sub: "above your 30-day avg" },
  { label: "Posts This Week", value: 3, delta: "2 due", trend: "neutral", sub: "Wednesday & Friday" },
  { label: "Channel Health", value: "87", delta: "+4 pts", trend: "up", sub: "up from last week" },
];

const posts = [
  { title: "5 Tools Every Creator Needs in 2026", platform: "YouTube", status: "taking-off", engagement: "4.2K", change: "+312 in 2h", thumb: "🚀" },
  { title: "My Morning Routine (Raw & Honest)", platform: "TikTok", status: "steady", engagement: "1.8K", change: "+48 today", thumb: "📈" },
  { title: "Why I Almost Quit Creating", platform: "Instagram", status: "needs-attention", engagement: "620", change: "-3% reach", thumb: "⚠️" },
];

const suggestions = [
  { icon: "🔥", label: "Trending in your niche", message: "\"AI tools for creators\" is surging — 3x searches this week. Strike now.", cta: "Draft a post", urgency: "high" },
  { icon: "📅", label: "Posting gap detected", message: "You haven't posted in 5 days. Your audience drops off after day 6.", cta: "Schedule content", urgency: "medium" },
  { icon: "🎯", label: "Best time to post", message: "Your audience is most active Tuesdays 7–9 PM. Your next post is unscheduled.", cta: "Set a time", urgency: "low" },
];

const briefing = "Your reel from Tuesday is your best performer this month. You have 2 posts due this week and a trending topic in your niche right now.";

function AnimatedNumber({ value, isString }) {
  const [display, setDisplay] = useState(isString ? value : 0);
  useEffect(() => {
    if (isString) { setDisplay(value); return; }
    let start = 0;
    const end = parseInt(value.toString().replace(/,/g, ""));
    const duration = 1200;
    const step = end / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= end) { setDisplay(value.toLocaleString()); clearInterval(timer); }
      else setDisplay(Math.floor(start).toLocaleString());
    }, 16);
    return () => clearInterval(timer);
  }, []);
  return <span>{display}</span>;
}

function PulsingDot({ color }) {
  return (
    <span style={{ position: "relative", display: "inline-flex", width: 10, height: 10 }}>
      <span style={{
        position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: 0.4,
        animation: "ping 1.5s cubic-bezier(0,0,0.2,1) infinite"
      }} />
      <span style={{ position: "relative", borderRadius: "50%", width: 10, height: 10, background: color }} />
    </span>
  );
}

export default function PostCrispDashboard() {
  const [time, setTime] = useState(new Date());
  const [briefingDone, setBriefingDone] = useState(false);
  const [briefingText, setBriefingText] = useState("");
  const [activePost, setActivePost] = useState(null);
  const idx = useRef(0);

  useEffect(() => {
    const clock = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    const delay = setTimeout(() => {
      const interval = setInterval(() => {
        if (idx.current < briefing.length) {
          setBriefingText(briefing.slice(0, idx.current + 1));
          idx.current++;
        } else {
          setBriefingDone(true);
          clearInterval(interval);
        }
      }, 22);
      return () => clearInterval(interval);
    }, 600);
    return () => clearTimeout(delay);
  }, []);

  const hour = time.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const statusColor = (s) => s === "taking-off" ? "#22d3a0" : s === "needs-attention" ? "#f97316" : "#94a3b8";
  const statusLabel = (s) => s === "taking-off" ? "Taking off" : s === "needs-attention" ? "Needs attention" : "Steady";
  const urgencyColor = (u) => u === "high" ? "#f43f5e" : u === "medium" ? "#f97316" : "#22d3a0";

  return (
    <div style={{
      minHeight: "100vh", background: "#080c14", color: "#e2e8f0",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: "0",
      position: "relative", overflow: "hidden"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Syne:wght@700;800&display=swap');
        @keyframes ping { 75%,100% { transform: scale(2); opacity: 0; } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse-slow { 0%,100% { opacity:0.4; } 50% { opacity:0.7; } }
        .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); border-radius: 16px; transition: all 0.2s ease; }
        .card:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); transform: translateY(-1px); }
        .glow-green { box-shadow: 0 0 30px rgba(34,211,160,0.15); }
        .fade-up { animation: fadeUp 0.5s ease forwards; opacity: 0; }
        .btn { background: rgba(34,211,160,0.15); border: 1px solid rgba(34,211,160,0.3); color: #22d3a0; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; letter-spacing: 0.02em; font-family: inherit; }
        .btn:hover { background: rgba(34,211,160,0.25); }
      `}</style>

      {/* Ambient background orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", left: "60%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(34,211,160,0.06) 0%, transparent 70%)", animation: "pulse-slow 6s ease infinite" }} />
        <div style={{ position: "absolute", bottom: "10%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)", animation: "pulse-slow 8s ease infinite 2s" }} />
      </div>

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, animation: "fadeUp 0.4s ease forwards" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#22d3a0", letterSpacing: "-0.5px" }}>PostCrisp</span>
              <span style={{ background: "rgba(34,211,160,0.15)", color: "#22d3a0", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, letterSpacing: "0.08em" }}>LIVE</span>
              <PulsingDot color="#22d3a0" />
            </div>
            <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 28, fontWeight: 800, margin: 0, color: "#f1f5f9", letterSpacing: "-0.5px" }}>
              {greeting}, Alex 👋
            </h1>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#f1f5f9", letterSpacing: "-1px", fontFamily: "'Syne', sans-serif" }}>
              {time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              {time.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
            </div>
          </div>
        </div>

        {/* AI Briefing Card */}
        <div className="card glow-green fade-up" style={{ padding: "20px 24px", marginBottom: 28, borderColor: "rgba(34,211,160,0.2)", animationDelay: "0.1s" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(34,211,160,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#22d3a0", letterSpacing: "0.1em", marginBottom: 6 }}>YOUR DAILY BRIEFING</div>
              <p style={{ margin: 0, fontSize: 15, color: "#cbd5e1", lineHeight: 1.6, minHeight: 24 }}>
                {briefingText}
                {!briefingDone && <span style={{ opacity: 0.5, animation: "pulse-slow 0.8s infinite" }}>|</span>}
              </p>
            </div>
          </div>
        </div>

        {/* Metrics Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {metrics.map((m, i) => (
            <div key={i} className="card fade-up" style={{ padding: "20px", animationDelay: `${0.15 + i * 0.07}s` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", letterSpacing: "0.08em", marginBottom: 10 }}>{m.label.toUpperCase()}</div>
              <div style={{ fontSize: 30, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#f1f5f9", letterSpacing: "-1px", lineHeight: 1 }}>
                <AnimatedNumber value={m.value} isString={typeof m.value === "string"} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: m.trend === "up" ? "#22d3a0" : m.trend === "down" ? "#f43f5e" : "#94a3b8" }}>{m.delta}</span>
                <span style={{ fontSize: 11, color: "#475569" }}>{m.sub}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Main 2-col layout */}
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 20 }}>

          {/* Left: Recent Posts */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", marginBottom: 14 }}>RECENT CONTENT</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {posts.map((p, i) => (
                <div key={i} className="card fade-up" onClick={() => setActivePost(activePost === i ? null : i)}
                  style={{ padding: "18px 20px", cursor: "pointer", borderColor: activePost === i ? "rgba(34,211,160,0.3)" : undefined, animationDelay: `${0.3 + i * 0.08}s` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ fontSize: 14 }}>{p.thumb}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: statusColor(p.status), letterSpacing: "0.06em" }}>{statusLabel(p.status).toUpperCase()}</span>
                        {p.status === "taking-off" && <PulsingDot color="#22d3a0" />}
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#e2e8f0", marginBottom: 4, lineHeight: 1.4 }}>{p.title}</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{p.platform}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 16 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", fontFamily: "'Syne', sans-serif" }}>{p.engagement}</div>
                      <div style={{ fontSize: 11, color: p.status === "needs-attention" ? "#f97316" : "#22d3a0", fontWeight: 600 }}>{p.change}</div>
                    </div>
                  </div>
                  {activePost === i && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button className="btn">Boost this post</button>
                      <button className="btn">Create a follow-up</button>
                      <button className="btn">Analyze thumbnail</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right: Proactive Suggestions + Health */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", marginBottom: 14 }}>POSTCRISP SUGGESTS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {suggestions.map((s, i) => (
                <div key={i} className="card fade-up" style={{ padding: "18px 20px", animationDelay: `${0.4 + i * 0.08}s`, borderLeft: `3px solid ${urgencyColor(s.urgency)}` }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: urgencyColor(s.urgency), letterSpacing: "0.08em", marginBottom: 4 }}>{s.label.toUpperCase()}</div>
                      <p style={{ margin: "0 0 12px", fontSize: 13, color: "#94a3b8", lineHeight: 1.5 }}>{s.message}</p>
                      <button className="btn">{s.cta} →</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Channel Health Score */}
            <div className="card fade-up" style={{ padding: "20px", marginTop: 12, animationDelay: "0.6s" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", marginBottom: 14 }}>CHANNEL HEALTH</div>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ position: "relative", width: 64, height: 64, flexShrink: 0 }}>
                  <svg width="64" height="64" viewBox="0 0 64 64">
                    <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
                    <circle cx="32" cy="32" r="26" fill="none" stroke="#22d3a0" strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 26 * 0.87} ${2 * Math.PI * 26}`}
                      strokeLinecap="round" transform="rotate(-90 32 32)" />
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#f1f5f9" }}>87</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#22d3a0", marginBottom: 4 }}>Strong 💪</div>
                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>Consistency is up. Engagement rate is above your 30-day average.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#334155" }}>PostCrisp is always watching your channel so you don't have to.</span>
          <span style={{ fontSize: 11, color: "#22d3a0", fontWeight: 600 }}>✦ All systems active</span>
        </div>

      </div>
    </div>
  );
}
