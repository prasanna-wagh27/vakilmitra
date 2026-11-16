import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AuthForm } from "@/components/AuthForm";

export const Route = createFileRoute("/register")({
  validateSearch: z.object({ next: z.string().optional() }),
  component: () => <AuthForm mode="register" next={Route.useSearch().next} />,
});
