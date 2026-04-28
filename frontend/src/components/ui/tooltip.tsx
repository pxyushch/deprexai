import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type * as React from "react";

export function TooltipProvider({ children }: React.PropsWithChildren) {
  return <TooltipPrimitive.Provider delayDuration={150}>{children}</TooltipPrimitive.Provider>;
}

export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  children,
}: React.PropsWithChildren) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={10}
        className="z-50 rounded-2xl border border-white/10 bg-slate-950/95 px-3 py-2 text-xs text-white shadow-soft backdrop-blur-xl"
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-slate-950/95" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}
