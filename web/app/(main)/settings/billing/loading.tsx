import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div className="space-y-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="space-y-4 rounded-xl border border-border p-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-12 rounded-full" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
    </div>
  );
}
