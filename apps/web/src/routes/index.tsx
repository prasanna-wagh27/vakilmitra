import { createFileRoute } from "@tanstack/react-router";
import { HomePage, sendSignedInToToday } from "@/components/marketing/HomePage";

/** The public home page in Marathi. A signed-in advocate goes straight to their day. */
export const Route = createFileRoute("/")({ beforeLoad: sendSignedInToToday, component: HomePage });
