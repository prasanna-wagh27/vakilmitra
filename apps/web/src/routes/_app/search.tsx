import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Empty, ErrorBox, Loading, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { searchQuery } from "@/lib/queries";
import { useDebounced } from "@/lib/useDebounced";

export const Route = createFileRoute("/_app/search")({
  validateSearch: z.object({ q: z.string().optional() }),
  component: SearchPage,
});

function SearchPage() {
  const { t } = useI18n();
  const { q = "" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const term = useDebounced(q.trim(), 300);
  const { data, error, isFetching, refetch } = useQuery(searchQuery(term));

  return (
    <>
      <PageHeader title={t("search.title")} />
      <Input
        type="search"
        autoFocus
        lang="mr"
        placeholder={t("search.hint")}
        aria-label={t("search.title")}
        value={q}
        onChange={(e) => navigate({ search: { q: e.target.value || undefined }, replace: true })}
        className="mb-3"
      />
      <ErrorBox error={error} onRetry={() => refetch()} />
      {term.length < 2 ? (
        <p className="text-sm text-muted-foreground">{t("search.min")}</p>
      ) : isFetching && !data ? (
        <Loading />
      ) : data?.length === 0 ? (
        <Empty>{t("search.none")}</Empty>
      ) : (
        <ul className="space-y-2">
          {data?.map((h) => (
            <li key={h.pageId}>
              <Link
                to="/cases/$caseId/documents/$documentId"
                params={{ caseId: h.caseId, documentId: h.documentId }}
                search={{ page: h.pageNo }}
                className="block rounded-2xl border bg-card p-3 hover:bg-muted"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold">{h.caseTitle}</span>
                  <Badge>{h.documentTitle || t(`doctype.${h.documentType}`)}</Badge>
                  <span className="text-muted-foreground">
                    {t("doc.page")} {h.pageNo}
                  </span>
                </div>
                <p lang="mr" className="text-sm">
                  {h.snippet.slice(0, h.matchStart)}
                  <mark className="rounded bg-warning-soft px-0.5 text-foreground">{h.snippet.slice(h.matchStart, h.matchEnd)}</mark>
                  {h.snippet.slice(h.matchEnd)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
