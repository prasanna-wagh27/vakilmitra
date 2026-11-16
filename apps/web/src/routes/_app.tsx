import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useLocaleStore } from "@/lib/i18n";
import { meQuery } from "@/lib/queries";

/** Everything under _app needs a signed-in advocate. */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    try {
      return { advocate: await context.queryClient.ensureQueryData(meQuery) };
    } catch {
      throw redirect({ to: "/login", search: { next: location.href } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { advocate } = Route.useRouteContext();
  const { chosen, setLocale } = useLocaleStore();
  // Use the language saved on the profile until the advocate picks one on this device.
  useEffect(() => {
    if (!chosen) setLocale(advocate.locale, false);
  }, [chosen, advocate.locale, setLocale]);
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
