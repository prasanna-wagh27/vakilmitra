import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays, istDate } from "@vakilmitra/shared";
import { useState } from "react";
import { Empty, ErrorBox, Loading, Section, TrustLine } from "@/components/common";
import { HearingRow } from "@/components/HearingRow";
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
  const num = (n: number) => fmtNumber(n, locale);

  // Group the board by court, the way advocates walk the corridor.
  const byCourt = new Map<string, NonNullable<typeof board.data>["hearings"]>();
  for (const h of board.data?.hearings ?? []) {
    const k = h.court || h.case.court || "—";
    byCourt.set(k, [...(byCourt.get(k) ?? []), h]);
  }
  const missing = todays.data?.needsNextDate ?? [];
  const n = todays.data?.hearings.length ?? 0;
  const summary = todays.data
    ? [
        n === 0 ? t("today.countNone") : n === 1 ? t("today.countOne") : tf("today.count", { n: num(n) }),
        missing.length === 0 ? "" : missing.length === 1 ? t("today.missingOne") : tf("today.missing", { n: num(missing.length) }),
      ]
        .filter(Boolean)
        .join(". ")
        .replace(/\.\./g, ".")
    : "";

  return (
    <>
      <header>
        <p className="label-mono">{fmtDay(today, locale)}</p>
        <h1 className="font-display mt-3 text-[2rem] leading-[1.1]">{tf("today.greeting", { name: advocate.name })}</h1>
        {summary && <p className="mt-4 text-[17px] text-muted-foreground">{summary}</p>}
      </header>

      <div className="band mt-8 grid grid-cols-3 overflow-hidden">
        <Stat to="/diary" label={t("today.statHearings")} value={todays.data ? num(n) : "–"} />
        <Stat
          to="/cases"
          label={t("today.statMissing")}
          value={todays.data ? num(missing.length) : "–"}
          tone={missing.length > 0 ? "text-[#ffdb3d]" : undefined}
        />
        <Stat
          to="/fees"
          label={t("today.statFees")}
          value={fees.data ? rupees(fees.data.totals.outstandingPaise, locale) : "–"}
          tone={fees.data && fees.data.totals.overduePaise > 0 ? "text-[#ff9b8f]" : undefined}
        />
      </div>

      <ErrorBox error={board.error} onRetry={() => board.refetch()} />

      <Section
        title={t("today.byCourt")}
        action={
          <fieldset className="inline-flex gap-1 text-[15px]">
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
                  "h-9 rounded-lg border px-3 transition-colors",
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
          <div className="space-y-8">
            {[...byCourt].map(([court, hs], gi) => {
              const offset = [...byCourt.values()].slice(0, gi).reduce((sum, g) => sum + g.length, 0);
              return (
                <div key={court}>
                  <p className="mb-2 flex items-baseline gap-2 text-[15px] text-muted-foreground">
                    <span className="truncate">{court}</span>
                    <span className="num ml-auto text-[13px]">{String(hs.length).padStart(2, "0")}</span>
                  </p>
                  <div className="list">
                    {hs.map((h, i) => (
                      <HearingRow key={h.id} h={h} serial={offset + i + 1} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {missing.length > 0 && (
        <Section title={t("today.needsNextDate")}>
          <p className="mb-4 text-[17px] text-muted-foreground">{t("today.needsNextDateHint")}</p>
          <div className="list">
            {missing.map((c) => (
              <Link key={c.id} to="/cases/$caseId" params={{ caseId: c.id }} className="list-row">
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[17px] leading-snug break-words">{c.title}</span>
                  {c.lastHearing && (
                    <span className="mt-1 line-clamp-1 block text-[15px] text-muted-foreground">
                      {t("today.lastHearing")}: {fmtDate(c.lastHearing.date, locale)}
                      {c.lastHearing.purpose ? ` · ${c.lastHearing.purpose}` : ""}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[15px] text-accent">{t("today.addDate")}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      <TrustLine className="mt-16 border-t pt-6" />
    </>
  );
}

function Stat({ to, label, value, tone }: { to: string; label: string; value: string; tone?: string }) {
  return (
    <Link to={to} className="min-w-0 px-4 pt-4 pb-5 hover:bg-white/5 [&+&]:border-l [&+&]:border-white/12">
      <span className="label-mono block truncate text-[12px] !text-white/60">{label}</span>
      <span className={cn("font-display mt-6 block truncate text-[32px] leading-none", tone)}>{value}</span>
    </Link>
  );
}
