import type { Metadata } from "next";
import { DemoSidebar } from "@/components/layout/DemoSidebar";

export const metadata: Metadata = {
  title: {
    template: "%s | PostCrisp Demo",
    default: "Demo | PostCrisp",
  },
};

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-primary">
      <DemoSidebar />
      <main className="lg:ml-[260px] min-h-screen">
        {/* Demo banner */}
        <div className="sticky top-0 z-20 bg-amber-500/10 border-b border-amber-500/20 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-2 pl-16 lg:pl-8">
            <p className="text-xs text-amber-300">
              <span className="font-semibold">🎭 Demo mode</span>
              <span className="text-amber-300/70"> — showing mock data. Nothing is saved. Connect Supabase + env vars to use the real app.</span>
            </p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
