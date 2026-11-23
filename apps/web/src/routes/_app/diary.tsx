import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { addDays, type HearingWithCase, istDate } from "@vakilmitra/shared";
import { useState } from "react";
import { Empty, ErrorBox, Loading, PageHeader } from "@/components/common";
import { HearingRow } from "@/components/HearingRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDay } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { diaryQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/diary")({ component: DiaryPage });

function DiaryPage() {
  const { t, locale } = useI18n();
  const [from, setFrom] = useState(istDate());
  const to = addDays(from, 13);
  const { data, error, isPending, refetch } = useQuery(diaryQuery(from, to));

  const byDay = new Map<string, HearingWithCase[]>();
  for (const h of data ?? []) {
    const d = istDate(h.date);
    byDay.set(d, [...(byDay.get(d) ?? []), h]);
  }

  return (
    <>
      <PageHeader title={t("diary.title")} />
      <div className="mb-3 flex items-center gap-2">
        <Button variant="outline" size="icon" aria-label={t("common.previous")} onClick={() => setFrom(addDays(from, -14))}>
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </Button>
        <Input
          className="flex-1"
          type="date"
          value={from}
          onChange={(e) => e.target.value && setFrom(e.target.value)}
          aria-label={t("common.date")}
        />
        <Button variant="outline" size="icon" aria-label={t("common.next")} onClick={() => setFrom(addDays(from, 14))}>
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </Button>
      </div>
      <p className="mb-3 text-sm text-muted-foreground">
        {fmtDay(from, locale)} – {fmtDay(to, locale)}
      </p>
      <ErrorBox error={error} onRetry={() => refetch()} />
      {isPending ? (
        <Loading />
      ) : byDay.size === 0 ? (
        <Empty>{t("diary.empty")}</Empty>
      ) : (
        [...byDay].map(([day, hs]) => (
          <div key={day} className="mb-4">
            <h3 className={`mb-2 text-sm font-semibold ${day === istDate() ? "text-brand" : "text-muted-foreground"}`}>
              {fmtDay(day, locale)} · {hs.length}
            </h3>
            <div className="list">
              {hs.map((h) => (
                <HearingRow key={h.id} h={h} />
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}
