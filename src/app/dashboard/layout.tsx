import type { Metadata } from "next";
import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SkeletonDashboard } from "@/components/ui/Skeleton";
import { FeedbackButton } from "@/components/FeedbackButton";
import { requireAlphaAcceptance } from "@/lib/alpha-agreement-server";

export const metadata: Metadata = {
  title: {
    template: "%s | PostCrisp",
    default: "Dashboard | PostCrisp",
  },
};

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await requireAlphaAcceptance("/dashboard");
  return (
    <div className="min-h-screen bg-surface-primary">
      <Sidebar />
      {/* Main content — offset by sidebar width on desktop */}
      <main className="lg:ml-[260px] min-h-screen">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-16 lg:pt-6">
          <Suspense fallback={<SkeletonDashboard />}>
            {children}
          </Suspense>
        </div>
      </main>
      <FeedbackButton />
    </div>
  );
}
