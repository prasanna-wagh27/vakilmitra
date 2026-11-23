import type { QueryClient } from "@tanstack/react-query";
import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="p-10 text-center">
      <p className="mb-3">404</p>
      <Link to="/" className="text-brand underline underline-offset-4">
        {t("nav.today")}
      </Link>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Outlet,
  notFoundComponent: NotFound,
});
