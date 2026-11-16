"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { addDays, fmtDay, istDate } from "@/lib/format";
import { Button, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { HearingRow, type HearingWithCase } from "@/components/HearingRow";

export default function DiaryPage() {
  const { t, locale } = useI18n();
  const [from, setFrom] = useState(istDate());
  const to = addDays(from, 13);
  const { data, error, loading, reload } = useApi<{ hearings: HearingWithCase[] }>("/diary", { from, to });

  const byDay = new Map<string, HearingWithCase[]>();
  for (const h of data?.hearings ?? []) {
    const d = istDate(h.date);
    byDay.set(d, [...(byDay.get(d) ?? []), h]);
  }

  return (
    <>
      <PageHeader title={t("diary.title")} />
      <div className="mb-3 flex items-center gap-2">
        <Button variant="secondary" aria-label="previous" onClick={() => setFrom(addDays(from, -14))}>‹</Button>
        <input className="input flex-1" type="date" value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} aria-label={t("common.date")} />
        <Button variant="secondary" aria-label="next" onClick={() => setFrom(addDays(from, 14))}>›</Button>
      </div>
      <p className="muted mb-3 text-sm">{fmtDay(`${from}T12:00:00+05:30`, locale)} – {fmtDay(`${to}T12:00:00+05:30`, locale)}</p>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : byDay.size === 0 ? (
        <Empty>{t("diary.empty")}</Empty>
      ) : (
        [...byDay].map(([day, hs]) => (
          <div key={day} className="mb-4">
            <h3 className={`mb-2 text-sm font-semibold ${day === istDate() ? "text-brand-600" : "muted"}`}>
              {fmtDay(`${day}T12:00:00+05:30`, locale)} · {hs.length}
            </h3>
            <div className="space-y-2">{hs.map((h) => <HearingRow key={h.id} h={h} />)}</div>
          </div>
        ))
      )}
    </>
  );
}
