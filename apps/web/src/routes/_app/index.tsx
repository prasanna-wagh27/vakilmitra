import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays, istDate } from "@vakilmitra/shared";
import { ChevronRight, Plus } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Empty, ErrorBox, Loading, Section } from "@/components/common";
import { HearingRow } from "@/components/HearingRow";
import { Button } from "@/components/ui/button";
import { fmtDate, fmtDay, fmtNumber, rupees } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { boardQuery, feeSummaryQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({ component: TodayPage });

function TodayPage() {
  const { t, tf, locale } = useI18n();
  const { advocate } = Route.useRouteContext();
  const today = istDate();
  const tomorrow = addDays(today, 1);
  const [day, setDay] = useState(today);
  const board = useQuery(boardQuery(day));
  const todays = useQuery(boardQuery(today));
  const fees = useQuery(feeSummaryQuery);

  // Group the board by court, the way advocates walk the corridor.
  const byCourt = new Map<string, NonNullable<typeof board.data>["hearings"]>();
  for (const h of board.data?.hearings ?? []) {
    const k = h.court || h.case.court || "—";
    byCourt.set(k, [...(byCourt.get(k) ?? []), h]);
  }
  const missing = todays.data?.needsNextDate ?? [];

  return (
    <>
      <header className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="label-mono">{fmtDay(today, locale)}</p>
          <h1 className="font-display mt-1 line-clamp-2 text-2xl leading-8">{tf("today.greeting", { name: advocate.name })}</h1>
        </div>
        <Button asChild size="sm" className="shrink-0">
          <Link to="/cases/new">
            <Plus /> {t("case.new")}
          </Link>
        </Button>
      </header>

      <div className="panel grid grid-cols-3 divide-x overflow-hidden">
        <Stat to="/diary" label={t("today.statHearings")} value={todays.data ? fmtNumber(todays.data.hearings.length, locale) : "–"} />
        <Stat
          to="/cases"
          label={t("today.statMissing")}
          value={todays.data ? fmtNumber(missing.length, locale) : "–"}
          tone={missing.length > 0 ? "text-warning" : undefined}
        />
        <Stat
          to="/fees"
          label={t("today.statFees")}
          value={fees.data ? rupees(fees.data.totals.outstandingPaise, locale) : "–"}
          tone={fees.data && fees.data.totals.overduePaise > 0 ? "text-destructive" : undefined}
        />
      </div>

      <ErrorBox error={board.error} onRetry={() => board.refetch()} />

      <Section
        title={t("today.byCourt")}
        action={
          <fieldset className="inline-flex gap-1 text-sm">
            <legend className="sr-only">{t("today.title")}</legend>
            {[
              { d: today, label: t("today.today") },
              { d: tomorrow, label: t("today.tomorrow") },
            ].map((o) => (
              <button
                key={o.d}
                type="button"
                aria-pressed={day === o.d}
                onClick={() => setDay(o.d)}
                className={cn(
                  "h-8 rounded-lg border px-3 transition-colors",
                  day === o.d ? "border-border bg-card text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </button>
            ))}
          </fieldset>
        }
      >
        {board.isPending ? (
          <Loading />
        ) : byCourt.size === 0 ? (
          <Empty>{t("today.noHearings")}</Empty>
        ) : (
          <div className="space-y-3">
            {[...byCourt].map(([court, hs]) => (
              <div key={court} className="list">
                <h3 className="flex items-center gap-2 bg-muted/60 px-4 py-2 text-[13px] text-muted-foreground">
                  <span className="truncate">{court}</span>
                  <span className="ml-auto tabular-nums">{fmtNumber(hs.length, locale)}</span>
                </h3>
                {hs.map((h) => (
                  <HearingRow key={h.id} h={h} />
                ))}
              </div>
            ))}
          </div>
        )}
      </Section>

      {missing.length > 0 && (
        <Section title={t("today.needsNextDate")}>
          <p className="-mt-1 mb-3 text-sm text-muted-foreground">{t("today.needsNextDateHint")}</p>
          <div className="list">
            {missing.map((c) => (
              <Link key={c.id} to="/cases/$caseId" params={{ caseId: c.id }} className="list-row">
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block break-words">{c.title}</span>
                  {c.lastHearing && (
                    <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">
                      {t("today.lastHearing")}: {fmtDate(c.lastHearing.date, locale)}
                      {c.lastHearing.purpose ? ` · ${c.lastHearing.purpose}` : ""}
                    </span>
                  )}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}

function Stat({ to, label, value, tone }: { to: string; label: string; value: ReactNode; tone?: string }) {
  return (
    <Link to={to} className="min-w-0 px-3 py-3 hover:bg-background sm:px-4">
      <span className="label-mono block truncate text-xs">{label}</span>
      <span className={cn("font-display mt-1 block truncate text-xl leading-7", tone)}>{value}</span>
    </Link>
  );
}
