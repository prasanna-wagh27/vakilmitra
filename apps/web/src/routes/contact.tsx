import { createFileRoute } from "@tanstack/react-router";
import { ContactContent } from "@/components/legal/Contact";

export const Route = createFileRoute("/contact")({ component: ContactContent });
