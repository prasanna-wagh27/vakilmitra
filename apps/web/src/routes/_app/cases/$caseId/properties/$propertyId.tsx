import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import type { Flag } from "@vakilmitra/shared";
import { Flag as FlagIcon, Plus } from "lucide-react";
import { useState } from "react";
import { Empty, ErrorBox, Field, Loading, PageHeader, Section } from "@/components/common";
import { FlagCard } from "@/components/FlagCard";
import { EventForm } from "@/components/forms";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { fmtDate, fmtNumber } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { propertyQuery, useApiMutation } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/cases/$caseId/properties/$propertyId")({ component: PropertyPage });

const kindTone = { RECORD_SNAPSHOT: "blue", DEED: "green", MUTATION: "amber" } as const;

function PropertyPage() {
  const { caseId, propertyId } = Route.useParams();
  const base = `/cases/${caseId}/properties/${propertyId}`;
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const { data: p, error, isPending, refetch } = useQuery(propertyQuery(caseId, propertyId));
  const [adding, setAdding] = useState(false);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [resolving, setResolving] = useState<Flag | null>(null);
  const [resolution, setResolution] = useState("");

  const check = useApiMutation(() => api<{ flags: Flag[]; ranAt: string }>(`${base}/check`, { method: "POST", query: { lang: locale } }), {
    onSuccess: (r) => setRanAt(r.ranAt),
  });
  const setResolved = useApiMutation(
    (v: { flag: Flag; resolved: boolean; note?: string }) =>
      api(`/cases/${caseId}/flags/${v.flag.id}`, {
        method: "PATCH",
        body: { resolved: v.resolved, resolution: v.resolved ? v.note?.trim() || null : null },
      }),
    {
      onSuccess: () => {
        setResolving(null);
        setResolution("");
      },
    },
  );
  const removeEvent = useApiMutation((eventId: string) => api(`${base}/events/${eventId}`, { method: "DELETE" }));

  if (isPending) return <Loading />;
  if (error || !p) return <ErrorBox error={error} onRetry={() => refetch()} />;

  function showSources(eventIds: string[]) {
    setHighlight(eventIds);
    document.getElementById(`ev-${eventIds[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const flaggedEvents = new Set(p.flags.filter((f) => !f.resolved).flatMap((f) => f.eventIds));
  const title =
    [
      p.gatNo && `${t("land.gat")} ${p.gatNo}`,
      p.surveyNo && `${t("land.survey")} ${p.surveyNo}`,
      p.hissaNo && `${t("land.hissa")} ${p.hissaNo}`,
    ]
      .filter(Boolean)
      .join(", ") || t("land.property");
  const row = (label: MessageKey, value: string | null | undefined) =>
    value ? (
      <>
        <dt className="text-muted-foreground">{t(label)}</dt>
        <dd>{value}</dd>
      </>
    ) : null;

  return (
    <>
      <PageHeader title={title} back={`/cases/${caseId}`} />
      <p className="-mt-3 mb-3 text-sm text-muted-foreground">{[p.village, p.taluka, p.district].filter(Boolean).join(", ")}</p>
      <p className="mb-4 rounded-xl bg-warning-soft p-3 text-sm text-warning">{t("land.manualNote")}</p>

      <Section
        title={t("land.flags")}
        action={
          <Button onClick={() => check.mutate(undefined)} disabled={check.isPending || p.events.length === 0}>
            {t("land.runCheck")}
          </Button>
        }
      >
        <p className="mb-2 text-sm text-muted-foreground">{t("land.checkHint")}</p>
        <ErrorBox error={check.error} />
        {p.flags.length === 0 ? (
          <Empty>{ranAt ? t("land.noFlags") : t("land.notRunYet")}</Empty>
        ) : (
          <div className="space-y-2">
            {p.flags.map((f) => (
              <FlagCard key={f.id} flag={f} onSource={showSources}>
                <div className="mt-2">
                  {f.resolved ? (
                    <Button variant="ghost" size="sm" onClick={() => setResolved.mutate({ flag: f, resolved: false })}>
                      {t("land.reopen")}
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setResolving(f)}>
                      {t("land.resolve")}
                    </Button>
                  )}
                </div>
              </FlagCard>
            ))}
          </div>
        )}
      </Section>

      <Section
        title={t("land.chain")}
        action={
          <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus /> {t("land.addEntry")}
          </Button>
        }
      >
        {p.events.length === 0 ? (
          <Empty>{t("land.noEvents")}</Empty>
        ) : (
          <ol className="relative space-y-3 border-l-2 pl-4">
            {p.events.map((e) => (
              <li
                key={e.id}
                id={`ev-${e.id}`}
                className={cn(
                  "relative rounded-2xl border bg-card p-3 transition",
                  highlight.includes(e.id) && "ring-2 ring-primary",
                  flaggedEvents.has(e.id) && "border-destructive/40",
                )}
              >
                <span aria-hidden className="absolute top-4 -left-[1.45rem] size-3 rounded-full border-2 border-background bg-primary" />
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{fmtDate(e.date, locale)}</span>
                  <Badge tone={kindTone[e.kind]}>{t(`land.kind.${e.kind}`)}</Badge>
                  {e.subtype && <Badge>{t(`sub.${e.subtype}` as MessageKey)}</Badge>}
                  {e.section155 && <Badge tone="red">{t("land.section155")}</Badge>}
                  {flaggedEvents.has(e.id) && <FlagIcon className="size-4 text-destructive" aria-label={t("land.flags")} />}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                  {row("land.ferfarNo", e.ferfarNo)}
                  {row("land.deedRegNo", e.deedRegNo)}
                  {row("land.refDeed", e.refDeedRegNo)}
                  {row("land.from", e.fromParties.join(", "))}
                  {row("land.to", e.toParties.join(", "))}
                  {row("land.owners", e.owners.join(", "))}
                  {row("land.area", e.areaSqm != null ? fmtNumber(e.areaSqm, locale) : null)}
                  {row("land.landClass", e.landClass)}
                  {row("land.otherRights", e.otherRights.join("; "))}
                </dl>
                {e.notes && <p className="mt-1 text-sm text-muted-foreground">{e.notes}</p>}
                <div className="mt-1 text-right">
                  <button
                    type="button"
                    className="text-sm text-muted-foreground underline"
                    onClick={() => confirm(t("common.confirmDelete")) && removeEvent.mutate(e.id)}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Sheet open={adding} onOpenChange={setAdding} title={t("land.addEntry")}>
        <EventForm
          base={base}
          onDone={() => {
            setAdding(false);
            void qc.invalidateQueries({ queryKey: ["property", propertyId] });
          }}
          onCancel={() => setAdding(false)}
        />
      </Sheet>

      <Sheet open={!!resolving} onOpenChange={(o) => !o && setResolving(null)} title={t("land.resolve")}>
        {resolving && (
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              setResolved.mutate({ flag: resolving, resolved: true, note: resolution });
            }}
            className="space-y-3"
          >
            <FlagCard flag={resolving} compact />
            <Field id="resolution" label={t("land.resolution")}>
              <Textarea id="resolution" className="min-h-24" value={resolution} onChange={(e) => setResolution(e.target.value)} />
            </Field>
            <ErrorBox error={setResolved.error} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setResolving(null)}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" className="flex-1" disabled={setResolved.isPending}>
                {t("land.resolve")}
              </Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
