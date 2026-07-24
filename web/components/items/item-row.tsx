"use client";

import { motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { tap, duration, ease } from "@/lib/motion";
import type { Item } from "@/db/schema/items";

export function ItemRow({
  item,
  pending = false,
  onToggle,
  onDelete,
}: {
  item: Item;
  /** True while this row's own toggle or delete mutation is in flight. */
  pending?: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const reduced = useReducedMotion();
  const done = item.status === "done";

  return (
    <motion.li
      layout
      initial={reduced ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: duration.fast, ease: ease.out }}
      className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2"
    >
      <Checkbox
        checked={done}
        onCheckedChange={onToggle}
        disabled={pending}
        aria-label={done ? "Mark item as open" : "Mark item as done"}
        className="mt-0.5"
      />

      {/* Tapping the label also toggles status — Checkbox already has its own
          check-mark spring, but the label itself had no press feedback, so
          this is where the explicit motion/react whileTap earns its keep. */}
      <motion.button
        type="button"
        onClick={onToggle}
        disabled={pending}
        whileTap={reduced ? undefined : tap}
        className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
      >
        <p
          className={cn(
            "truncate text-sm text-foreground",
            done && "text-muted-foreground line-through",
          )}
        >
          {item.title}
        </p>
        {item.notes && (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {item.notes}
          </p>
        )}
      </motion.button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Delete item"
        disabled={pending}
        onClick={onDelete}
      >
        <X />
      </Button>
    </motion.li>
  );
}
