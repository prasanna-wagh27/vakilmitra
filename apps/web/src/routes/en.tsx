import { createFileRoute } from "@tanstack/react-router";
import { HomePage, sendSignedInToToday } from "@/components/marketing/HomePage";
import { useLocaleStore } from "@/lib/i18n";

/** The public home page in English: a link to /en opens it in English. */
export const Route = createFileRoute("/en")({
  beforeLoad: async (ctx) => {
    await sendSignedInToToday(ctx);
    useLocaleStore.getState().setLocale("en");
  },
  component: HomePage,
});
