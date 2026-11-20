import { createFileRoute } from "@tanstack/react-router";
import { RefundsContent } from "@/components/legal/Refunds";

export const Route = createFileRoute("/refunds")({ component: RefundsContent });
