import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.2em]",
  {
    variants: {
      variant: {
        neutral: "border-white/12 bg-white/6 text-foreground",
        mild: "border-yellow-300/30 bg-yellow-300/12 text-yellow-100",
        moderate: "border-orange-300/30 bg-orange-300/12 text-orange-100",
        severe: "border-rose-300/30 bg-rose-300/12 text-rose-100",
        safe: "border-emerald-300/30 bg-emerald-300/12 text-emerald-100",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
