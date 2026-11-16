"use client";
import { useParams } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { fmtDate, rupees } from "@/lib/format";
import type { Advocate, Client, FeeAgreement } from "@/lib/types";
import { Button, ErrorBox, Loading, PageHeader } from "@/components/ui";

type Invoice = {
  advocate: Pick<Advocate, "name" | "email" | "phone" | "barCouncilNo">;
  client: Client & { feeAgreements: FeeAgreement[] };
  totals: { totalPaise: number; paidPaise: number; outstandingPaise: number } | null;
  issuedOn: string;
};

export default function InvoicePage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { t, locale } = useI18n();
  const { data, error, loading, reload } = useApi<Invoice>(`/fees/invoice/${clientId}`);
  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={reload} />;
  const { advocate, client, totals } = data;

  return (
    <>
      <div className="no-print">
        <PageHeader title={t("fees.invoice")} back={`/clients/${clientId}`} action={<Button onClick={() => window.print()}>{t("common.print")}</Button>} />
      </div>
      <article className="surface rounded-2xl border p-5 print:border-0 print:p-0">
        <header className="mb-4 border-b hairline pb-3">
          <p className="text-lg font-bold">{advocate.name}</p>
          <p className="muted text-sm">{[advocate.barCouncilNo, advocate.phone, advocate.email].filter(Boolean).join(" · ")}</p>
        </header>
        <div className="mb-4 flex justify-between gap-4 text-sm">
          <div><p className="muted">{t("fees.billTo")}</p><p className="font-medium">{client.name}</p>{client.address && <p>{client.address}</p>}</div>
          <div className="text-right"><p className="muted">{t("fees.issued")}</p><p>{fmtDate(data.issuedOn, locale)}</p></div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b hairline text-left">
              <th className="py-2">{t("fees.description")}</th>
              <th className="py-2 text-right">{t("fees.total")}</th>
              <th className="py-2 text-right">{t("fees.paid")}</th>
            </tr>
          </thead>
          <tbody>
            {client.feeAgreements.map((a) => (
              <tr key={a.id} className="border-b hairline align-top">
                <td className="py-2">
                  {a.description}
                  {a.case && <span className="muted block text-xs">{[a.case.title, a.case.caseNumber].filter(Boolean).join(" · ")}</span>}
                  {a.payments.map((p) => (
                    <span key={p.id} className="muted block text-xs">{fmtDate(p.paidOn, locale)} · {p.mode ? t(`fees.mode.${p.mode}` as never) : ""} · {rupees(p.amountPaise, locale)}</span>
                  ))}
                </td>
                <td className="py-2 text-right">{rupees(a.totalPaise, locale)}</td>
                <td className="py-2 text-right">{rupees(a.payments.reduce((s, p) => s + p.amountPaise, 0), locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-right text-lg font-bold">{t("fees.balance")}: {rupees(totals?.outstandingPaise ?? 0, locale)}</p>
      </article>
    </>
  );
}
