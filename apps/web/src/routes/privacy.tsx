import { createFileRoute } from "@tanstack/react-router";
import { PrivacyContent } from "@/components/legal/Privacy";

export const Route = createFileRoute("/privacy")({ component: PrivacyContent });
