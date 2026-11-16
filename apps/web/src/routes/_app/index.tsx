import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays, istDate } from "@vakilmitra/shared";
import { ArrowUpRight, CalendarClock, FolderPlus, Gavel, Search } from "lucide-react";
import { useState } from "react";
import { Empty, ErrorBox, Loading, Section } from "@/components/common";
import { HearingRow } from "@/components/HearingRow";
import { Badge } from "@/components/ui/badge";
import { fmtDate, fmtDay, rupees } from "@/lib/format";
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
  const fees = useQuery(feeSummaryQuery);

  // Group the board by court, the way advocates walk the corridor.
  const byCourt = new Map<string, NonNullable<typeof board.data>["hearings"]>();
  for (const h of board.data?.hearings ?? []) {
    const k = h.court || h.case.court || "—";
    byCourt.set(k, [...(byCourt.get(k) ?? []), h]);
  }
  const n = board.data?.hearings.length ?? 0;
  const countLine = !board.data
    ? ""
    : n === 0
      ? t("today.countNone")
      : n === 1
        ? t("today.countOne")
        : tf("today.count", { n: n.toLocaleString(locale === "mr" ? "mr-IN" : "en-IN") });

  return (
    <>
      {/* The day at a glance: an ink card, like a cause-list cover. */}
      <section className="hero-ink relative overflow-hidden px-6 pt-6 pb-5 sm:px-8 sm:pt-8">
        <p className="text-xs font-medium tracking-[0.12em] text-white/60 uppercase">{fmtDay(day, locale)}</p>
        <h1 className="font-display mt-2 text-[2rem] leading-tight sm:text-[2.6rem]">{tf("today.greeting", { name: advocate.name })}</h1>
        <p className="mt-1 flex items-center gap-2 text-white/75">
          <Gavel className="size-4" aria-hidden />
          {countLine}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <fieldset className="inline-flex rounded-full bg-white/10 p-1 text-sm">
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
                  "min-h-9 rounded-full px-4 font-medium transition-colors",
                  day === o.d ? "bg-white text-black" : "text-white/80 hover:text-white",
                )}
              >
                {o.label}
              </button>
            ))}
          </fieldset>
          <span className="ml-auto flex gap-2">
            <Link
              to="/cases/new"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-black hover:bg-white/90"
            >
              <FolderPlus className="size-4" aria-hidden /> {t("case.new")}
            </Link>
            <Link
              to="/search"
              aria-label={t("search.title")}
              className="inline-flex size-10 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
            >
              <Search className="size-4" />
            </Link>
          </span>
        </div>
      </section>

      <ErrorBox error={board.error} onRetry={() => board.refetch()} />

      <Section title={t("today.byCourt")}>
        {board.isPending ? (
          <Loading />
        ) : byCourt.size === 0 ? (
          <Empty>{t("today.noHearings")}</Empty>
        ) : (
          <div className="space-y-4">
            {[...byCourt].map(([court, hs]) => (
              <div key={court} className="rounded-3xl bg-muted/70 p-2 sm:p-3">
                <h3 className="flex items-center gap-2 px-2 pt-1 pb-2 text-sm font-medium text-muted-foreground">
                  <span className="truncate">{court}</span>
                  <span className="ml-auto rounded-full bg-card px-2 text-xs tabular-nums">{hs.length}</span>
                </h3>
                <div className="space-y-2">
                  {hs.map((h) => (
                    <HearingRow key={h.id} h={h} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {fees.data && fees.data.totals.outstandingPaise > 0 && (
        <Link to="/fees" className="panel group mt-8 flex items-center justify-between gap-4 p-5 hover:shadow-[var(--shadow-float)]">
          <span>
            <span className="block text-sm text-muted-foreground">{t("today.outstanding")}</span>
            <span className="font-display mt-1 block text-3xl">{rupees(fees.data.totals.outstandingPaise, locale)}</span>
            {fees.data.totals.overduePaise > 0 && (
              <span className="mt-1 inline-flex rounded-full bg-destructive-soft px-2.5 py-0.5 text-xs font-medium text-destructive">
                {rupees(fees.data.totals.overduePaise, locale)} {t("today.overdue")}
              </span>
            )}
          </span>
          <span className="icon-ring size-11 shrink-0 group-hover:bg-muted">
            <ArrowUpRight className="size-5" aria-hidden />
          </span>
        </Link>
      )}

      {board.data && board.data.needsNextDate.length > 0 && (
        <Section title={t("today.needsNextDate")} action={<Badge tone="amber">{board.data.needsNextDate.length}</Badge>}>
          <p className="mb-3 max-w-prose text-sm text-muted-foreground">{t("today.needsNextDateHint")}</p>
          <div className="space-y-2">
            {board.data.needsNextDate.map((c) => (
              <Link key={c.id} to="/cases/$caseId" params={{ caseId: c.id }} className="row-card flex items-center gap-3 p-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning">
                  <CalendarClock className="size-5" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{c.title}</span>
                  {c.lastHearing && (
                    <span className="block text-sm text-muted-foreground">
                      {t("today.lastHearing")}: {fmtDate(c.lastHearing.date, locale)}
                      {c.lastHearing.purpose ? ` · ${c.lastHearing.purpose}` : ""}
                    </span>
                  )}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
