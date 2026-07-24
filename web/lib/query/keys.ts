/**
 * Central query-key registry. One source of truth so server prefetch
 * (`prefetch.ts`), client `useQuery`, and `invalidateQueries` all agree on
 * the same key. Namespaced by domain (`items`, and later `jobs`) with a
 * function per query shape underneath — model on monroe's `queryKeys` +
 * jobflow's `keys` (jobflow naming: `keys.ts`, not monroe's `queryKeys.ts`).
 *
 * Keys are arrays (TanStack convention): a stable prefix plus any scoping
 * args. Prefer these helpers over inline literals so a key rename is a
 * single edit.
 */
export const queryKeys = {
  items: {
    all: () => ["items"] as const,
    list: () => ["items", "list"] as const,
  },

  // The background-jobs dock (components/jobs/jobs-dock.tsx) polls the
  // user's recent Inngest runs. The `"jobs"` segment is deliberate:
  // `lib/query/persister.ts`'s `EXCLUDED_KEY_SEGMENTS` already excludes it
  // from IndexedDB persistence, since a live run-status dock must never
  // restore stale data on reload.
  jobs: {
    all: () => ["jobs"] as const,
    list: () => ["jobs", "list"] as const,
  },
} as const;

export type QueryKeys = typeof queryKeys;
