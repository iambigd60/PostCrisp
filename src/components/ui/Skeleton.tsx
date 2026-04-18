export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded bg-surface-tertiary bg-200 h-4 ${className}`} />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-brand-500/10 bg-surface-secondary p-5 space-y-3 ${className}`}>
      <SkeletonLine className="h-5 w-3/4" />
      <SkeletonLine className="h-4 w-full" />
      <SkeletonLine className="h-4 w-5/6" />
      <SkeletonLine className="h-4 w-2/3" />
    </div>
  );
}

export function SkeletonAvatar({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const s = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" }[size];
  return <div className={`animate-shimmer rounded-full bg-surface-tertiary bg-200 ${s}`} />;
}

export function SkeletonButton({ className = "" }: { className?: string }) {
  return <div className={`animate-shimmer rounded-lg bg-surface-tertiary bg-200 h-10 w-28 ${className}`} />;
}

export function SkeletonGrid({ count = 6, className = "" }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 space-y-2">
            <SkeletonLine className="h-4 w-24" />
            <SkeletonLine className="h-8 w-16" />
          </div>
        ))}
      </div>
      <SkeletonCard />
      <SkeletonGrid count={3} />
    </div>
  );
}

export function SkeletonCaptions() {
  return (
    <div className="space-y-4 animate-fade-in">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-xl border border-brand-500/10 bg-surface-secondary p-5 space-y-3">
          <SkeletonLine className="h-4 w-full" />
          <SkeletonLine className="h-4 w-5/6" />
          <SkeletonLine className="h-4 w-3/4" />
          <div className="flex gap-2 pt-2">
            <SkeletonButton className="w-20 h-8" />
            <SkeletonButton className="w-20 h-8" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonHashtags() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 animate-fade-in">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="rounded-lg border border-brand-500/10 bg-surface-secondary p-3 space-y-2">
          <SkeletonLine className="h-5 w-24" />
          <SkeletonLine className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
