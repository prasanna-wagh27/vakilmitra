import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { TitleReport, TitleReportResponse } from "@vakilmitra/shared";
import { CircleCheck, Printer, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorBox, Loading, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import { fmtDate, fmtNumber } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { reportQuery, useApiMutation } from "@/lib/queries";

export const Route = createFileRoute("/_app/cases/$caseId/properties/$propertyId_/report")({ component: ReportPage });

const sevTone = { HIGH: "red", MEDIUM: "amber", LOW: "neutral" } as const;

function ReportPage() {
  const { caseId, propertyId } = Route.useParams();
  const base = `/cases/${caseId}/properties/${propertyId}/report`;
  const { t, tf, locale } = useI18n();
  const { data, error, isPending, refetch } = useQuery(reportQuery(caseId, propertyId));
  const [opinion, setOpinion] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const saved = data?.draft?.opinion ?? "";
  useEffect(() => setOpinion(saved), [saved]);

  const save = useApiMutation(() => api(base, { method: "PUT", body: { opinion, language: locale } }));
  const approve = useApiMutation(() => api(`${base}/approve`, { method: "POST" }), { onSuccess: () => setShowCurrent(false) });

  if (isPending) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={() => refetch()} />;

  const { draft } = data;
  const approved = draft?.status === "APPROVED" && draft.approved;
  const report = approved && !showCurrent ? draft.approved! : data.report;
  const dirty = opinion !== saved;

  return (
    <>
      <div className="no-print">
        <PageHeader
          title={t("report.title")}
          back={`/cases/${caseId}/properties/${propertyId}`}
          action={
            <Button variant="outline" onClick={() => window.print()}>
              <Printer /> {t("common.print")}
            </Button>
          }
        />
        {approved ? (
          <div className="mb-4 space-y-2">
            <p className="flex items-center gap-2 rounded-xl bg-success-soft p-3 text-[15px] text-success">
              <CircleCheck className="size-4 shrink-0" /> {tf("report.approved", { date: fmtDate(draft.approvedAt!, locale) })}
            </p>
            {data.changedSinceApproval && (
              <div className="rounded-xl bg-warning-soft p-3 text-[15px] text-warning">
                <p className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {t("report.changed")}
                </p>
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => setShowCurrent((v) => !v)}>
                  {showCurrent ? t("report.showApproved") : t("report.showCurrent")}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="mb-4 rounded-xl bg-warning-soft p-3 text-[15px] text-warning">{t("report.draftNote")}</p>
        )}
      </div>

      <ReportBody data={data} report={report} opinion={approved && !showCurrent ? draft.opinion : opinion} />

      <section className="no-print panel mt-6 p-4">
        <label htmlFor="opinion" className="font-display text-xl">
          {t("report.opinion")}
        </label>
        <p className="mb-2 text-[15px] text-muted-foreground">{t("report.opinionHint")}</p>
        <Textarea id="opinion" rows={6} value={opinion} onChange={(e) => setOpinion(e.target.value)} />
        <ErrorBox error={save.error ?? approve.error} />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => save.mutate(undefined)} disabled={!dirty || save.isPending}>
            {t("common.save")}
          </Button>
          <Button
            onClick={() => approve.mutate(undefined)}
            disabled={dirty || !saved.trim() || approve.isPending || (!!approved && !data.changedSinceApproval)}
          >
            <CircleCheck /> {t("report.approve")}
          </Button>
          {dirty && <span className="text-[15px] text-muted-foreground">{t("report.saveFirst")}</span>}
        </div>
      </section>
    </>
  );
}

function ReportBody({ data, report, opinion }: { data: TitleReportResponse; report: TitleReport; opinion: string }) {
  const { t, tf, locale } = useI18n();
  const { property: p, period, owners } = report;
  const approved = data.draft?.status === "APPROVED" ? data.draft : null;
  const names = (xs: string[]) => xs.join(", ");
  const heading = (k: MessageKey) => <h2 className="mt-6 mb-2 border-b pb-1 font-display text-lg">{t(k)}</h2>;
  const propLine = [
    p.gatNo && `${t("land.gat")} ${p.gatNo}`,
    p.surveyNo && `${t("land.survey")} ${p.surveyNo}`,
    p.hissaNo && `${t("land.hissa")} ${p.hissaNo}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <article className="panel p-6 text-[15px] print:border-0 print:p-0 print:shadow-none">
      <header className="mb-4 border-b pb-3">
        <p className="text-lg font-medium">{data.advocate.name}</p>
        <p className="text-muted-foreground">
          {[data.advocate.barCouncilNo, data.advocate.phone, data.advocate.email].filter(Boolean).join(" · ")}
        </p>
      </header>
      <h1 className="font-display text-2xl">{t("report.title")}</h1>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">{t("land.property")}</dt>
        <dd>{[propLine, p.village, p.taluka, p.district].filter(Boolean).join(", ")}</dd>
        {p.areaSqm != null && (
          <>
            <dt className="text-muted-foreground">{t("land.area")}</dt>
            <dd>{fmtNumber(p.areaSqm, locale)}</dd>
          </>
        )}
        {p.landClass && (
          <>
            <dt className="text-muted-foreground">{t("land.landClass")}</dt>
            <dd>{p.landClass}</dd>
          </>
        )}
        {data.client && (
          <>
            <dt className="text-muted-foreground">{t("report.preparedFor")}</dt>
            <dd>{data.client.name}</dd>
          </>
        )}
        <dt className="text-muted-foreground">{t("report.period")}</dt>
        <dd>
          {period.from ? fmtDate(period.from, locale) : "—"} – {fmtDate(period.to, locale)}
        </dd>
        <dt className="text-muted-foreground">{t("report.date")}</dt>
        <dd>{fmtDate(period.to, locale)}</dd>
      </dl>
      {!period.complete && (
        <p className="mt-2 rounded-lg bg-warning-soft p-2 text-warning">{tf("report.incomplete", { years: period.years })}</p>
      )}

      {heading("report.owners")}
      {owners ? (
        <p>
          <span className="font-medium">{names(owners.names)}</span>{" "}
          <span className="text-muted-foreground">({tf("report.asPer", { date: fmtDate(owners.asPerDate, locale) })})</span>
        </p>
      ) : (
        <p className="text-muted-foreground">{t("report.noOwners")}</p>
      )}

      {heading("report.chain")}
      <ol className="space-y-2">
        {report.chain.map((e, i) => (
          <li key={e.id} className="grid grid-cols-[2rem_1fr] gap-2 break-inside-avoid">
            <span className="text-muted-foreground tabular-nums">{i + 1}.</span>
            <div>
              <p className="font-medium">
                {fmtDate(e.date, locale)} · {t(`land.kind.${e.kind}`)}
                {e.subtype && ` (${e.subtype})`}
                {e.ferfarNo && (
                  <>
                    {` · ${t("land.ferfarNo")} `}
                    <span className="num">{e.ferfarNo}</span>
                  </>
                )}
                {e.deedRegNo && (
                  <>
                    {` · ${t("land.deedRegNo")} `}
                    <span className="num">{e.deedRegNo}</span>
                  </>
                )}
                {e.section155 && ` · ${t("land.section155")}`}
              </p>
              {e.kind === "RECORD_SNAPSHOT" ? (
                e.owners.length > 0 && <p>{names(e.owners)}</p>
              ) : (
                <p>
                  {names(e.from) || "—"} → {names(e.to) || "—"}
                </p>
              )}
              {e.notes && <p className="text-muted-foreground">{e.notes}</p>}
            </div>
          </li>
        ))}
      </ol>

      {heading("report.encumbrances")}
      {report.encumbrances.length === 0 ? (
        <p className="text-muted-foreground">{t("report.noEncumbrances")}</p>
      ) : (
        <ul className="list-disc space-y-1 pl-5">
          {report.encumbrances.map((e, i) => (
            <li key={`${e.eventId}-${i}`}>{e.source === "mortgage" ? `${t("report.mortgage")}: ${e.text}` : e.text}</li>
          ))}
        </ul>
      )}

      {heading("report.openFlags")}
      {report.flags.open.length === 0 ? (
        <p className="text-muted-foreground">{t("report.noOpenFlags")}</p>
      ) : (
        <ul className="space-y-1">
          {report.flags.open.map((f) => (
            <li key={f.id} className="flex items-start gap-2 break-inside-avoid">
              <Badge tone={sevTone[f.severity]}>{t(`sev.${f.severity}`)}</Badge>
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}
      {report.flags.resolved.length > 0 && (
        <>
          {heading("report.resolvedFlags")}
          <ul className="space-y-1">
            {report.flags.resolved.map((f) => (
              <li key={f.id} className="break-inside-avoid">
                <p>{f.message}</p>
                {f.resolution && <p className="text-muted-foreground">→ {f.resolution}</p>}
              </li>
            ))}
          </ul>
        </>
      )}

      {heading("report.documents")}
      <ul className="list-disc space-y-1 pl-5">
        {report.documents.map((d) => (
          <li key={d.id}>
            {[d.title, t(`doctype.${d.type}` as MessageKey), d.year].filter(Boolean).join(" · ")} ({tf("report.pages", { n: d.pageCount })})
          </li>
        ))}
      </ul>

      {heading("report.opinion")}
      {opinion.trim() ? <p className="whitespace-pre-wrap">{opinion}</p> : <p className="text-muted-foreground">{t("report.noOpinion")}</p>}

      <footer className="mt-10 flex justify-end">
        <div className="min-w-48 border-t pt-2 text-center">
          <p className="font-medium">{data.advocate.name}</p>
          <p className="text-muted-foreground">
            {approved?.approvedAt ? tf("report.approved", { date: fmtDate(approved.approvedAt, locale) }) : t("report.signature")}
          </p>
        </div>
      </footer>
    </article>
  );
}
