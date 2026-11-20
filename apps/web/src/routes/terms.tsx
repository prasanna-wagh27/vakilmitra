import { createFileRoute } from "@tanstack/react-router";
import { TermsContent } from "@/components/legal/Terms";

export const Route = createFileRoute("/terms")({ component: TermsContent });
