"use client"

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu"

import { cn } from "@/lib/utils"

function ContextMenu({ ...props }: ContextMenuPrimitive.Root.Props) {
  return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />
}

function ContextMenuTrigger({ ...props }: ContextMenuPrimitive.Trigger.Props) {
  return (
    <ContextMenuPrimitive.Trigger data-slot="context-menu-trigger" {...props} />
  )
}

function ContextMenuContent({
  className,
  ...props
}: ContextMenuPrimitive.Popup.Props) {
  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner className="isolate z-50 outline-none">
        <ContextMenuPrimitive.Popup
          data-slot="context-menu-content"
          className={cn(
            // Transition + strong curve, matching the dropdown/select popups.
            "z-50 max-h-(--available-height) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none transition-[opacity,transform] duration-150 ease-out-strong data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95 data-closed:overflow-hidden",
            className,
          )}
          {...props}
        />
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  )
}

// Base UI's ContextMenu popup is composed of the same Menu parts as the
// dropdown menu, so the item-level components are shared rather than
// restyled copies.
export {
  DropdownMenuGroup as ContextMenuGroup,
  DropdownMenuItem as ContextMenuItem,
  DropdownMenuLabel as ContextMenuLabel,
  DropdownMenuSeparator as ContextMenuSeparator,
} from "./dropdown-menu"

export { ContextMenu, ContextMenuTrigger, ContextMenuContent }
