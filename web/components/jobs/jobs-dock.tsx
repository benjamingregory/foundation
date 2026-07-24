"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import type { VariantProps } from "class-variance-authority";
import { ChevronDown, ListChecks } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge, type badgeVariants } from "@/components/ui/badge";
import { apiJson } from "@/lib/data/api-fetch";
import { queryKeys } from "@/lib/query/keys";
import { duration, ease } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { InngestRun } from "@/db/schema/inngest-runs";

/**
 * Background-jobs dock — a small floating pill that expands into the
 * current user's recent Inngest runs. Deliberately minimal (not jobflow's
 * full jobs bus with optimistic placeholders and client-tracked tasks):
 * just a poll of `GET /api/jobs` and a status list.
 */

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
const ACTIVE_POLL_MS = 4000;
const IDLE_POLL_MS = 60_000;

const STATUS_LABEL: Record<string, string> = {
  queued: "queued",
  running: "running",
  completed: "done",
  failed: "failed",
  cancelled: "cancelled",
};

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  queued: "outline",
  running: "secondary",
  completed: "outline",
  failed: "destructive",
  cancelled: "outline",
};

/** "user/signed-up" -> "user signed-up" */
function eventLabel(eventName: string): string {
  return eventName.replace(/[/.]/g, " ");
}

export function JobsDock() {
  const [open, setOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const { data } = useQuery({
    queryKey: queryKeys.jobs.list(),
    queryFn: () => apiJson<{ runs: InngestRun[] }>("/api/jobs"),
    refetchInterval: (query) => {
      const runs = query.state.data?.runs ?? [];
      const active = runs.some((run) => !TERMINAL_STATUSES.has(run.status));
      return active ? ACTIVE_POLL_MS : IDLE_POLL_MS;
    },
  });

  const runs = data?.runs ?? [];
  if (runs.length === 0) return null;

  const activeCount = runs.filter(
    (run) => !TERMINAL_STATUSES.has(run.status),
  ).length;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-popover px-3 text-sm font-medium text-foreground shadow-md outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        >
          <ListChecks className="size-4 text-muted-foreground" aria-hidden />
          {activeCount > 0 ? `${activeCount} running` : "Jobs"}
          <ChevronDown
            className={cn("size-3.5 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-2">
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: duration.fast, ease: ease.out }}
            className="w-72 overflow-hidden rounded-lg border border-border bg-popover shadow-md"
          >
            <ul className="max-h-64 divide-y divide-border overflow-y-auto">
              {runs.map((run) => (
                <li
                  key={run.eventId}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <span className="truncate text-sm text-foreground">
                    {eventLabel(run.eventName)}
                  </span>
                  <Badge variant={STATUS_VARIANT[run.status] ?? "outline"}>
                    {STATUS_LABEL[run.status] ?? run.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
