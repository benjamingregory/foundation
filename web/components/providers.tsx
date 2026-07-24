"use client";

import { useEffect, useState } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "@/lib/query/client";
import { PostHogProvider } from "@/lib/analytics/posthog-client";
import {
  closeDbForBfcache,
  flushPersistedQueries,
  requestPersistentStorage,
  sizeBasedGc,
  startCachePersistence,
} from "@/lib/query/persister";

export function Providers({ children }: { children: React.ReactNode }) {
  // `useState(makeQueryClient)` (not a module-level singleton) so the client
  // is created fresh per server render but stable across client re-renders —
  // the standard TanStack SSR pattern. `Providers` mounts once at the root
  // and never unmounts, so this is a de-facto singleton for the browser tab's
  // lifetime; components reach it via `useQueryClient()`.
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    // No re-entrancy guard needed: `queryClient` is a stable `useState`
    // reference that's never reassigned, so this effect only ever fires on
    // mount (twice in dev under StrictMode — mount, cleanup, mount again —
    // and the cleanup below correctly tears down and lets the second mount
    // re-attach, rather than a stale "already initialized" ref silently
    // skipping it) and on unmount.
    //
    // Start persistence only now, inside an effect. Any `<HydrationBoundary>`
    // further down the tree applies its dehydrated state synchronously during
    // render (before effects run), so by the time this subscription attaches,
    // the SSR-hydrated queries are already in the cache. See the "hydration
    // write-gap" doc comment on startCachePersistence in lib/query/persister.ts
    // for why starting this any earlier — or module-level, outside an effect —
    // would miss them and leave stale IndexedDB data un-overwritten.
    const unsubscribe = startCachePersistence(queryClient);

    // One-time on mount: enforce the 5MB size cap and request eviction
    // exemption. Installed PWAs typically auto-grant; regular browser tabs
    // usually deny — harmless either way.
    sizeBasedGc().catch(() => {});
    requestPersistentStorage().catch(() => {});

    // Mobile browsers freeze/kill tabs aggressively when the user backgrounds
    // the app. Flush any pending per-query writes to IndexedDB before the
    // page is hidden so we don't lose the last batch of cache updates.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        flushPersistedQueries(queryClient);
        sizeBasedGc().catch(() => {});
      }
    };
    // pagehide is iOS Safari's last-chance hook. After flushing, close the
    // IDB connection so the page qualifies for bfcache (an open IndexedDB
    // connection disqualifies a page in Chrome/Safari); it lazily re-opens on
    // next use.
    const handlePageHide = () => {
      flushPersistedQueries(queryClient);
      closeDbForBfcache().catch(() => {});
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [queryClient]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <QueryClientProvider client={queryClient}>
        <PostHogProvider>
          {children}
          <Toaster richColors />
        </PostHogProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
