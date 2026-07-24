import { cache } from "react";
import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";
import { PERSIST_MAX_AGE, queryPersister } from "./persister";

/**
 * Shared QueryClient defaults for both the browser client (`components/
 * providers.tsx`, via useState) and the per-request server client
 * (`getServerQueryClient` below). Keeping them in one place means a
 * server-prefetched query and its client-side refetch agree on staleTime, so
 * hydrated data isn't immediately refetched on mount.
 *
 * `staleTime` MUST match on server and browser — if it ever drifts, every
 * server-prefetched query is treated as stale on mount and refetched
 * immediately, defeating hydration.
 */
const sharedQueryDefaults = {
  staleTime: 2 * 60 * 1000, // 2 minutes
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

/**
 * Create a QueryClient. On the browser it also gets:
 *  - the per-query IndexedDB persister (queryFn results survive reloads and
 *    navigations, revalidating in the background), and
 *  - a `gcTime` matching the persister's max-age, so a query isn't evicted
 *    from RAM before the persister writes it to disk.
 *
 * On the server neither applies (`typeof window === "undefined"`): there's no
 * IndexedDB and the client is per-request, so a short default gcTime is fine.
 */
export function makeQueryClient(): QueryClient {
  const isBrowser = typeof window !== "undefined";
  return new QueryClient({
    defaultOptions: {
      queries: {
        ...sharedQueryDefaults,
        ...(isBrowser
          ? {
              gcTime: PERSIST_MAX_AGE,
              persister: queryPersister.persisterFn,
            }
          : {}),
      },
      dehydrate: {
        // Include pending queries so a section that prefetches without
        // awaiting can still stream its data across the RSC boundary.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}

/**
 * Per-request server QueryClient. `cache()` scopes one instance to each
 * request, so every section's prefetch on a page writes into the same cache
 * and a single dehydrate carries them all to the browser.
 *
 * The browser has no equivalent accessor on purpose: `components/
 * providers.tsx` holds the one browser client in `useState(makeQueryClient)`,
 * and components reach it through `useQueryClient()`. A module-level browser
 * singleton here would be a second source of truth.
 */
export const getServerQueryClient = cache(makeQueryClient);
