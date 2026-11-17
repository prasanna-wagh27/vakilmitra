import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { type Hearing, istDate } from "@vakilmitra/shared";
import { FileUp, Plus, Scan, X } from "lucide-react";
import { useState } from "react";
import { Empty, ErrorBox, Loading, PageHeader, Section } from "@/components/common";
import { FlagCard } from "@/components/FlagCard";
import { CaseForm, FeeAgreementForm, HearingForm, OutcomeForm, PartyForm, PaymentForm, PropertyForm, ShareForm } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { fmtDate, rupees } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { caseQuery, documentsQuery, useApiMutation } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { OcrBadge } from "./documents/$documentId";

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
  const docs = useQuery(documentsQuery(caseId));
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

      <div>
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge>{t(`kind.${c.kind}`)}</Badge>
          <Badge tone={c.status === "ACTIVE" ? "green" : "neutral"}>{t(`status.${c.status}`)}</Badge>
          {!isOwner && <Badge tone="blue">{t("case.shared")}</Badge>}
        </div>
        <dl className="grid grid-cols-[auto_1fr] border-t text-[15px] [&>dd]:border-b [&>dd]:py-3 [&>dt]:border-b [&>dt]:py-3 [&>dt]:pr-6">
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
                <Link className="text-accent underline underline-offset-4" to="/clients/$clientId" params={{ clientId: c.client.id }}>
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
        {c.notes && <p className="mt-4 text-[15px] whitespace-pre-wrap text-muted-foreground">{c.notes}</p>}
      </div>

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

      <Section
        title={t("doc.title")}
        action={
          canEdit && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/cases/$caseId/scan" params={{ caseId }} search={{ mode: "upload" }}>
                  <FileUp /> {t("doc.upload")}
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/cases/$caseId/scan" params={{ caseId }}>
                  <Scan /> {t("doc.scan")}
                </Link>
              </Button>
            </div>
          )
        }
      >
        {docs.data?.length ? (
          <ul className="list">
            {docs.data.map((d) => (
              <li key={d.id}>
                <Link to="/cases/$caseId/documents/$documentId" params={{ caseId, documentId: d.id }} className="list-row justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-[17px]">
                      {d.title || t(`doctype.${d.type}`)}
                      {d.year ? ` · ${d.year}` : ""}
                    </p>
                    <p className="mt-0.5 text-[15px] text-muted-foreground">
                      {d.pageCount} {t("doc.pages")}
                    </p>
                  </div>
                  <OcrBadge status={d.ocrStatus} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>{t("doc.none")}</Empty>
        )}
      </Section>

      <Section title={t("case.hearings")} action={canEdit && <AddButton onClick={() => setSheet({ kind: "hearing" })} />}>
        {c.hearings.length === 0 ? (
          <Empty />
        ) : (
          <ol className="list">
            {[...upcoming, ...past].map((h) => {
              const d = istDate(h.date);
              const isToday = d === today;
              const isPast = d < today;
              return (
                <li key={h.id} className={cn("list-item", isPast && h.outcome && "opacity-70")}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[17px]">
                        {fmtDate(h.date, locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                        {isToday && <span className="chip ml-2 align-middle !bg-accent-soft !text-accent">{t("today.today")}</span>}
                      </p>
                      {h.purpose && <p className="mt-0.5 text-[15px] text-muted-foreground">{h.purpose}</p>}
                    </div>
                    {canEdit && (isPast || isToday) && (
                      <Button variant={h.outcome ? "ghost" : "outline"} size="sm" onClick={() => setSheet({ kind: "outcome", hearing: h })}>
                        {h.outcome ? t("common.edit") : t("case.recordOutcome")}
                      </Button>
                    )}
                  </div>
                  {h.outcome && (
                    <p className="mt-2 text-[15px]">
                      <span className="text-muted-foreground">{t("case.outcome")}: </span>
                      {h.outcome}
                    </p>
                  )}
                  {h.nextStep && (
                    <p className="text-[15px]">
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
          <ul className="list">
            {c.parties.map((p) => (
              <li key={p.id} className="list-row justify-between">
                <div>
                  <p className="text-[17px]">{p.name}</p>
                  <p className="mt-0.5 text-[15px] text-muted-foreground">
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
          <ul className="list">
            {c.properties.map((p) => (
              <li key={p.id}>
                <Link to="/cases/$caseId/properties/$propertyId" params={{ caseId, propertyId: p.id }} className="list-item">
                  <p className="text-[17px]">{propTitle(p)}</p>
                  <p className="mt-0.5 text-[15px] text-muted-foreground">
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
          <ul className="list">
            {c.feeAgreements.map((a) => (
              <li key={a.id} className="list-item">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[17px]">{a.description}</p>
                  <p className="text-right text-[15px]">
                    <span className="font-display block text-xl">{rupees(Math.max(0, a.totalPaise - paid(a)), locale)}</span>
                    <span className="text-muted-foreground">{t("fees.outstanding")}</span>
                  </p>
                </div>
                <p className="mt-1 text-[15px] text-muted-foreground">
                  {t("fees.total")} {rupees(a.totalPaise, locale)} · {t("fees.paid")} {rupees(paid(a), locale)}
                </p>
                {isOwner && (
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setSheet({ kind: "payment", agreementId: a.id })}>
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
            <p className="text-[15px] text-muted-foreground">{t("case.shareHint")}</p>
          ) : (
            <ul className="list">
              {c.grants.map((g) => (
                <li key={g.id} className="list-row justify-between">
                  <div>
                    <p className="text-[17px]">{g.advocate.name}</p>
                    <p className="mt-0.5 text-[15px] text-muted-foreground">
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
          <p className="mb-4 text-[15px] text-muted-foreground">{t("case.deleteHint")}</p>
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
