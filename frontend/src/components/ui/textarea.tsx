import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[180px] w-full rounded-[1.75rem] border border-white/10 bg-white/5 px-5 py-4 text-sm text-foreground placeholder:text-muted-foreground/80 shadow-soft outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/30",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
