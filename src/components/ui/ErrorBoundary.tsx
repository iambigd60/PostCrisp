"use client";
import React, { Component, type ReactNode } from "react";

interface Props { children: ReactNode; fallback?: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-3xl mb-5">
            💥
          </div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-2">Something went wrong</h2>
          <p className="text-zinc-400 mb-6 max-w-md">
            An unexpected error occurred. Please try again, or contact support if the problem persists.
          </p>
          {this.state.error && (
            <pre className="text-xs text-zinc-500 bg-surface-tertiary rounded-lg p-3 mb-6 max-w-lg overflow-auto">
              {this.state.error.message}
            </pre>
          )}
          <button
            onClick={this.handleRetry}
            className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-colors min-h-[44px]"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Inline error state for feature sections
export function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-red-500/20 bg-red-500/5 text-center animate-fade-in">
      <span className="text-3xl mb-3">⚠️</span>
      <p className="text-zinc-300 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-surface-elevated hover:bg-surface-hover text-zinc-200 rounded-lg text-sm font-medium transition-colors border border-brand-500/20 min-h-[44px]"
        >
          Retry
        </button>
      )}
    </div>
  );
}
