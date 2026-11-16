"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { fmtDate, rupees } from "@/lib/format";
import type { ClientTotals } from "@/lib/types";
import { Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";

/** One screen: total outstanding per client. */
export default function FeesPage() {
  const { t, locale } = useI18n();
  const { data, error, loading, reload } = useApi<{ clients: ClientTotals[]; totals: { totalPaise: number; paidPaise: number; outstandingPaise: number; overduePaise: number } }>("/fees/summary");

  return (
    <>
      <PageHeader title={t("fees.title")} />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? <Loading /> : data && (
        <>
          <Card className="mb-4 grid grid-cols-2 gap-3">
            <div>
              <p className="muted text-sm">{t("fees.outstanding")}</p>
              <p className="text-2xl font-bold">{rupees(data.totals.outstandingPaise, locale)}</p>
            </div>
            <div>
              <p className="muted text-sm">{t("fees.overdue")}</p>
              <p className={`text-2xl font-bold ${data.totals.overduePaise ? "text-red-700 dark:text-red-300" : ""}`}>{rupees(data.totals.overduePaise, locale)}</p>
            </div>
            <p className="muted col-span-2 text-sm">{t("fees.total")} {rupees(data.totals.totalPaise, locale)} · {t("fees.paid")} {rupees(data.totals.paidPaise, locale)}</p>
          </Card>
          {data.clients.filter((c) => c.outstandingPaise > 0).length === 0 ? (
            <Empty>{t("fees.allClear")}</Empty>
          ) : (
            <ul className="surface divide-y rounded-2xl border hairline">
              {data.clients.filter((c) => c.outstandingPaise > 0).map((c) => (
                <li key={c.clientId}>
                  <Link href={`/clients/${c.clientId}`} className="flex min-h-14 items-center justify-between gap-3 p-3 hover:brightness-95">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.clientName}</p>
                      <p className="muted text-sm">
                        {c.overduePaise > 0 && <span className="text-red-700 dark:text-red-300">{t("fees.overdue")} {rupees(c.overduePaise, locale)} · </span>}
                        {c.nextDue && `${t("fees.nextDue")} ${fmtDate(c.nextDue.date, locale, { day: "numeric", month: "short" })}`}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold">{rupees(c.outstandingPaise, locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
