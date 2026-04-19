"use client";
import { useState } from "react";
import { PLATFORMS, TONES } from "@/lib/constants";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";

const MOCK_CAPTIONS = [
  "Sunset chasers only 🌅 Nothing hits quite like golden hour over the Pacific. There's something about the way the light paints the sky that makes you pause and appreciate the moment. Tag someone you'd watch this with. ✨\n\n#goldenhour #sunsetvibes #pacificcoast #travelphotography #naturelovers",
  "Day 47 of building in public and today we hit a milestone I didn't think was possible this fast. 🚀\n\nThe lesson? Show up every day. Even when the numbers are small. Even when no one's watching. Compound effort is the most underrated superpower in creative work.\n\nWhat's one thing you've been consistent with lately? 👇",
  "Unpopular opinion: Your morning routine matters less than your night routine.\n\nHow you end today decides how you start tomorrow. Put the phone down earlier. Reflect on three wins. Plan one priority. Sleep becomes the multiplier for everything else. 😴\n\n#productivity #morningroutine #mindfulness",
  "POV: You finally found the coffee shop with good wifi, comfy seats, AND no one plays loud music. ☕✨\n\nThese places are basically rare Pokémon. Drop your city below and I'll add the ones I've found — let's build a map for remote workers everywhere. 🗺️",
];

export default function DemoCaptionsPage() {
  const [topic, setTopic] = useState("A sunset photo from the coast");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("casual");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-zinc-100">Caption Generator</h1>
        <p className="text-zinc-500 mt-1">Describe your post and let AI craft the perfect caption.</p>
      </div>

      <div className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 sm:p-6 space-y-5">
        <div>
          <label htmlFor="topic" className="block text-sm font-medium text-zinc-300 mb-2">
            What&apos;s your post about?
          </label>
          <textarea
            id="topic"
            rows={3}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-lg bg-surface-tertiary border border-brand-500/10 text-zinc-200 placeholder:text-zinc-600 px-4 py-3 text-sm focus:outline-none focus:border-brand-500/40 focus:ring-1 focus:ring-brand-500/20 transition-colors resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Platform</label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  platform === p.id
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover hover:text-zinc-200"
                }`}
              >
                <p.icon className="w-4 h-4" style={{ color: p.color }} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">Tone</label>
          <div className="flex flex-wrap gap-2">
            {TONES.map((t) => (
              <button
                key={t.id}
                onClick={() => setTone(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all min-h-[44px] ${
                  tone === t.id
                    ? "bg-brand-600/20 text-brand-300 border border-brand-500/30"
                    : "bg-surface-tertiary text-zinc-400 border border-transparent hover:bg-surface-hover hover:text-zinc-200"
                }`}
              >
                <span>{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Button size="lg" className="w-full sm:w-auto" onClick={() => { /* demo - no-op */ }}>
          ✨ Generate Captions
        </Button>
      </div>

      <div className="space-y-4 stagger-children">
        <h2 className="text-lg font-semibold text-zinc-200">Generated Captions</h2>
        {MOCK_CAPTIONS.map((caption, i) => (
          <div
            key={i}
            className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 hover:border-brand-500/20 transition-all group"
          >
            <p className="text-zinc-300 whitespace-pre-wrap mb-4 leading-relaxed">{caption}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={caption} />
              <Button variant="secondary" size="sm">💾 Save</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
