"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { rupees } from "@/lib/format";
import type { CaseSummary, Client, FeeAgreement } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, Section, Sheet } from "@/components/ui";
import { ClientForm } from "@/components/ClientForm";
import { FeeAgreementForm, PaymentForm } from "@/components/caseForms";

type Detail = { client: Client & { cases: CaseSummary[]; feeAgreements: FeeAgreement[] }; totals: { totalPaise: number; paidPaise: number; outstandingPaise: number } };

export default function ClientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data, error, loading, reload } = useApi<Detail>(`/clients/${id}`);
  const [sheet, setSheet] = useState<"edit" | "fee" | { payment: string } | null>(null);
  const done = () => {
    setSheet(null);
    void reload();
  };

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={reload} />;
  const c = data.client;

  async function remove() {
    if (!confirm(t("common.confirmDelete"))) return;
    await api(`/clients/${id}`, { method: "DELETE" });
    router.push("/clients");
  }

  return (
    <>
      <PageHeader title={c.name} back="/clients" action={<Button variant="secondary" onClick={() => setSheet("edit")}>{t("common.edit")}</Button>} />
      <Card>
        <div className="flex flex-wrap gap-3 text-sm">
          {c.phone && <a className="text-brand-600 underline" href={`tel:${c.phone}`}>{c.phone}</a>}
          {c.email && <a className="text-brand-600 underline" href={`mailto:${c.email}`}>{c.email}</a>}
          {c.whatsappOptIn && <Badge tone="green">WhatsApp ✓</Badge>}
        </div>
        {c.address && <p className="mt-1 text-sm">{c.address}</p>}
        {c.notes && <p className="muted mt-1 whitespace-pre-wrap text-sm">{c.notes}</p>}
      </Card>

      <Section title={t("client.cases")} action={<Link href="/cases/new" className="text-sm text-brand-600 underline">+ {t("case.new")}</Link>}>
        {c.cases.length === 0 ? <Empty /> : (
          <ul className="space-y-2">
            {c.cases.map((k) => (
              <li key={k.id}>
                <Link href={`/cases/${k.id}`} className="surface block rounded-2xl border p-3">
                  <p className="font-medium">{k.title}</p>
                  <p className="muted text-sm">{[k.caseNumber, k.court, t(`status.${k.status}`)].filter(Boolean).join(" · ")}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("case.fees")} action={<Button variant="secondary" onClick={() => setSheet("fee")}>+ {t("common.add")}</Button>}>
        <Card className="mb-2 grid grid-cols-3 text-center text-sm">
          <div><p className="muted">{t("fees.total")}</p><p className="font-semibold">{rupees(data.totals.totalPaise, locale)}</p></div>
          <div><p className="muted">{t("fees.paid")}</p><p className="font-semibold">{rupees(data.totals.paidPaise, locale)}</p></div>
          <div><p className="muted">{t("fees.outstanding")}</p><p className="font-semibold">{rupees(data.totals.outstandingPaise, locale)}</p></div>
        </Card>
        {c.feeAgreements.map((a) => {
          const paid = a.payments.reduce((s, p) => s + p.amountPaise, 0);
          return (
            <div key={a.id} className="surface mb-2 rounded-2xl border p-3">
              <div className="flex justify-between gap-2">
                <p className="font-medium">{a.description}</p>
                <p className="text-sm">{rupees(paid, locale)} / {rupees(a.totalPaise, locale)}</p>
              </div>
              <Button variant="secondary" className="mt-2 text-sm" onClick={() => setSheet({ payment: a.id })}>{t("fees.recordPayment")}</Button>
            </div>
          );
        })}
        {c.feeAgreements.length > 0 && (
          <Link href={`/fees/invoice/${c.id}`} className="mt-1 inline-block text-sm text-brand-600 underline">{t("fees.invoice")} →</Link>
        )}
      </Section>

      <Section title={t("common.delete")}>
        <Button variant="danger" onClick={remove}>{t("common.delete")}</Button>
      </Section>

      <Sheet open={sheet === "edit"} title={t("common.edit")} onClose={() => setSheet(null)}>
        <ClientForm initial={c} onSaved={done} onCancel={() => setSheet(null)} />
      </Sheet>
      <Sheet open={sheet === "fee"} title={t("fees.addAgreement")} onClose={() => setSheet(null)}>
        <FeeAgreementForm clientId={c.id} onDone={done} onCancel={() => setSheet(null)} />
      </Sheet>
      {sheet && typeof sheet === "object" && (
        <Sheet open title={t("fees.recordPayment")} onClose={() => setSheet(null)}>
          <PaymentForm agreementId={sheet.payment} onDone={done} onCancel={() => setSheet(null)} />
        </Sheet>
      )}
    </>
  );
}
