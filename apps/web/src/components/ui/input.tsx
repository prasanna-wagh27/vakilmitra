import type * as React from "react";
import { cn } from "@/lib/utils";

export { Input } from "./input-base";
export { NativeSelect } from "./native-select";
export { Textarea } from "./textarea";

/** Native checkbox, so react-hook-form's register() works unchanged; styled to match the preset. */
export function Checkbox({ className, ...props }: Omit<React.ComponentProps<"input">, "type">) {
  return <input type="checkbox" className={cn("size-4 shrink-0 rounded-[4px] border-input accent-primary", className)} {...props} />;
}
