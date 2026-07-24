import "server-only";
import {
  dehydrate,
  type DehydratedState,
  type FetchQueryOptions,
} from "@tanstack/react-query";
import { getServerQueryClient } from "./client";

/**
 * Prefetch one or more queries into the per-request server QueryClient and
 * return the dehydrated cache for a `<HydrationBoundary>`.
 *
 * Call this from a Server Component (e.g. `app/(main)/dashboard/page.tsx`)
 * before rendering `<HydrationBoundary state={...}>`. Because the server
 * client is `cache()`-scoped per request (see `client.ts`), the returned
 * state also carries any queries other sections on the same page already
 * prefetched — harmless, `HydrationBoundary` merges by key.
 */
export async function prefetch(
  ...queries: FetchQueryOptions[]
): Promise<DehydratedState> {
  const qc = getServerQueryClient();
  await Promise.all(queries.map((q) => qc.prefetchQuery(q)));
  return dehydrate(qc);
}
