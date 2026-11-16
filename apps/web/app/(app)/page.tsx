"use client";
import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { addDays, fmtDate, fmtDay, istDate, rupees } from "@/lib/format";
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader, Section } from "@/components/ui";
import { HearingRow, type HearingWithCase } from "@/components/HearingRow";

interface Board {
  date: string;
  hearings: HearingWithCase[];
  needsNextDate: { id: string; title: string; caseNumber?: string | null; lastHearing: { date: string; purpose?: string | null } | null }[];
}

export default function TodayPage() {
  const { t, locale } = useI18n();
  const today = istDate();
  const [day, setDay] = useState(today);
  const board = useApi<Board>("/diary/board", { date: day });
  const fees = useApi<{ totals: { outstandingPaise: number; overduePaise: number } }>("/fees/summary");

  // Group the daily board by court, the way advocates walk the corridor.
  const byCourt = new Map<string, HearingWithCase[]>();
  for (const h of board.data?.hearings ?? []) {
    const k = h.court || h.case.court || "—";
    byCourt.set(k, [...(byCourt.get(k) ?? []), h]);
  }

  return (
    <>
      <PageHeader title={t("today.title")} />
      <div className="mb-3 flex items-center gap-2">
        {[today, addDays(today, 1)].map((d, i) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={`min-h-10 rounded-full border px-4 text-sm ${day === d ? "border-brand-600 bg-brand-600 text-white" : "surface"}`}
          >
            {i === 0 ? t("today.today") : t("today.tomorrow")}
          </button>
        ))}
        <span className="muted ml-auto text-sm">{fmtDay(`${day}T12:00:00+05:30`, locale)}</span>
      </div>

      <ErrorBox error={board.error} onRetry={board.reload} />
      {board.loading && !board.data ? (
        <Loading />
      ) : byCourt.size === 0 ? (
        <Empty>{t("today.noHearings")}</Empty>
      ) : (
        [...byCourt].map(([court, hs]) => (
          <div key={court} className="mb-4">
            <h3 className="muted mb-2 text-sm font-semibold">{court} · {hs.length}</h3>
            <div className="space-y-2">{hs.map((h) => <HearingRow key={h.id} h={h} />)}</div>
          </div>
        ))
      )}

      {fees.data && fees.data.totals.outstandingPaise > 0 && (
        <Link href="/fees" className="mt-4 block">
          <Card className="flex items-center justify-between">
            <span>{t("today.outstanding")}</span>
            <span className="text-right">
              <span className="block font-semibold">{rupees(fees.data.totals.outstandingPaise, locale)}</span>
              {fees.data.totals.overduePaise > 0 && (
                <span className="text-xs text-red-700 dark:text-red-300">{rupees(fees.data.totals.overduePaise, locale)} {t("today.overdue")}</span>
              )}
            </span>
          </Card>
        </Link>
      )}

      {board.data && board.data.needsNextDate.length > 0 && (
        <Section title={t("today.needsNextDate")} action={<Badge tone="amber">{board.data.needsNextDate.length}</Badge>}>
          <p className="muted mb-2 text-sm">{t("today.needsNextDateHint")}</p>
          <div className="space-y-2">
            {board.data.needsNextDate.map((c) => (
              <Link key={c.id} href={`/cases/${c.id}`} className="surface block rounded-2xl border border-amber-300 p-3 dark:border-amber-800">
                <p className="font-semibold">{c.title}</p>
                {c.lastHearing && (
                  <p className="muted text-sm">
                    {t("today.lastHearing")}: {fmtDate(c.lastHearing.date, locale)} {c.lastHearing.purpose ? `· ${c.lastHearing.purpose}` : ""}
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
