import { HydrationBoundary } from "@tanstack/react-query";
import { requireUser } from "@/lib/auth/server";
import { listItems } from "@/db/repositories/items";
import { prefetch } from "@/lib/query/prefetch";
import { queryKeys } from "@/lib/query/keys";
import { ItemsView } from "@/components/items/items-view";

/**
 * Dashboard — exercises the full stack: auth (Task 4/5) -> tenancy-scoped
 * repository read (Task 5/6) -> TanStack Query SSR prefetch + IndexedDB
 * persistence (Task 7) -> UI kit (Task 3/6).
 *
 * `userId` comes from `requireUser()` — the trusted session identity, never
 * a client-supplied value — matching Development Pattern #5 (see
 * db/repositories/items.ts, which scopes every query on it).
 */
export default async function DashboardPage() {
  const user = await requireUser();

  // Prefetch through the same repository the API route calls, so the very
  // first paint is server-rendered data rather than a client-side fetch.
  // The queryFn's resolved shape (`{ items }`) must match what the client's
  // `useQuery` in ItemsView reads from `/api/items`, or hydration would hand
  // the client a differently-shaped cache entry than its own queryFn expects.
  const dehydratedState = await prefetch({
    queryKey: queryKeys.items.list(),
    queryFn: async () => ({ items: await listItems(user.id) }),
  });

  return (
    <HydrationBoundary state={dehydratedState}>
      <ItemsView />
    </HydrationBoundary>
  );
}
