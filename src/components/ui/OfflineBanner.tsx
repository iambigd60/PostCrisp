"use client";
import { useEffect } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  // Fixed chrome (the mobile menu button) reads this class to drop below the
  // banner, so losing connectivity never also hides the navigation.
  useEffect(() => {
    document.documentElement.classList.toggle("offline", !isOnline);
    return () => document.documentElement.classList.remove("offline");
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[90] bg-amber-500/90 backdrop-blur-sm text-black text-center py-2 px-4 text-sm font-medium"
      style={{ animation: "slideInDown 300ms ease-out forwards" }}
      role="alert"
    >
      <span aria-hidden="true" className="mr-2">📡</span>
      You appear to be offline. Some features may not work.
    </div>
  );
}
