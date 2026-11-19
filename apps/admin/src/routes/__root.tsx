import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: () => (
    <div className="p-10 text-center">
      <p className="mb-3">Not found</p>
      <Link to="/" className="underline underline-offset-4">
        Dashboard
      </Link>
    </div>
  ),
});
