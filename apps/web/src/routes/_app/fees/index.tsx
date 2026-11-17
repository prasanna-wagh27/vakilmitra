import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Empty, ErrorBox, Loading, PageHeader } from "@/components/common";
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
            <div className="band mb-12 overflow-hidden">
              <div className="grid grid-cols-2">
                <div className="min-w-0 px-4 pt-4 pb-5">
                  <p className="label-mono truncate text-[12px] !text-white/60">{t("fees.outstanding")}</p>
                  <p className="font-display mt-6 truncate text-[32px] leading-none">{rupees(data.totals.outstandingPaise, locale)}</p>
                </div>
                <div className="min-w-0 border-l border-white/12 px-4 pt-4 pb-5">
                  <p className="label-mono truncate text-[12px] !text-white/60">{t("fees.overdue")}</p>
                  <p className={`font-display mt-6 truncate text-[32px] leading-none ${data.totals.overduePaise ? "text-[#ff9b8f]" : ""}`}>
                    {rupees(data.totals.overduePaise, locale)}
                  </p>
                </div>
              </div>
              <p className="label-mono border-t border-white/12 px-4 py-3 text-[12px] !text-white/60">
                {t("fees.total")} {rupees(data.totals.totalPaise, locale)} · {t("fees.paid")} {rupees(data.totals.paidPaise, locale)}
              </p>
            </div>
            {owing.length === 0 ? (
              <Empty>{t("fees.allClear")}</Empty>
            ) : (
              <ul className="list">
                {owing.map((c) => (
                  <li key={c.clientId}>
                    <Link to="/clients/$clientId" params={{ clientId: c.clientId }} className="list-row justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-[17px]">{c.clientName}</p>
                        <p className="mt-0.5 text-[15px] text-muted-foreground">
                          {c.overduePaise > 0 && (
                            <span className="text-destructive">
                              {t("fees.overdue")} {rupees(c.overduePaise, locale)} ·{" "}
                            </span>
                          )}
                          {c.nextDue && `${t("fees.nextDue")} ${fmtDate(c.nextDue.date, locale, { day: "numeric", month: "short" })}`}
                        </p>
                      </div>
                      <span className="font-display shrink-0 text-lg">{rupees(c.outstandingPaise, locale)}</span>
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
