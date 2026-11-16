import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Printer } from "lucide-react";
import { ErrorBox, Loading, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { fmtDate, rupees } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { invoiceQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/fees/invoice/$clientId")({ component: InvoicePage });

function InvoicePage() {
  const { clientId } = Route.useParams();
  const { t, locale } = useI18n();
  const { data, error, isPending, refetch } = useQuery(invoiceQuery(clientId));
  if (isPending) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={() => refetch()} />;
  const { advocate, client, totals } = data;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={t("fees.invoice")}
          back={`/clients/${clientId}`}
          action={
            <Button onClick={() => window.print()}>
              <Printer /> {t("common.print")}
            </Button>
          }
        />
      </div>
      <article className="panel p-6 print:border-0 print:shadow-none print:p-0">
        <header className="mb-4 border-b pb-3">
          <p className="text-lg font-bold">{advocate.name}</p>
          <p className="text-sm text-muted-foreground">
            {[advocate.barCouncilNo, advocate.phone, advocate.email].filter(Boolean).join(" · ")}
          </p>
        </header>
        <div className="mb-4 flex justify-between gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">{t("fees.billTo")}</p>
            <p className="font-medium">{client.name}</p>
            {client.address && <p>{client.address}</p>}
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">{t("fees.issued")}</p>
            <p>{fmtDate(data.issuedOn, locale)}</p>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2">{t("fees.description")}</th>
              <th className="py-2 text-right">{t("fees.total")}</th>
              <th className="py-2 text-right">{t("fees.paid")}</th>
            </tr>
          </thead>
          <tbody>
            {client.feeAgreements.map((a) => (
              <tr key={a.id} className="border-b align-top">
                <td className="py-2">
                  {a.description}
                  {a.case && (
                    <span className="block text-xs text-muted-foreground">
                      {[a.case.title, a.case.caseNumber].filter(Boolean).join(" · ")}
                    </span>
                  )}
                  {a.payments.map((p) => (
                    <span key={p.id} className="block text-xs text-muted-foreground">
                      {fmtDate(p.paidOn, locale)} · {p.mode ? t(`fees.mode.${p.mode}` as MessageKey) : ""} · {rupees(p.amountPaise, locale)}
                    </span>
                  ))}
                </td>
                <td className="py-2 text-right">{rupees(a.totalPaise, locale)}</td>
                <td className="py-2 text-right">
                  {rupees(
                    a.payments.reduce((s, p) => s + p.amountPaise, 0),
                    locale,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-right text-lg font-bold">
          {t("fees.balance")}: {rupees(totals?.outstandingPaise ?? 0, locale)}
        </p>
      </article>
    </>
  );
}
