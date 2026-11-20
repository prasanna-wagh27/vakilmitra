import { createFileRoute } from "@tanstack/react-router";
import { DeliveryContent } from "@/components/legal/Delivery";

export const Route = createFileRoute("/delivery")({ component: DeliveryContent });
