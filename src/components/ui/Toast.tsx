"use client";
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  exiting?: boolean;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const ICONS: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", icon: "text-emerald-400" },
  error: { bg: "bg-red-500/10", border: "border-red-500/30", icon: "text-red-400" },
  info: { bg: "bg-blue-500/10", border: "border-blue-500/30", icon: "text-blue-400" },
  warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", icon: "text-amber-400" },
};

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
  const c = COLORS[toast.type];
  const duration = toast.duration || 4000;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border ${c.bg} ${c.border} backdrop-blur-sm shadow-lg min-w-[300px] max-w-[420px] ${toast.exiting ? "animate-toast-out" : "animate-toast-in"}`}
      role="alert"
    >
      <span className={`${c.icon} text-lg font-bold flex-shrink-0 mt-0.5`}>{ICONS[toast.type]}</span>
      <p className="text-sm text-zinc-200 flex-1">{toast.message}</p>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0 min-w-[28px] min-h-[28px] flex items-center justify-center"
        aria-label="Dismiss"
      >
        ✕
      </button>
      <div
        className={`absolute bottom-0 left-0 h-0.5 ${c.icon.replace("text-", "bg-")} rounded-full`}
        style={{ animation: `progressShrink ${duration}ms linear forwards` }}
      />
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 200);
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const addToast = useCallback((message: string, type: ToastType = "info", duration: number = 4000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setToasts((prev) => [...prev.slice(-4), { id, message, type, duration }]);
    const timer = setTimeout(() => removeToast(id), duration);
    timers.current.set(id, timer);
  }, [removeToast]);

  useEffect(() => {
    const currentTimers = timers.current;
    return () => { currentTimers.forEach(clearTimeout); };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem toast={t} onRemove={removeToast} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
