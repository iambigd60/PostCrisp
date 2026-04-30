"use client";
import { useState, useEffect } from "react";

interface GenerationLoaderProps {
  messages: string[];
  className?: string;
  /**
   * "default" — 3 pulsing dots (existing behavior).
   * "rocket"  — animated rocket SVG with "STAND BY / Charting your trajectory…" copy.
   *             Use on heavy AI pages where wait is 30s+.
   */
  variant?: "default" | "rocket";
}

export function GenerationLoader({ messages, className = "", variant = "default" }: GenerationLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div
      className={`flex flex-col items-center justify-center py-12 ${className}`}
      role="status"
      aria-live="polite"
    >
      {variant === "rocket" ? <RocketScene /> : <DotsScene />}

      {/* Rotating per-feature message */}
      <p
        key={messageIndex}
        className="text-zinc-300 text-sm font-medium animate-fade-in-up mt-4 text-center px-4 max-w-md"
      >
        {messages[messageIndex]}
      </p>

      {/* Shimmer bar */}
      <div className="w-48 h-1 rounded-full bg-surface-tertiary mt-6 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 bg-200 animate-shimmer rounded-full" />
      </div>
    </div>
  );
}

function DotsScene() {
  return (
    <div className="flex gap-2 mb-2" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-3 h-3 rounded-full bg-brand-500"
          style={{
            animation: "pulseDot 1.4s ease-in-out infinite",
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

function RocketScene() {
  return (
    <div className="relative flex flex-col items-center" aria-hidden="true">
      {/* Stage: rocket + starfield wrapper. Fixed dims so animations don't shift layout. */}
      <div className="relative h-44 w-32">
        {/* Starfield (5 dots, twinkle staggered) */}
        <span className="absolute top-2  left-6  block w-1   h-1   rounded-full bg-brand-300 animate-twinkle" style={{ animationDelay: "0s"   }} />
        <span className="absolute top-6  right-4 block w-1   h-1   rounded-full bg-brand-300 animate-twinkle" style={{ animationDelay: "0.4s" }} />
        <span className="absolute top-14 left-2  block w-0.5 h-0.5 rounded-full bg-brand-300 animate-twinkle" style={{ animationDelay: "0.8s" }} />
        <span className="absolute top-3  right-10 block w-0.5 h-0.5 rounded-full bg-brand-300 animate-twinkle" style={{ animationDelay: "1.2s" }} />
        <span className="absolute top-20 right-2 block w-1   h-1   rounded-full bg-brand-300 animate-twinkle" style={{ animationDelay: "1.6s" }} />

        {/* Rocket */}
        <svg
          viewBox="0 0 60 140"
          className="absolute inset-x-0 mx-auto h-44 w-16 animate-rocket-bob"
        >
          {/* Body — Electric Blue ellipse */}
          <ellipse cx="30" cy="40" rx="18" ry="34" fill="var(--brand-500)" />
          {/* Window — Hangar White outer + brand-700 inner reflection */}
          <circle cx="30" cy="32" r="6" fill="#E8ECEF" />
          <circle cx="30" cy="32" r="4" fill="var(--brand-700)" opacity="0.45" />
          {/* Fins — Gunmetal */}
          <path d="M 12 60 L 4 78 L 12 74 Z"  fill="var(--bg-tertiary)" />
          <path d="M 48 60 L 56 78 L 48 74 Z" fill="var(--bg-tertiary)" />
          {/* Engine bell */}
          <rect x="22" y="72" width="16" height="6" rx="1" fill="var(--bg-tertiary)" />

          {/* Flame — orange outer + yellow inner, flickers */}
          <g className="animate-flame-flicker" style={{ transformOrigin: "30px 78px" }}>
            <path d="M 22 78 Q 30 100 38 78 Z" fill="#FF8C42" />
            <path d="M 25 78 Q 30 92  35 78 Z" fill="#FFD93D" />
          </g>

          {/* Exhaust puffs — staggered fade+rise */}
          <circle cx="22" cy="105" r="3"   fill="#8C949C" className="animate-puff-rise" style={{ animationDelay: "0s"   }} />
          <circle cx="38" cy="115" r="2.5" fill="#8C949C" className="animate-puff-rise" style={{ animationDelay: "0.5s" }} />
          <circle cx="28" cy="125" r="2"   fill="#8C949C" className="animate-puff-rise" style={{ animationDelay: "1.0s" }} />
        </svg>
      </div>

      {/* Copy */}
      <p className="mt-2 text-zinc-100 text-base font-bold tracking-[0.3em]">STAND BY</p>
      <p className="text-zinc-400 text-sm mt-1">Charting your trajectory…</p>
    </div>
  );
}
