"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { motion, useReducedMotion } from "motion/react";
import { Check, Minus } from "lucide-react";

import { spring } from "@/lib/motion";
import { cn } from "@/lib/utils";

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const reduced = useReducedMotion();

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Press feedback on the box itself — the indicator spring only fires
        // after commit. 0.9, not the button's 0.97: at 16px anything subtler
        // is invisible. `transition` (not -colors) so transform is covered.
        "group inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input bg-transparent outline-none transition duration-150 ease-out-strong cursor-pointer active:scale-90 motion-reduce:active:scale-100",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground",
        "data-[indeterminate]:border-primary data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        // The indicator mounts on check, so a spring on entry gives the tick a
        // physical snap. Unchecking stays instant — the box is already gone.
        render={
          <motion.span
            className="flex items-center justify-center text-current"
            initial={reduced ? false : { scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { duration: 0 } : spring.snap}
          />
        }
      >
        <Check
          className="size-3.5 group-data-[indeterminate]:hidden"
          strokeWidth={3}
        />
        <Minus
          className="hidden size-3.5 group-data-[indeterminate]:block"
          strokeWidth={3}
        />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
