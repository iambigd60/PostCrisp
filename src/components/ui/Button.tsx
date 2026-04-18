import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 hover:bg-brand-500 text-white shadow-glow hover:shadow-glow-lg",
  secondary: "bg-surface-elevated hover:bg-surface-hover text-zinc-200 border border-brand-500/20 hover:border-brand-500/40",
  ghost: "bg-transparent hover:bg-surface-elevated text-zinc-400 hover:text-zinc-200",
  danger: "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20",
};

const sizes: Record<ButtonSize, string> = {
  sm: "text-xs px-3 py-1.5 min-h-[32px]",
  md: "text-sm px-4 py-2 min-h-[40px]",
  lg: "text-base px-6 py-3 min-h-[48px]",
};

export function Button({ variant = "primary", size = "md", loading, children, className = "", disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 min-w-[44px] ${variants[variant]} ${sizes[size]} ${
        disabled || loading ? "opacity-50 cursor-not-allowed" : "active:scale-[0.97]"
      } ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
