import { cn } from "@/lib/utils";

// CSS-only pulse (see --animate-skeleton in globals.css). Skeleton is used by
// every loading.tsx and every Suspense fallback, so it sits on the critical
// path of essentially every route. Driving the pulse with framer-motion pulled
// the whole animation library into the first chunk that renders on each route —
// including the loading state itself. A CSS animation needs no "use client" and
// ships no JS. `motion-reduce:animate-none` honors prefers-reduced-motion.
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="presentation"
      className={cn(
        "rounded-md bg-muted/60 animate-skeleton motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className="h-3" style={{ width: `${100 - i * 8}%` }} />
      ))}
    </div>
  );
}
