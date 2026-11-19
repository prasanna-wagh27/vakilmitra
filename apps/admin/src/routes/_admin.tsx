import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { meQuery } from "@/lib/queries";

/** Everything except /login needs a staff session. */
export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ context }) => {
    try {
      return { staff: await context.queryClient.ensureQueryData(meQuery) };
    } catch {
      throw redirect({ to: "/login" });
    }
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { staff } = Route.useRouteContext();
  return (
    <Shell staff={staff}>
      <Outlet />
    </Shell>
  );
}
