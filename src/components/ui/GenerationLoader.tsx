"use client";
import { useState, useEffect } from "react";

interface GenerationLoaderProps {
  messages: string[];
  className?: string;
}

export function GenerationLoader({ messages, className = "" }: GenerationLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      {/* Animated dots */}
      <div className="flex gap-2 mb-6">
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

      {/* Rotating messages */}
      <p
        key={messageIndex}
        className="text-zinc-300 text-sm font-medium animate-fade-in-up"
      >
        {messages[messageIndex]}
      </p>

      {/* Subtle gradient bar */}
      <div className="w-48 h-1 rounded-full bg-surface-tertiary mt-6 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 bg-200 animate-shimmer rounded-full" />
      </div>
    </div>
  );
}
