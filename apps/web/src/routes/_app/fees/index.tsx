import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Empty, ErrorBox, Loading, PageHeader } from "@/components/common";
import { Card } from "@/components/ui/card";
import { fmtDate, rupees } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { feeSummaryQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/fees/")({ component: FeesPage });

/** One screen: total outstanding per client. */
function FeesPage() {
  const { t, locale } = useI18n();
  const { data, error, isPending, refetch } = useQuery(feeSummaryQuery);
  const owing = data?.clients.filter((c) => c.outstandingPaise > 0) ?? [];

  return (
    <>
      <PageHeader title={t("fees.title")} />
      <ErrorBox error={error} onRetry={() => refetch()} />
      {isPending ? (
        <Loading />
      ) : (
        data && (
          <>
            <Card className="px-(--card-spacing) mb-4 grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{t("fees.outstanding")}</p>
                <p className="font-display text-3xl">{rupees(data.totals.outstandingPaise, locale)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{t("fees.overdue")}</p>
                <p className={`font-display text-3xl ${data.totals.overduePaise ? "text-destructive" : ""}`}>
                  {rupees(data.totals.overduePaise, locale)}
                </p>
              </div>
              <p className="col-span-2 text-sm text-muted-foreground">
                {t("fees.total")} {rupees(data.totals.totalPaise, locale)} · {t("fees.paid")} {rupees(data.totals.paidPaise, locale)}
              </p>
            </Card>
            {owing.length === 0 ? (
              <Empty>{t("fees.allClear")}</Empty>
            ) : (
              <ul className="panel divide-y overflow-hidden">
                {owing.map((c) => (
                  <li key={c.clientId}>
                    <Link
                      to="/clients/$clientId"
                      params={{ clientId: c.clientId }}
                      className="flex min-h-14 items-center justify-between gap-3 p-3 hover:bg-muted"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {c.overduePaise > 0 && (
                            <span className="text-destructive">
                              {t("fees.overdue")} {rupees(c.overduePaise, locale)} ·{" "}
                            </span>
                          )}
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
        )
      )}
    </>
  );
}
