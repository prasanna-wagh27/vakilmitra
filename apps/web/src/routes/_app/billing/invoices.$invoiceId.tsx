import { PrinterIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { INDIAN_STATES } from "@vakilmitra/shared";
import { ErrorBox, Loading, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fmtDate, rupees } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { planInvoiceQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/billing/invoices/$invoiceId")({ component: PlanInvoicePage });

/** Printable invoice for a plan payment: a GST tax invoice if we were registered when it was issued, else a receipt. */
function PlanInvoicePage() {
  const { invoiceId } = Route.useParams();
  const { t, tf, locale } = useI18n();
  const { data, error, isPending, refetch } = useQuery(planInvoiceQuery(invoiceId));
  if (isPending) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={() => refetch()} />;
  const { invoice: i, supplier: s } = data;
  const money = (p: number) => rupees(p, locale);
  const tax = i.supplierGstin !== null;
  const title = t(tax ? "billing.invoice" : "billing.receipt");
  const rows: [string, number][] = !tax
    ? []
    : [
        [t("billing.taxable"), i.amountPaise],
        ...(i.igstPaise
          ? ([[t("billing.igst"), i.igstPaise]] as [string, number][])
          : ([
              [t("billing.cgst"), i.cgstPaise],
              [t("billing.sgst"), i.sgstPaise],
            ] as [string, number][])),
      ];

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={title}
          back="/billing"
          action={
            <Button onClick={() => window.print()}>
              <HugeiconsIcon icon={PrinterIcon} /> {t("common.print")}
            </Button>
          }
        />
      </div>
      <article className="panel p-6 text-sm print:border-0 print:p-0 print:shadow-none">
        <header className="mb-4 flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <p className="text-lg font-bold">{s.name}</p>
            {s.address && <p className="text-muted-foreground">{s.address}</p>}
            {s.gstin && <p>GSTIN: {s.gstin}</p>}
          </div>
          <div className="text-right">
            <p className="font-semibold">{title}</p>
            {i.status === "REFUNDED" && <Badge tone="neutral">{t("billing.refunded")}</Badge>}
          </div>
        </header>

        <div className="mb-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">{t("billing.billTo")}</p>
            <p className="font-medium">{i.billingName}</p>
            {i.billingState && <p>{INDIAN_STATES[i.billingState] ?? i.billingState}</p>}
            {tax && i.gstin && <p>GSTIN: {i.gstin}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 sm:justify-self-end">
            <dt className="text-muted-foreground">{t(tax ? "billing.invoiceNo" : "billing.receiptNo")}</dt>
            <dd>{i.number}</dd>
            <dt className="text-muted-foreground">{t("billing.date")}</dt>
            <dd>{fmtDate(i.createdAt, locale)}</dd>
            <dt className="text-muted-foreground">{t("billing.paymentRef")}</dt>
            <dd className="break-all">{i.razorpayPaymentId}</dd>
          </dl>
        </div>

        <table className="w-full border-collapse">
          <tbody>
            <tr className="border-y">
              <td className="py-2 pr-4">
                <p className="font-medium">
                  {tf("billing.item", {
                    plan: t(`billing.plan.${i.plan}` as MessageKey),
                    interval: t(i.interval === "MONTHLY" ? "billing.monthly" : "billing.yearly"),
                  })}
                </p>
                <p className="text-muted-foreground">
                  {t("billing.period")}: {fmtDate(i.periodStart, locale)} – {fmtDate(i.periodEnd, locale)}
                  {s.sac && ` · SAC ${s.sac}`}
                </p>
              </td>
              <td className="py-2 text-right tabular-nums">{money(i.amountPaise)}</td>
            </tr>
            {rows.map(([label, v]) => (
              <tr key={label}>
                <td className="py-1 pr-4 text-right text-muted-foreground">{label}</td>
                <td className="py-1 text-right tabular-nums">{money(v)}</td>
              </tr>
            ))}
            <tr className="border-t font-semibold">
              <td className="py-2 pr-4 text-right">{t("billing.total")}</td>
              <td className="py-2 text-right tabular-nums">{money(i.totalPaise)}</td>
            </tr>
          </tbody>
        </table>
      </article>
    </>
  );
}
