import { Cancel01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { Chip, Empty, ErrorBox, Loading, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  ACTIVITY_KINDS,
  type ActivityEntry,
  type ActivityKind,
  activityCsv,
  activityLabel,
  deviceKey,
  localDigits,
  resultKey,
  whenLabel,
  whoLabel,
} from "@/lib/activity";
import { api } from "@/lib/api";
import { type MessageKey, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/activity")({
  validateSearch: z.object({ caseId: z.string().optional(), kind: z.enum(ACTIVITY_KINDS).optional() }),
  component: ActivityPage,
});

type Page = { entries: ActivityEntry[]; hasMore: boolean };
const PAGE = 50;

const fetchPage = (q: { caseId?: string; kind?: ActivityKind; before?: string; limit?: number }) =>
  api<Page>("/activity", {
    query: {
      caseId: q.caseId,
      kind: q.kind === "all" ? undefined : q.kind,
      before: q.before,
      limit: String(q.limit ?? PAGE),
    },
  });
const cursorOf = (e: ActivityEntry) => `${e.at}|${e.id}`;

function ActivityPage() {
  const { t, tf, locale } = useI18n();
  const { caseId, kind = "all" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const q = useInfiniteQuery({
    queryKey: ["activity", caseId, kind],
    queryFn: ({ pageParam }) => fetchPage({ caseId, kind, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore && last.entries.length ? cursorOf(last.entries.at(-1)!) : undefined),
  });
  const entries = q.data?.pages.flatMap((p) => p.entries) ?? [];
  const caseTitle = caseId ? entries.find((e) => e.caseId === caseId)?.caseTitle : null;
  const [exporting, setExporting] = useState(false);

  async function download() {
    setExporting(true);
    try {
      const all: ActivityEntry[] = [];
      let before: string | undefined;
      // Up to 10,000 rows; enough for a year of a busy chamber, and the file stays small.
      for (let i = 0; i < 20; i++) {
        const p = await fetchPage({ caseId, kind, before, limit: 500 });
        all.push(...p.entries);
        if (!p.hasMore || !p.entries.length) break;
        before = cursorOf(p.entries.at(-1)!);
      }
      const url = URL.createObjectURL(new Blob([activityCsv(all, locale)], { type: "text/csv;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), {
        href: url,
        download: `vakilmitra-activity-${new Date().toISOString().slice(0, 10)}.csv`,
      });
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <PageHeader
        title={t("activity.title")}
        back={caseId ? `/cases/${caseId}` : "/settings"}
        description={t("activity.hint")}
        action={
          <Button variant="outline" size="sm" onClick={download} disabled={exporting || !entries.length}>
            <HugeiconsIcon icon={Download04Icon} className="size-4" />
            <span className="sr-only sm:not-sr-only">{t("activity.download")}</span>
          </Button>
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {ACTIVITY_KINDS.map((k) => (
          <Chip key={k} active={kind === k} onClick={() => void navigate({ search: (s) => ({ ...s, kind: k === "all" ? undefined : k }) })}>
            {t(`activity.kind.${k}` as MessageKey)}
          </Chip>
        ))}
        {caseId && (
          <Button variant="secondary" size="sm" onClick={() => void navigate({ search: (s) => ({ ...s, caseId: undefined }) })}>
            {caseTitle ? tf("activity.case", { title: caseTitle }) : t("activity.col.case")}
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" aria-label={t("activity.allCases")} />
          </Button>
        )}
      </div>

      {q.isPending ? (
        <Loading rows={6} />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : !entries.length ? (
        <Empty>{t("activity.empty")}</Empty>
      ) : (
        <Card className="gap-0 py-0">
          <ul className="divide-y">
            {entries.map((e) => (
              <Row key={e.id} e={e} inCase={!!caseId} />
            ))}
          </ul>
        </Card>
      )}
      {q.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
            {t("activity.older")}
          </Button>
        </div>
      )}
    </>
  );
}

function Row({ e, inCase }: { e: ActivityEntry; inCase: boolean }) {
  const { t, tf, locale } = useI18n();
  const result = resultKey(e);
  const device = deviceKey(e.userAgent);
  return (
    <li className="flex flex-col gap-1 px-(--card-spacing) py-3 sm:flex-row sm:items-start sm:gap-4">
      <time dateTime={e.at} className="shrink-0 text-xs text-muted-foreground tabular-nums sm:w-40 sm:pt-0.5">
        {whenLabel(e.at, locale)}
      </time>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{whoLabel(e, locale)}</span> · {activityLabel(e.action, locale)}
          {result && (
            <Badge tone="red" className="ms-2 align-middle">
              {t(result)}
            </Badge>
          )}
        </p>
        {e.caseId && !inCase && (
          <p className="truncate text-sm text-muted-foreground">
            {e.caseTitle ? (
              <Link to="/cases/$caseId" params={{ caseId: e.caseId }} className="underline-offset-4 hover:underline">
                {tf("activity.case", { title: e.caseTitle })}
              </Link>
            ) : (
              t("activity.caseGone")
            )}
          </p>
        )}
        {(device || e.ip) && (
          <p className="text-xs text-muted-foreground">
            {[device && t(device), e.ip && tf("activity.ip", { ip: localDigits(e.ip, locale) })].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </li>
  );
}
