"use client";
import { useState, useCallback } from "react";
import { useToast } from "./Toast";

interface CopyButtonProps {
  text: string;
  label?: string;
  className?: string;
  variant?: "default" | "icon";
}

export function CopyButton({ text, label = "Copy", className = "", variant = "default" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      addToast("Copied to clipboard!", "success", 2000);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast("Failed to copy", "error");
    }
  }, [text, addToast]);

  if (variant === "icon") {
    return (
      <button
        onClick={handleCopy}
        className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg transition-all ${
          copied
            ? "bg-emerald-500/10 text-emerald-400 scale-95"
            : "bg-surface-elevated hover:bg-surface-hover text-zinc-400 hover:text-zinc-200"
        } ${className}`}
        title={copied ? "Copied!" : "Copy"}
      >
        {copied ? (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleCopy}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all min-h-[36px] ${
        copied
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 scale-95"
          : "bg-surface-elevated hover:bg-surface-hover text-zinc-400 hover:text-zinc-200 border border-brand-500/10"
      } ${className}`}
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}
