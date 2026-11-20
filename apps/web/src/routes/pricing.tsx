import { createFileRoute } from "@tanstack/react-router";
import { PricingContent } from "@/components/legal/Pricing";

export const Route = createFileRoute("/pricing")({ component: PricingContent });
