import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays, istDate } from "@vakilmitra/shared";
import { useState } from "react";
import { Chip, Empty, ErrorBox, Loading, PageHeader, Section } from "@/components/common";
import { HearingRow } from "@/components/HearingRow";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fmtDate, fmtDay, rupees } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { boardQuery, feeSummaryQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/")({ component: TodayPage });

function TodayPage() {
  const { t, locale } = useI18n();
  const today = istDate();
  const [day, setDay] = useState(today);
  const board = useQuery(boardQuery(day));
  const fees = useQuery(feeSummaryQuery);

  // Group the board by court, the way advocates walk the corridor.
  const byCourt = new Map<string, NonNullable<typeof board.data>["hearings"]>();
  for (const h of board.data?.hearings ?? []) {
    const k = h.court || h.case.court || "—";
    byCourt.set(k, [...(byCourt.get(k) ?? []), h]);
  }

  return (
    <>
      <PageHeader title={t("today.title")} />
      <div className="mb-3 flex items-center gap-2">
        <Chip active={day === today} onClick={() => setDay(today)}>
          {t("today.today")}
        </Chip>
        <Chip active={day === addDays(today, 1)} onClick={() => setDay(addDays(today, 1))}>
          {t("today.tomorrow")}
        </Chip>
        <span className="ml-auto text-sm text-muted-foreground">{fmtDay(day, locale)}</span>
      </div>

      <ErrorBox error={board.error} onRetry={() => board.refetch()} />
      {board.isPending ? (
        <Loading />
      ) : byCourt.size === 0 ? (
        <Empty>{t("today.noHearings")}</Empty>
      ) : (
        [...byCourt].map(([court, hs]) => (
          <div key={court} className="mb-4">
            <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
              {court} · {hs.length}
            </h3>
            <div className="space-y-2">
              {hs.map((h) => (
                <HearingRow key={h.id} h={h} />
              ))}
            </div>
          </div>
        ))
      )}

      {fees.data && fees.data.totals.outstandingPaise > 0 && (
        <Link to="/fees" className="mt-4 block">
          <Card className="flex items-center justify-between hover:bg-muted">
            <span>{t("today.outstanding")}</span>
            <span className="text-right">
              <span className="block font-semibold">{rupees(fees.data.totals.outstandingPaise, locale)}</span>
              {fees.data.totals.overduePaise > 0 && (
                <span className="text-xs text-destructive">
                  {rupees(fees.data.totals.overduePaise, locale)} {t("today.overdue")}
                </span>
              )}
            </span>
          </Card>
        </Link>
      )}

      {board.data && board.data.needsNextDate.length > 0 && (
        <Section title={t("today.needsNextDate")} action={<Badge tone="amber">{board.data.needsNextDate.length}</Badge>}>
          <p className="mb-2 text-sm text-muted-foreground">{t("today.needsNextDateHint")}</p>
          <div className="space-y-2">
            {board.data.needsNextDate.map((c) => (
              <Link
                key={c.id}
                to="/cases/$caseId"
                params={{ caseId: c.id }}
                className="block rounded-2xl border border-warning/40 bg-card p-3 hover:bg-muted"
              >
                <p className="font-semibold">{c.title}</p>
                {c.lastHearing && (
                  <p className="text-sm text-muted-foreground">
                    {t("today.lastHearing")}: {fmtDate(c.lastHearing.date, locale)}
                    {c.lastHearing.purpose ? ` · ${c.lastHearing.purpose}` : ""}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
