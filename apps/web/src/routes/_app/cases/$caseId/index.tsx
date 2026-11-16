import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type Hearing, istDate } from "@vakilmitra/shared";
import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Empty, ErrorBox, Loading, PageHeader, Section } from "@/components/common";
import { FlagCard } from "@/components/FlagCard";
import { CaseForm, FeeAgreementForm, HearingForm, OutcomeForm, PartyForm, PaymentForm, PropertyForm, ShareForm } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { fmtDate, rupees } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { caseQuery, useApiMutation } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/cases/$caseId/")({ component: CasePage });

type SheetState =
  | { kind: "edit" | "hearing" | "party" | "property" | "fee" | "share" }
  | { kind: "outcome"; hearing: Hearing }
  | { kind: "payment"; agreementId: string }
  | null;

function AddButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button variant="outline" size="sm" onClick={onClick}>
      <Plus /> {t("common.add")}
    </Button>
  );
}

function CasePage() {
  const { caseId } = Route.useParams();
  const navigate = useNavigate();
  const { t, locale } = useI18n();
  const { data, error, isPending, refetch } = useQuery(caseQuery(caseId));
  const [sheet, setSheet] = useState<SheetState>(null);
  const close = () => setSheet(null);
  const remove = useApiMutation(() => api(`/cases/${caseId}`, { method: "DELETE" }), { onSuccess: () => navigate({ to: "/cases" }) });
  const unshare = useApiMutation((grantId: string) => api(`/cases/${caseId}/grants/${grantId}`, { method: "DELETE" }));

  if (isPending) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={() => refetch()} />;

  const c = data.case;
  const canEdit = data.access !== "VIEWER";
  const isOwner = data.access === "OWNER";
  const today = istDate();
  const upcoming = c.hearings.filter((h) => istDate(h.date) >= today).reverse();
  const past = c.hearings.filter((h) => istDate(h.date) < today);
  const paid = (a: (typeof c.feeAgreements)[number]) => a.payments.reduce((s, p) => s + p.amountPaise, 0);
  const propTitle = (p: (typeof c.properties)[number]) =>
    [
      p.gatNo && `${t("land.gat")} ${p.gatNo}`,
      p.surveyNo && `${t("land.survey")} ${p.surveyNo}`,
      p.hissaNo && `${t("land.hissa")} ${p.hissaNo}`,
    ]
      .filter(Boolean)
      .join(", ") || t("land.property");

  return (
    <>
      <PageHeader
        title={c.title}
        back="/cases"
        action={
          canEdit && (
            <Button variant="outline" onClick={() => setSheet({ kind: "edit" })}>
              {t("common.edit")}
            </Button>
          )
        }
      />

      <Card>
        <div className="mb-2 flex flex-wrap gap-2">
          <Badge>{t(`kind.${c.kind}`)}</Badge>
          <Badge tone={c.status === "ACTIVE" ? "green" : "neutral"}>{t(`status.${c.status}`)}</Badge>
          {!isOwner && <Badge tone="blue">{t("case.shared")}</Badge>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {c.caseNumber && (
            <>
              <dt className="text-muted-foreground">{t("case.number")}</dt>
              <dd>{c.caseNumber}</dd>
            </>
          )}
          {c.court && (
            <>
              <dt className="text-muted-foreground">{t("case.court")}</dt>
              <dd>{c.court}</dd>
            </>
          )}
          {c.cnrNumber && (
            <>
              <dt className="text-muted-foreground">{t("case.cnr")}</dt>
              <dd>{c.cnrNumber}</dd>
            </>
          )}
          {c.client && (
            <>
              <dt className="text-muted-foreground">{t("case.client")}</dt>
              <dd>
                <Link className="text-primary underline" to="/clients/$clientId" params={{ clientId: c.client.id }}>
                  {c.client.name}
                </Link>
                {c.client.phone && (
                  <>
                    {" · "}
                    <a href={`tel:${c.client.phone}`}>{c.client.phone}</a>
                  </>
                )}
              </dd>
            </>
          )}
        </dl>
        {c.notes && <p className="mt-2 text-sm whitespace-pre-wrap">{c.notes}</p>}
      </Card>

      {c.flags.length > 0 && (
        <Section title={t("case.flags")} action={<Badge tone="red">{c.flags.length}</Badge>}>
          <div className="space-y-2">
            {c.flags.map((f) =>
              f.propertyId ? (
                <Link key={f.id} to="/cases/$caseId/properties/$propertyId" params={{ caseId, propertyId: f.propertyId }} className="block">
                  <FlagCard flag={f} compact />
                </Link>
              ) : (
                <FlagCard key={f.id} flag={f} compact />
              ),
            )}
          </div>
        </Section>
      )}

      <Section title={t("case.hearings")} action={canEdit && <AddButton onClick={() => setSheet({ kind: "hearing" })} />}>
        {c.hearings.length === 0 ? (
          <Empty />
        ) : (
          <ol className="space-y-2">
            {[...upcoming, ...past].map((h) => {
              const d = istDate(h.date);
              const isToday = d === today;
              const isPast = d < today;
              return (
                <li
                  key={h.id}
                  className={cn("rounded-2xl border bg-card p-3", isToday && "border-primary", isPast && h.outcome && "opacity-75")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {fmtDate(h.date, locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                      </p>
                      {h.purpose && <p className="text-sm">{h.purpose}</p>}
                    </div>
                    {canEdit && (isPast || isToday) && (
                      <Button variant={h.outcome ? "ghost" : "outline"} size="sm" onClick={() => setSheet({ kind: "outcome", hearing: h })}>
                        {h.outcome ? t("common.edit") : t("case.recordOutcome")}
                      </Button>
                    )}
                  </div>
                  {h.outcome && (
                    <p className="mt-1 text-sm">
                      <span className="text-muted-foreground">{t("case.outcome")}: </span>
                      {h.outcome}
                    </p>
                  )}
                  {h.nextStep && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">{t("case.nextStep")}: </span>
                      {h.nextStep}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <Section title={t("case.parties")} action={canEdit && <AddButton onClick={() => setSheet({ kind: "party" })} />}>
        {c.parties.length === 0 ? (
          <Empty />
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {c.parties.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t(`role.${p.role}`)}
                    {p.opposingCounsel ? ` · ${p.opposingCounsel}` : ""}
                  </p>
                </div>
                {p.isOurClient && <Badge tone="green">{t("case.ourClient")}</Badge>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("case.properties")} action={canEdit && <AddButton onClick={() => setSheet({ kind: "property" })} />}>
        {c.properties.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-2">
            {c.properties.map((p) => (
              <li key={p.id}>
                <Link
                  to="/cases/$caseId/properties/$propertyId"
                  params={{ caseId, propertyId: p.id }}
                  className="block rounded-2xl border bg-card p-3 hover:bg-muted"
                >
                  <p className="font-semibold">{propTitle(p)}</p>
                  <p className="text-sm text-muted-foreground">
                    {[p.village, p.taluka, p.district].filter(Boolean).join(", ")} · {t("land.chain")}: {p.eventCount}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t("case.fees")} action={isOwner && c.client && <AddButton onClick={() => setSheet({ kind: "fee" })} />}>
        {c.feeAgreements.length === 0 ? (
          <Empty />
        ) : (
          <ul className="space-y-2">
            {c.feeAgreements.map((a) => (
              <li key={a.id} className="rounded-2xl border bg-card p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{a.description}</p>
                  <p className="text-right text-sm">
                    <span className="block font-semibold">{rupees(Math.max(0, a.totalPaise - paid(a)), locale)}</span>
                    <span className="text-muted-foreground">{t("fees.outstanding")}</span>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("fees.total")} {rupees(a.totalPaise, locale)} · {t("fees.paid")} {rupees(paid(a), locale)}
                </p>
                {isOwner && (
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setSheet({ kind: "payment", agreementId: a.id })}>
                    {t("fees.recordPayment")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {isOwner && (
        <Section
          title={t("case.sharing")}
          action={
            <Button variant="outline" size="sm" onClick={() => setSheet({ kind: "share" })}>
              {t("case.share")}
            </Button>
          }
        >
          {c.grants.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("case.shareHint")}</p>
          ) : (
            <ul className="divide-y rounded-2xl border bg-card">
              {c.grants.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 p-3">
                  <div>
                    <p className="font-medium">{g.advocate.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {g.advocate.email} · {g.role === "EDITOR" ? t("case.editor") : t("case.viewer")}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => unshare.mutate(g.id)}>
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {isOwner && (
        <Section title={t("case.delete")}>
          <p className="mb-2 text-sm text-muted-foreground">{t("case.deleteHint")}</p>
          <ErrorBox error={remove.error} />
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => confirm(t("common.confirmDelete")) && remove.mutate(undefined)}
          >
            {t("common.delete")}
          </Button>
        </Section>
      )}

      <Sheet open={sheet?.kind === "edit"} onOpenChange={close} title={t("common.edit")}>
        <CaseForm initial={c} onSaved={close} onCancel={close} />
      </Sheet>
      <Sheet open={sheet?.kind === "hearing"} onOpenChange={close} title={t("case.addHearing")}>
        <HearingForm caseId={caseId} onDone={close} onCancel={close} />
      </Sheet>
      <Sheet open={sheet?.kind === "outcome"} onOpenChange={close} title={t("case.recordOutcome")}>
        {sheet?.kind === "outcome" && <OutcomeForm hearing={sheet.hearing} onDone={close} onCancel={close} />}
      </Sheet>
      <Sheet open={sheet?.kind === "party"} onOpenChange={close} title={t("case.addParty")}>
        <PartyForm caseId={caseId} onDone={close} onCancel={close} />
      </Sheet>
      <Sheet open={sheet?.kind === "property"} onOpenChange={close} title={t("case.addProperty")}>
        <PropertyForm
          caseId={caseId}
          onSaved={(propertyId) => navigate({ to: "/cases/$caseId/properties/$propertyId", params: { caseId, propertyId } })}
          onCancel={close}
        />
      </Sheet>
      {c.client && (
        <Sheet open={sheet?.kind === "fee"} onOpenChange={close} title={t("fees.addAgreement")}>
          <FeeAgreementForm clientId={c.client.id} caseId={caseId} onDone={close} onCancel={close} />
        </Sheet>
      )}
      <Sheet open={sheet?.kind === "payment"} onOpenChange={close} title={t("fees.recordPayment")}>
        {sheet?.kind === "payment" && <PaymentForm agreementId={sheet.agreementId} onDone={close} onCancel={close} />}
      </Sheet>
      <Sheet open={sheet?.kind === "share"} onOpenChange={close} title={t("case.share")}>
        <ShareForm caseId={caseId} onDone={close} onCancel={close} />
      </Sheet>
    </>
  );
}
