"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, useReducedMotion } from "motion/react"

import { spring } from "@/lib/motion"
import { cn } from "@/lib/utils"

// Orientation flows through context, not group-data selectors: tabs nest (the
// report page's vertical rail hosts horizontal section tabs inside a panel),
// and a group selector matches ANY ancestor group — the outer vertical root
// was forcing every nested list into a column.
const TabsOrientationContext = React.createContext<"horizontal" | "vertical">(
  "horizontal"
)

// The active-tab marker (pill background or line) is a single shared-layout
// element that slides from the old tab to the new one instead of cross-fading
// two separate markers. Each TabsList owns a layoutId namespace so an indicator
// only ever travels between tabs of its own list.
const TabsListContext = React.createContext<{
  layoutId: string
  variant: "default" | "line"
} | null>(null)

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsOrientationContext.Provider value={orientation ?? "horizontal"}>
      <TabsPrimitive.Root
        data-slot="tabs"
        data-orientation={orientation}
        orientation={orientation}
        className={cn(
          "group/tabs flex gap-2",
          orientation === "horizontal" && "flex-col",
          className
        )}
        {...props}
      />
    </TabsOrientationContext.Provider>
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const orientation = React.useContext(TabsOrientationContext)
  const layoutId = React.useId()
  const context = React.useMemo(
    () => ({ layoutId, variant: variant ?? "default" }),
    [layoutId, variant]
  )
  return (
    <TabsListContext.Provider value={context}>
      <TabsPrimitive.List
        data-slot="tabs-list"
        data-variant={variant}
        className={cn(
          tabsListVariants({ variant }),
          orientation === "vertical" ? "h-fit flex-col" : "h-8",
          className
        )}
        {...props}
      />
    </TabsListContext.Provider>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  const orientation = React.useContext(TabsOrientationContext)
  const list = React.useContext(TabsListContext)
  const reduced = useReducedMotion()

  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-colors duration-150 ease-out-strong hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        orientation === "vertical" && "w-full justify-start",
        "data-active:text-foreground dark:data-active:text-foreground",
        className
      )}
      render={(renderProps, state) => {
        const { children, ...rest } = renderProps
        return (
          <button {...rest}>
            {state.active && list && (
              <motion.span
                aria-hidden
                layoutId={list.layoutId}
                // Springs stay interruptible: clicking a third tab mid-slide
                // retargets from the marker's current position and velocity.
                transition={reduced ? { duration: 0 } : spring.snap}
                className={cn(
                  "absolute",
                  list.variant === "default" &&
                    "inset-0 rounded-md bg-background shadow-sm dark:border dark:border-input dark:bg-input/30",
                  list.variant === "line" &&
                    cn(
                      "rounded-full bg-foreground",
                      orientation === "vertical"
                        ? "inset-y-0 -right-1 w-0.5"
                        : "inset-x-0 bottom-[-5px] h-0.5"
                    )
                )}
              />
            )}
            {/* Positioned so it paints above the indicator without a z-index. */}
            <span className="relative inline-flex items-center gap-1.5">
              {children}
            </span>
          </button>
        )
      }}
      {...props}
    />
  )
}

function TabsContent({
  className,
  keepMounted = false,
  ...props
}: TabsPrimitive.Panel.Props & { keepMounted?: boolean }) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      keepMounted={keepMounted}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
