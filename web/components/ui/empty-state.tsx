"use client";

import { motion, useReducedMotion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { duration, ease } from "@/lib/motion";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  /** Optional medallion above the title: scales in, then pulses softly. */
  icon?: LucideIcon;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: duration.normal, ease: ease.out }}
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-10 gap-2",
        className,
      )}
    >
      {Icon && (
        // A single scale-in medallion. No perpetual pulse — a forever-animating
        // empty state is decorative motion (§7 / §Core: motion that doesn't move
        // information is worse than none).
        <motion.div
          className="mb-2 flex size-11 items-center justify-center rounded-full bg-muted/60"
          initial={reduced ? false : { scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: duration.slow, ease: ease.out }}
        >
          <Icon className="size-5 text-muted-foreground" />
        </motion.div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
