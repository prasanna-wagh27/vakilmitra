import { Add01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Empty, ErrorBox, Loading, PageHeader, Section } from "@/components/common";
import { ClientForm, FeeAgreementForm, PaymentForm } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { rupees } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { clientQuery, useApiMutation } from "@/lib/queries";

export const Route = createFileRoute("/_app/clients/$clientId")({ component: ClientPage });

function ClientPage() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { data, error, isPending, refetch } = useQuery(clientQuery(clientId));
  const [sheet, setSheet] = useState<"edit" | "fee" | { payment: string } | null>(null);
  const close = () => setSheet(null);
  const remove = useApiMutation(() => api(`/clients/${clientId}`, { method: "DELETE" }), { onSuccess: () => navigate({ to: "/clients" }) });

  if (isPending) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={() => refetch()} />;
  const c = data.client;

  return (
    <>
      <PageHeader
        title={c.name}
        back="/clients"
        action={
          <Button variant="outline" onClick={() => setSheet("edit")}>
            {t("common.edit")}
          </Button>
        }
      />
      <Card className="px-(--card-spacing) gap-3 px-(--card-spacing)">
        <div className="flex flex-wrap gap-3 text-sm">
          {c.phone && (
            <a className="text-primary underline underline-offset-4" href={`tel:${c.phone}`}>
              {c.phone}
            </a>
          )}
          {c.email && (
            <a className="text-primary underline underline-offset-4" href={`mailto:${c.email}`}>
              {c.email}
            </a>
          )}
          {c.whatsappOptIn && <Badge tone="green">WhatsApp ✓</Badge>}
        </div>
        {c.address && <p className="mt-1 text-sm">{c.address}</p>}
        {c.notes && <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{c.notes}</p>}
      </Card>

      <Section
        title={t("client.cases")}
        action={
          <Link to="/cases/new" className="text-sm text-primary underline underline-offset-4">
            + {t("case.new")}
          </Link>
        }
      >
        {c.cases.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-2">
            {c.cases.map((k) => (
              <li key={k.id}>
                <Link to="/cases/$caseId" params={{ caseId: k.id }} className="row-card block p-4">
                  <p className="font-medium">{k.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {[k.caseNumber, k.court, t(`status.${k.status}`)].filter(Boolean).join(" · ")}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        title={t("case.fees")}
        action={
          <Button variant="outline" size="sm" onClick={() => setSheet("fee")}>
            <HugeiconsIcon icon={Add01Icon} /> {t("common.add")}
          </Button>
        }
      >
        <Card className="px-(--card-spacing) mb-2 grid grid-cols-3 text-center text-sm">
          <div>
            <p className="text-muted-foreground">{t("fees.total")}</p>
            <p className="font-semibold">{rupees(data.totals.totalPaise, locale)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("fees.paid")}</p>
            <p className="font-semibold">{rupees(data.totals.paidPaise, locale)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("fees.outstanding")}</p>
            <p className="font-semibold">{rupees(data.totals.outstandingPaise, locale)}</p>
          </div>
        </Card>
        {c.feeAgreements.map((a) => {
          const paid = a.payments.reduce((s, p) => s + p.amountPaise, 0);
          return (
            <div key={a.id} className="row-card mb-2 p-4">
              <div className="flex justify-between gap-2">
                <p className="font-medium">{a.description}</p>
                <p className="text-sm">
                  {rupees(paid, locale)} / {rupees(a.totalPaise, locale)}
                </p>
              </div>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => setSheet({ payment: a.id })}>
                {t("fees.recordPayment")}
              </Button>
            </div>
          );
        })}
        {c.feeAgreements.length > 0 && (
          <Link
            to="/fees/invoice/$clientId"
            params={{ clientId }}
            className="mt-1 inline-block text-sm text-primary underline underline-offset-4"
          >
            {t("fees.invoice")} →
          </Link>
        )}
      </Section>

      <Section title={t("common.delete")}>
        <ErrorBox error={remove.error} />
        <Button variant="destructive" onClick={() => confirm(t("common.confirmDelete")) && remove.mutate(undefined)}>
          {t("common.delete")}
        </Button>
      </Section>

      <Sheet open={sheet === "edit"} onOpenChange={close} title={t("common.edit")}>
        <ClientForm initial={c} onSaved={close} onCancel={close} />
      </Sheet>
      <Sheet open={sheet === "fee"} onOpenChange={close} title={t("fees.addAgreement")}>
        <FeeAgreementForm clientId={c.id} onDone={close} onCancel={close} />
      </Sheet>
      <Sheet open={typeof sheet === "object" && sheet !== null} onOpenChange={close} title={t("fees.recordPayment")}>
        {typeof sheet === "object" && sheet !== null && <PaymentForm agreementId={sheet.payment} onDone={close} onCancel={close} />}
      </Sheet>
    </>
  );
}
