import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,box-shadow,transform] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[0_8px_20px_-10px_rgb(17_17_20/0.55)] hover:bg-primary/88",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
        outline: "border bg-card shadow-[0_1px_2px_rgb(17_17_20/0.05)] hover:bg-muted",
        secondary: "bg-muted text-foreground hover:bg-muted/70",
        ghost: "hover:bg-muted",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-12 px-5",
        sm: "min-h-10 px-4 text-sm",
        icon: "size-11",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
