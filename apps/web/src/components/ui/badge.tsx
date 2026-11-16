import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium [&_svg]:size-3", {
  variants: {
    tone: {
      neutral: "bg-muted text-foreground",
      red: "bg-destructive-soft text-destructive",
      amber: "bg-warning-soft text-warning",
      green: "bg-success-soft text-success",
      blue: "bg-primary-soft text-primary",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}
