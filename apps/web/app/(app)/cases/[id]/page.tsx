"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { fmtDate, istDate, rupees } from "@/lib/format";
import type { CaseDetail, Hearing } from "@/lib/types";
import { Badge, Button, Card, Empty, ErrorBox, Loading, PageHeader, Section, Sheet } from "@/components/ui";
import { CaseForm } from "@/components/CaseForm";
import { FlagCard } from "@/components/FlagCard";
import { FeeAgreementForm, HearingForm, OutcomeForm, PartyForm, PaymentForm, PropertyForm, ShareForm } from "@/components/caseForms";

type SheetState =
  | { kind: "edit" | "hearing" | "party" | "property" | "fee" | "share" }
  | { kind: "outcome"; hearing: Hearing }
  | { kind: "payment"; agreementId: string }
  | null;

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { data, error, loading, reload } = useApi<{ case: CaseDetail; access: "OWNER" | "EDITOR" | "VIEWER" }>(`/cases/${id}`);
  const [sheet, setSheet] = useState<SheetState>(null);
  const close = () => setSheet(null);
  const done = () => {
    setSheet(null);
    void reload();
  };

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={reload} />;

  const c = data.case;
  const canEdit = data.access !== "VIEWER";
  const isOwner = data.access === "OWNER";
  const today = istDate();
  const upcoming = c.hearings.filter((h) => istDate(h.date) >= today).reverse();
  const past = c.hearings.filter((h) => istDate(h.date) < today);
  const paid = (a: CaseDetail["feeAgreements"][number]) => a.payments.reduce((s, p) => s + p.amountPaise, 0);

  async function remove() {
    if (!confirm(t("common.confirmDelete"))) return;
    await api(`/cases/${id}`, { method: "DELETE" });
    router.push("/cases");
  }

  async function unshare(grantId: string) {
    await api(`/cases/${id}/grants/${grantId}`, { method: "DELETE" });
    void reload();
  }

  return (
    <>
      <PageHeader
        title={c.title}
        back="/cases"
        action={canEdit && <Button variant="secondary" onClick={() => setSheet({ kind: "edit" })}>{t("common.edit")}</Button>}
      />

      <Card>
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge>{t(`kind.${c.kind}`)}</Badge>
          <Badge tone={c.status === "ACTIVE" ? "green" : "neutral"}>{t(`status.${c.status}`)}</Badge>
          {!isOwner && <Badge tone="blue">{t("case.shared")}</Badge>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {c.caseNumber && (<><dt className="muted">{t("case.number")}</dt><dd>{c.caseNumber}</dd></>)}
          {c.court && (<><dt className="muted">{t("case.court")}</dt><dd>{c.court}</dd></>)}
          {c.cnrNumber && (<><dt className="muted">{t("case.cnr")}</dt><dd>{c.cnrNumber}</dd></>)}
          {c.client && (
            <>
              <dt className="muted">{t("case.client")}</dt>
              <dd><Link className="text-brand-600 underline" href={`/clients/${c.client.id}`}>{c.client.name}</Link>{c.client.phone && <> · <a href={`tel:${c.client.phone}`}>{c.client.phone}</a></>}</dd>
            </>
          )}
        </dl>
        {c.notes && <p className="mt-2 whitespace-pre-wrap text-sm">{c.notes}</p>}
      </Card>

      {c.flags.length > 0 && (
        <Section title={t("case.flags")} action={<Badge tone="red">{c.flags.length}</Badge>}>
          <div className="space-y-2">
            {c.flags.map((f) => (
              <Link key={f.id} href={f.propertyId ? `/cases/${id}/properties/${f.propertyId}` : "#"} className="block">
                <FlagCard flag={f} compact />
              </Link>
            ))}
          </div>
        </Section>
      )}

      <Section title={t("case.hearings")} action={canEdit && <Button variant="secondary" onClick={() => setSheet({ kind: "hearing" })}>+ {t("common.add")}</Button>}>
        {c.hearings.length === 0 ? (
          <Empty />
        ) : (
          <ol className="space-y-2">
            {[...upcoming, ...past].map((h) => {
              const isPast = istDate(h.date) < today;
              const isToday = istDate(h.date) === today;
              return (
                <li key={h.id} className={`surface rounded-2xl border p-3 ${isToday ? "border-brand-600" : ""} ${isPast && h.outcome ? "opacity-75" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{fmtDate(h.date, locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</p>
                      {h.purpose && <p className="text-sm">{h.purpose}</p>}
                    </div>
                    {canEdit && (isPast || isToday) && (
                      <Button variant={h.outcome ? "ghost" : "secondary"} className="shrink-0 text-sm" onClick={() => setSheet({ kind: "outcome", hearing: h })}>
                        {h.outcome ? t("common.edit") : t("case.recordOutcome")}
                      </Button>
                    )}
                  </div>
                  {h.outcome && <p className="mt-1 text-sm"><span className="muted">{t("case.outcome")}: </span>{h.outcome}</p>}
                  {h.nextStep && <p className="text-sm"><span className="muted">{t("case.nextStep")}: </span>{h.nextStep}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title={t("case.parties")} action={canEdit && <Button variant="secondary" onClick={() => setSheet({ kind: "party" })}>+ {t("common.add")}</Button>}>
        {c.parties.length === 0 ? (
          <Empty />
        ) : (
          <ul className="surface divide-y rounded-2xl border hairline">
            {c.parties.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="muted text-sm">{t(`role.${p.role}` as never)}{p.opposingCounsel ? ` · ${p.opposingCounsel}` : ""}</p>
                </div>
                {p.isOurClient && <Badge tone="green">{t("case.ourClient")}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("case.properties")} action={canEdit && <Button variant="secondary" onClick={() => setSheet({ kind: "property" })}>+ {t("common.add")}</Button>}>
        {c.properties.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-2">
            {c.properties.map((p) => (
              <li key={p.id}>
                <Link href={`/cases/${id}/properties/${p.id}`} className="surface block rounded-2xl border p-3 hover:brightness-95">
                  <p className="font-semibold">
                    {[p.gatNo && `${t("land.gat")} ${p.gatNo}`, p.surveyNo && `${t("land.survey")} ${p.surveyNo}`, p.hissaNo && `${t("land.hissa")} ${p.hissaNo}`].filter(Boolean).join(", ") || t("land.property")}
                  </p>
                  <p className="muted text-sm">{[p.village, p.taluka, p.district].filter(Boolean).join(", ")} · {t("land.chain")}: {p._count?.events ?? 0}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("case.fees")} action={canEdit && isOwner && c.client && <Button variant="secondary" onClick={() => setSheet({ kind: "fee" })}>+ {t("common.add")}</Button>}>
        {c.feeAgreements.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-2">
            {c.feeAgreements.map((a) => {
              const p = paid(a);
              return (
                <li key={a.id} className="surface rounded-2xl border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{a.description}</p>
                    <p className="text-right text-sm">
                      <span className="block font-semibold">{rupees(Math.max(0, a.totalPaise - p), locale)}</span>
                      <span className="muted">{t("fees.outstanding")}</span>
                    </p>
                  </div>
                  <p className="muted text-sm">{t("fees.total")} {rupees(a.totalPaise, locale)} · {t("fees.paid")} {rupees(p, locale)}</p>
                  {isOwner && <Button variant="secondary" className="mt-2 text-sm" onClick={() => setSheet({ kind: "payment", agreementId: a.id })}>{t("fees.recordPayment")}</Button>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {isOwner && (
        <Section title={t("case.sharing")} action={<Button variant="secondary" onClick={() => setSheet({ kind: "share" })}>{t("case.share")}</Button>}>
          {(c.grants ?? []).length === 0 ? (
            <p className="muted text-sm">{t("case.shareHint")}</p>
          ) : (
            <ul className="surface divide-y rounded-2xl border hairline">
              {c.grants!.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 p-3">
                  <div>
                    <p className="font-medium">{g.advocate.name}</p>
                    <p className="muted text-sm">{g.advocate.email} · {g.role === "EDITOR" ? t("case.editor") : t("case.viewer")}</p>
                  </div>
                  <Button variant="ghost" onClick={() => unshare(g.id)} aria-label={t("common.delete")}>✕</Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {isOwner && (
        <Section title={t("case.delete")}>
          <p className="muted mb-2 text-sm">{t("case.deleteHint")}</p>
          <Button variant="danger" onClick={remove}>{t("common.delete")}</Button>
        </Section>
      )}

      <Sheet open={sheet?.kind === "edit"} title={t("common.edit")} onClose={close}>
        <CaseForm initial={c} onSaved={done} onCancel={close} />
      </Sheet>
      <Sheet open={sheet?.kind === "hearing"} title={t("case.addHearing")} onClose={close}>
        <HearingForm caseId={id} onDone={done} onCancel={close} />
      </Sheet>
      {sheet?.kind === "outcome" && (
        <Sheet open title={t("case.recordOutcome")} onClose={close}>
          <OutcomeForm hearing={sheet.hearing} onDone={done} onCancel={close} />
        </Sheet>
      )}
      <Sheet open={sheet?.kind === "party"} title={t("case.addParty")} onClose={close}>
        <PartyForm caseId={id} onDone={done} onCancel={close} />
      </Sheet>
      <Sheet open={sheet?.kind === "property"} title={t("case.addProperty")} onClose={close}>
        <PropertyForm caseId={id} onDone={(pid) => router.push(`/cases/${id}/properties/${pid}`)} onCancel={close} />
      </Sheet>
      {c.client && (
        <Sheet open={sheet?.kind === "fee"} title={t("fees.addAgreement")} onClose={close}>
          <FeeAgreementForm clientId={c.client.id} caseId={id} onDone={done} onCancel={close} />
        </Sheet>
      )}
      {sheet?.kind === "payment" && (
        <Sheet open title={t("fees.recordPayment")} onClose={close}>
          <PaymentForm agreementId={sheet.agreementId} onDone={done} onCancel={close} />
        </Sheet>
      )}
      <Sheet open={sheet?.kind === "share"} title={t("case.share")} onClose={close}>
        <ShareForm caseId={id} onDone={done} onCancel={close} />
      </Sheet>
    </>
  );
}
