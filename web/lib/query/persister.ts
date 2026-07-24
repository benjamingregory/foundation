import { get, set, del, clear, entries, createStore } from "idb-keyval";
import {
  experimental_createQueryPersister,
  type PersistedQuery,
  type AsyncStorage,
} from "@tanstack/query-persist-client-core";
import { hashKey, type QueryClient, type QueryKey } from "@tanstack/react-query";

/**
 * Per-query IndexedDB persistence for TanStack Query, ported from the monroe
 * app (`app/src/lib/react-query/persister.ts`) and cross-checked against
 * jobflow's port (`web/lib/query/persister.ts`), which is the naming this
 * file follows. Each query result is written individually to IndexedDB after
 * its `queryFn` resolves and lazily restored before the `queryFn` runs on the
 * next visit — so reloads and navigations paint from disk immediately, then
 * revalidate in the background.
 *
 * The lifecycle work (bfcache handling, mobile flush, size GC, and the
 * hydration write-gap fix below) is wired up from `components/providers.tsx`.
 */

// foundation has no shared logger utility yet; keep a tiny console shim so
// the ported error handling reads the same as the donors without pulling in
// a dependency.
const logger = {
  warn: (...args: unknown[]) => console.warn(...args),
  debug: (...args: unknown[]) =>
    process.env.NODE_ENV === "development" && console.debug(...args),
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Max age for persisted cache on installed PWAs (display-mode: standalone).
 * Home-screen installs are exempt from Safari's 7-day eviction and from most
 * Chromium LRU reclamation, so we can keep the cache around longer.
 */
const PERSIST_MAX_AGE_PWA = 24 * 60 * 60 * 1000;

/**
 * Max age for persisted cache in a regular browser tab. Shortened vs. PWA
 * because mobile Safari starts evicting after 7 days of non-visit use, and a
 * stale long-lived cache hurts more than it helps when we refetch on return.
 */
const PERSIST_MAX_AGE_BROWSER = 12 * 60 * 60 * 1000;

function detectStandalone(): boolean {
  if (typeof window === "undefined") return true; // SSR default — longer
  try {
    return window.matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

/**
 * Resolved at module load: 24h for installed PWAs, 12h for browser tabs.
 * Used both for persister maxAge and for TanStack Query's browser gcTime.
 */
export const PERSIST_MAX_AGE = detectStandalone()
  ? PERSIST_MAX_AGE_PWA
  : PERSIST_MAX_AGE_BROWSER;

/**
 * Hard ceiling on total persisted cache size, enforced via LRU eviction.
 * Past ~5MB, cold-start hydration degrades on low-end devices and mobile
 * Safari becomes more eager to evict. We evict oldest entries first (by
 * `state.dataUpdatedAt`) when the cap is exceeded.
 */
const PERSIST_SIZE_CAP_BYTES = 5 * 1024 * 1024;

// ---------------------------------------------------------------------------
// IndexedDB store
// ---------------------------------------------------------------------------

const STORE_NAME = "foundation-query-cache-v1";

let store: ReturnType<typeof createStore> | undefined;

function getStore() {
  if (!store) {
    store = createStore(STORE_NAME, "keyval");
  }
  return store;
}

function resetStore() {
  store = undefined;
}

// Recoverable IDB connection failures on mobile Safari. Two known variants:
//
// 1. WebKit #273827 (iOS 17.4+): "UnknownError: Connection to Indexed Database
//    server lost" when a db handle is reused across async gaps. Still reported
//    sporadically on iOS 18.
// 2. idb-keyval #142: "InvalidStateError: The database connection is closing"
//    when Safari tears down the connection mid-transaction.
//
// Both are fixed by dropping the cached store handle and letting the next call
// lazily re-open the same database.
function isIdbConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = (err as { name?: string }).name;
  const message = (err as { message?: string }).message ?? "";
  return (
    name === "UnknownError" ||
    name === "InvalidStateError" ||
    message.includes("Connection to Indexed Database server lost") ||
    message.includes("database connection is closing")
  );
}

async function withIdbRetry<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    if (!isIdbConnectionError(err)) throw err;
    logger.warn("[query-persist] IDB connection lost, retrying once:", err);
    resetStore();
    return op();
  }
}

// ---------------------------------------------------------------------------
// AsyncStorage adapter for idb-keyval
//
// Uses structured clone (IndexedDB native) — no JSON serialization overhead.
// Every op is wrapped in withIdbRetry to survive iOS 17.4+ connection drops.
// ---------------------------------------------------------------------------

const idbStorage: AsyncStorage<PersistedQuery> = {
  getItem: (key) => withIdbRetry(() => get<PersistedQuery>(key, getStore())),
  setItem: (key, value) => withIdbRetry(() => set(key, value, getStore())),
  removeItem: (key) => withIdbRetry(() => del(key, getStore())),
  entries: () =>
    withIdbRetry(() => entries<string, PersistedQuery>(getStore())),
};

// ---------------------------------------------------------------------------
// Exclusion filter — queries with these key segments skip persistence
// ---------------------------------------------------------------------------

/**
 * Query keys containing any of these segments are never written to
 * IndexedDB. `"jobs"` is here ahead of any actual usage: Task 10 adds a
 * background-jobs dock (polled, live run status) whose query key will start
 * with `["jobs", ...]`, and restoring a stale run state from disk would be
 * actively misleading. Keep this exported so Task 10 (and anything after it)
 * can rely on the exclusion existing rather than re-deriving it.
 */
export const EXCLUDED_KEY_SEGMENTS: readonly string[] = ["jobs"];

function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  return !queryKey.some(
    (segment) =>
      typeof segment === "string" && EXCLUDED_KEY_SEGMENTS.includes(segment),
  );
}

// ---------------------------------------------------------------------------
// Per-query persister
// ---------------------------------------------------------------------------

export const queryPersister = experimental_createQueryPersister<PersistedQuery>({
  storage: typeof window !== "undefined" ? idbStorage : null,
  maxAge: PERSIST_MAX_AGE,
  serialize: (q) => q, // no-op: structured clone handles serialization
  deserialize: (q) => q, // no-op: structured clone handles deserialization
  prefix: "tanstack-query",
  refetchOnRestore: true,
  filters: {
    predicate: (query) => shouldPersistQuery(query.queryKey),
  },
});

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Clear all persisted query entries from IndexedDB.
 * Call on logout / user switch to avoid leaking data between users. Always
 * pair with `queryClient.clear()`.
 */
export async function clearPersistedQueryCache() {
  try {
    await clear(getStore());
  } catch (err) {
    logger.warn("[query-persist] Failed to clear persisted cache:", err);
  }
}

/**
 * Rough size estimate for a persisted query entry. UTF-16 char count
 * (JSON length × 2) as a cheap proxy for structured-clone byte size —
 * over-estimates slightly, which is what we want for a conservative cap.
 */
function estimateEntrySize(value: PersistedQuery | undefined): number {
  if (!value) return 0;
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return 0;
  }
}

/**
 * LRU size-based garbage collection. Walks all persisted entries, totals their
 * estimated size, and deletes oldest entries (by `dataUpdatedAt`) until the
 * cache is back under `PERSIST_SIZE_CAP_BYTES`.
 *
 * Runs on app init and whenever the tab is backgrounded — not on every write.
 * Safe to call from SSR (no-ops).
 */
export async function sizeBasedGc(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const all = await withIdbRetry(() =>
      entries<string, PersistedQuery>(getStore()),
    );
    const sized = all.map(([key, value]) => ({
      key,
      size: estimateEntrySize(value),
      updatedAt: value?.state?.dataUpdatedAt ?? 0,
    }));
    const total = sized.reduce((sum, e) => sum + e.size, 0);
    if (total <= PERSIST_SIZE_CAP_BYTES) return;

    sized.sort((a, b) => a.updatedAt - b.updatedAt);
    let running = total;
    let evicted = 0;
    for (const entry of sized) {
      if (running <= PERSIST_SIZE_CAP_BYTES) break;
      await withIdbRetry(() => del(entry.key, getStore()));
      running -= entry.size;
      evicted++;
    }
    logger.debug(
      `[query-persist] size GC: ${total} -> ${running} bytes, evicted ${evicted} entries`,
    );
  } catch (err) {
    logger.warn("[query-persist] size GC failed:", err);
  }
}

/**
 * Flush all live queries to IndexedDB immediately.
 *
 * Called from `visibilitychange` → hidden and `pagehide` handlers so query
 * state not yet written (a queryFn that resolved moments before the user
 * backgrounded the tab) is forced out to storage before mobile browsers freeze
 * the page. Without this, the last batch of writes can be lost.
 *
 * IMPORTANT: `queryPersister.persistQuery()` does NOT honor the persister's
 * `filters.predicate` — that predicate only applies to the automatic write
 * path inside `persisterFn`. We re-apply `shouldPersistQuery` manually here,
 * otherwise excluded keys (e.g. `jobs`) would leak into IndexedDB on every tab
 * background. See TanStack Discussion #6759.
 *
 * Fire-and-forget: we kick off writes in parallel and don't await, because
 * `pagehide` gives us no time to wait.
 */
export function flushPersistedQueries(queryClient: QueryClient): void {
  try {
    const queries = queryClient.getQueryCache().getAll();
    for (const query of queries) {
      if (!shouldPersistQuery(query.queryKey)) continue;
      queryPersister.persistQuery(query).catch(() => {});
    }
  } catch (err) {
    logger.warn("[query-persist] Flush failed:", err);
  }
}

/**
 * Delete the persisted IndexedDB entry for a specific query key.
 *
 * `queryClient.removeQueries` only evicts the in-memory cache — the persisted
 * blob survives and resurrects stale data on the next cold start. Pair with
 * `removeQueries` after server-side data refreshes where the stored response is
 * known to be wrong. Fire-and-forget; safe on SSR.
 */
export async function removePersistedQueryByKey(
  queryKey: QueryKey,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const storageKey = `tanstack-query-${hashKey(queryKey)}`;
    await withIdbRetry(() => del(storageKey, getStore()));
  } catch (err) {
    logger.warn("[query-persist] removePersistedQueryByKey failed:", err);
  }
}

/**
 * Manually persist a single query after a `setQueryData` patch.
 *
 * The experimental persister only writes automatically after a `queryFn`
 * resolves — optimistic `setQueryData` updates are NOT captured and won't
 * survive until the next refetch. Call this after any manual `setQueryData` on
 * a query whose result you want durable across reloads.
 *
 * Respects `EXCLUDED_KEY_SEGMENTS` — no-op for excluded keys. Fire-and-forget;
 * safe on SSR (no-op).
 */
export function persistQueryDataByKey(
  queryClient: QueryClient,
  queryKey: QueryKey,
): void {
  if (typeof window === "undefined") return;
  if (!shouldPersistQuery(queryKey)) return;
  try {
    queryPersister.persistQueryByKey(queryKey, queryClient).catch(() => {});
  } catch (err) {
    logger.warn("[query-persist] persistQueryDataByKey failed:", err);
  }
}

/**
 * Seed hydrated queries into IndexedDB by persisting each query once it first
 * settles with data — the hydration write-gap fix.
 *
 * The `persisterFn` (set as the default query `persister` in `client.ts`) only
 * writes to storage after a *client-side* `queryFn` resolves. Dashboard pages
 * here are server-prefetched and hydrated via `<HydrationBoundary>`, so the
 * client reads fresh data straight from the dehydrated cache and never runs
 * the queryFn — meaning nothing reaches IndexedDB until the query later
 * refetches. Without this, an empty/stale IndexedDB entry from a previous
 * visit is never overwritten by the freshly-hydrated data, so the *next*
 * reload would restore the old snapshot instead of what SSR just rendered.
 *
 * This subscription closes that gap: it persists each query hash exactly once
 * (idle-scheduled, so it never competes with rendering) the first time it
 * settles after the provider mounts — which includes queries that just landed
 * via hydration, since `<HydrationBoundary>` applies its state during render,
 * before this effect's subscription starts. Subsequent refetches still write
 * through `persisterFn` as normal, and already-seeded hashes are skipped so a
 * chatty polling query doesn't cause a write storm.
 *
 * Call this from `components/providers.tsx` — the caller decides *when* to
 * start, and it must be after the QueryClientProvider's children (including
 * any HydrationBoundary) have committed. Returns an unsubscribe function.
 * No-op on SSR.
 */
export function startCachePersistence(queryClient: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};
  const cache = queryClient.getQueryCache();
  const seeded = new Set<string>();
  const pending = new Set<string>();
  let scheduled = false;

  const flush = () => {
    scheduled = false;
    for (const hash of pending) {
      pending.delete(hash);
      if (seeded.has(hash)) continue;
      const query = cache.get(hash);
      if (!query || query.state.status !== "success") continue;
      if (!shouldPersistQuery(query.queryKey)) continue;
      seeded.add(hash);
      queryPersister.persistQuery(query).catch(() => {});
    }
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(flush, { timeout: 2000 });
    } else {
      setTimeout(flush, 500);
    }
  };

  const unsubscribe = cache.subscribe((event) => {
    const q = event.query;
    if (
      q &&
      q.state.status === "success" &&
      q.state.fetchStatus === "idle" &&
      !seeded.has(q.queryHash)
    ) {
      pending.add(q.queryHash);
      schedule();
    }
  });

  // One-time initial flush: `cache.subscribe()` above only catches FUTURE
  // cache events. On a cold load where `Providers` and a data component mount
  // in the same React commit, the query's `observerAdded` notify (carrying
  // the just-hydrated data) can fire BEFORE this subscription attaches — so
  // that first hydrated dataset would otherwise never reach IndexedDB until
  // some later event/mutation. Scan queries that are already settled at the
  // moment we start listening and route them through the exact same
  // pending/schedule/flush path used above, so they get identical
  // seeded-dedupe and `EXCLUDED_KEY_SEGMENTS` handling — no parallel write
  // logic. Re-persisting an already-persisted query is harmless, so this is
  // safe to run unconditionally.
  for (const query of cache.getAll()) {
    if (
      query.state.status === "success" &&
      query.state.data !== undefined &&
      !seeded.has(query.queryHash)
    ) {
      pending.add(query.queryHash);
    }
  }
  if (pending.size > 0) schedule();

  return unsubscribe;
}

/**
 * Close the underlying IndexedDB connection so the page is eligible for
 * back/forward cache (bfcache) on Chrome and Safari. Long-lived IDB
 * connections disqualify the page from bfcache, costing us instant
 * back-navigation restore.
 *
 * idb-keyval doesn't expose its database handle directly, so we grab the
 * `IDBDatabase` out of a no-op transaction and call `.close()`. Then we reset
 * the cached store reference so the next op lazily re-opens a fresh connection.
 *
 * Call from `pagehide` AFTER `flushPersistedQueries` — closing before the flush
 * would abort pending writes.
 */
export async function closeDbForBfcache(): Promise<void> {
  if (typeof window === "undefined" || !store) return;
  const current = store;
  try {
    const capturedDb = await current<IDBDatabase | null>(
      "readonly",
      (objStore) => objStore.transaction.db,
    );
    capturedDb?.close();
  } catch (err) {
    logger.debug("[query-persist] closeDbForBfcache failed:", err);
  } finally {
    resetStore();
  }
}

/**
 * Request persistent storage from the browser. When granted, the origin is
 * exempt from automatic eviction (Safari's 7-day counter, Chromium's LRU
 * reclamation under quota pressure). Installed PWAs on Android auto-grant;
 * regular Safari tabs usually deny. Cheap to call, worth the try.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    !navigator.storage ||
    typeof navigator.storage.persist !== "function"
  ) {
    return false;
  }
  try {
    const granted = await navigator.storage.persist();
    logger.debug("[query-persist] persistent storage granted:", granted);
    return granted;
  } catch (err) {
    logger.warn("[query-persist] persist() request failed:", err);
    return false;
  }
}
