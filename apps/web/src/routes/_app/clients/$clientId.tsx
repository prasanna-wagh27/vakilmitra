import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Empty, ErrorBox, Loading, PageHeader, Section } from "@/components/common";
import { ClientForm, FeeAgreementForm, PaymentForm } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[15px]">
          {c.phone && (
            <a className="num text-accent" href={`tel:${c.phone}`}>
              {c.phone}
            </a>
          )}
          {c.email && (
            <a className="text-accent" href={`mailto:${c.email}`}>
              {c.email}
            </a>
          )}
          {c.whatsappOptIn && <Badge tone="green">WhatsApp ✓</Badge>}
        </div>
        {c.address && <p className="mt-3 text-[15px]">{c.address}</p>}
        {c.notes && <p className="mt-2 text-[15px] whitespace-pre-wrap text-muted-foreground">{c.notes}</p>}
      </div>

      <Section
        title={t("client.cases")}
        action={
          <Link to="/cases/new" className="text-[15px] text-accent">
            + {t("case.new")}
          </Link>
        }
      >
        {c.cases.length === 0 ? (
          <Empty />
        ) : (
          <ul className="list">
            {c.cases.map((k) => (
              <li key={k.id}>
                <Link to="/cases/$caseId" params={{ caseId: k.id }} className="list-item">
                  <p className="text-[17px]">{k.title}</p>
                  <p className="mt-0.5 text-[15px] text-muted-foreground">
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
            <Plus /> {t("common.add")}
          </Button>
        }
      >
        <div className="band mb-4 grid grid-cols-3 overflow-hidden">
          {[
            [t("fees.total"), data.totals.totalPaise],
            [t("fees.paid"), data.totals.paidPaise],
            [t("fees.outstanding"), data.totals.outstandingPaise],
          ].map(([label, v]) => (
            <div key={label as string} className="min-w-0 px-4 pt-4 pb-5 [&+&]:border-l [&+&]:border-white/12">
              <p className="label-mono truncate text-[12px] !text-white/60">{label}</p>
              <p className="font-display mt-5 truncate text-2xl leading-none">{rupees(v as number, locale)}</p>
            </div>
          ))}
        </div>
        {c.feeAgreements.map((a) => {
          const paid = a.payments.reduce((s, p) => s + p.amountPaise, 0);
          return (
            <div key={a.id} className="border-b py-4 first-of-type:border-t">
              <div className="flex justify-between gap-3">
                <p className="text-[17px]">{a.description}</p>
                <p className="num shrink-0 text-[14px]">
                  {rupees(paid, locale)} / {rupees(a.totalPaise, locale)}
                </p>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setSheet({ payment: a.id })}>
                {t("fees.recordPayment")}
              </Button>
            </div>
          );
        })}
        {c.feeAgreements.length > 0 && (
          <Link to="/fees/invoice/$clientId" params={{ clientId }} className="mt-4 inline-block text-[15px] text-accent">
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
