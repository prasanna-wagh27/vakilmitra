"use client";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { fmtDate } from "@/lib/format";
import type { Flag, OwnershipEvent, Property } from "@/lib/types";
import { Badge, Button, Empty, ErrorBox, Field, Loading, PageHeader, Section, Sheet } from "@/components/ui";
import { FlagCard } from "@/components/FlagCard";
import { EventForm } from "@/components/EventForm";

type PropertyDetail = Property & { events: OwnershipEvent[]; flags: Flag[] };

const kindTone = { RECORD_SNAPSHOT: "blue", DEED: "green", MUTATION: "amber" } as const;

export default function PropertyPage() {
  const { id, propertyId } = useParams<{ id: string; propertyId: string }>();
  const base = `/cases/${id}/properties/${propertyId}`;
  const { t, locale } = useI18n();
  const { data, error, loading, reload, setData } = useApi<{ property: PropertyDetail }>(base);
  const [adding, setAdding] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<Error | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<string[]>([]);
  const [resolving, setResolving] = useState<Flag | null>(null);
  const [resolution, setResolution] = useState("");

  if (loading && !data) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={reload} />;
  const p = data.property;

  async function runCheck() {
    setChecking(true);
    setCheckError(null);
    try {
      const r = await api<{ flags: Flag[]; ranAt: string }>(`${base}/check`, { method: "POST", query: { lang: locale } });
      setData({ property: { ...p, flags: r.flags } });
      setRanAt(r.ranAt);
    } catch (e) {
      setCheckError(e as Error);
    } finally {
      setChecking(false);
    }
  }

  async function setResolved(flag: Flag, resolved: boolean, note?: string) {
    await api(`/cases/${id}/flags/${flag.id}`, { method: "PATCH", body: { resolved, resolution: resolved ? note || null : null } });
    setResolving(null);
    setResolution("");
    void reload();
  }

  async function removeEvent(eventId: string) {
    if (!confirm(t("common.confirmDelete"))) return;
    await api(`${base}/events/${eventId}`, { method: "DELETE" });
    void reload();
  }

  function showSources(eventIds: string[]) {
    setHighlight(eventIds);
    document.getElementById(`ev-${eventIds[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const flaggedEvents = new Set(p.flags.filter((f) => !f.resolved).flatMap((f) => f.eventIds));
  const title = [p.gatNo && `${t("land.gat")} ${p.gatNo}`, p.surveyNo && `${t("land.survey")} ${p.surveyNo}`, p.hissaNo && `${t("land.hissa")} ${p.hissaNo}`].filter(Boolean).join(", ") || t("land.property");

  return (
    <>
      <PageHeader title={title} back={`/cases/${id}`} />
      <p className="muted -mt-3 mb-3 text-sm">{[p.village, p.taluka, p.district].filter(Boolean).join(", ")}</p>
      <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">{t("land.manualNote")}</p>

      <Section
        title={t("land.flags")}
        action={<Button onClick={runCheck} disabled={checking || p.events.length === 0}>{t("land.runCheck")}</Button>}
      >
        <p className="muted mb-2 text-sm">{t("land.checkHint")}</p>
        <ErrorBox error={checkError} />
        {p.flags.length === 0 ? (
          <Empty>{ranAt ? t("land.noFlags") : t("land.notRunYet")}</Empty>
        ) : (
          <div className="space-y-2">
            {p.flags.map((f) => (
              <FlagCard key={f.id} flag={f} onSource={showSources}>
                <div className="mt-2">
                  {f.resolved ? (
                    <Button variant="ghost" className="text-sm" onClick={() => setResolved(f, false)}>{t("land.reopen")}</Button>
                  ) : (
                    <Button variant="secondary" className="text-sm" onClick={() => setResolving(f)}>{t("land.resolve")}</Button>
                  )}
                </div>
              </FlagCard>
            ))}
          </div>
        )}
      </Section>

      <Section title={t("land.chain")} action={<Button variant="secondary" onClick={() => setAdding(true)}>+ {t("land.addEntry")}</Button>}>
        {p.events.length === 0 ? (
          <Empty>{t("land.noEvents")}</Empty>
        ) : (
          <ol className="relative space-y-3 border-l-2 hairline pl-4">
            {p.events.map((e) => (
              <li
                key={e.id}
                id={`ev-${e.id}`}
                className={`surface relative rounded-2xl border p-3 transition ${highlight.includes(e.id) ? "ring-2 ring-brand-600" : ""} ${flaggedEvents.has(e.id) ? "border-red-300 dark:border-red-900" : ""}`}
              >
                <span aria-hidden className="absolute -left-[1.45rem] top-4 h-3 w-3 rounded-full border-2 border-white bg-brand-600 dark:border-black" />
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{fmtDate(e.date, locale)}</span>
                  <Badge tone={kindTone[e.kind]}>{t(`land.kind.${e.kind}`)}</Badge>
                  {e.subtype && <Badge>{t(`sub.${e.subtype}` as never)}</Badge>}
                  {e.section155 && <Badge tone="red">{t("land.section155")}</Badge>}
                  {flaggedEvents.has(e.id) && <span className="text-red-600" aria-label={t("land.flags")}>⚑</span>}
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 text-sm">
                  {e.ferfarNo && (<><dt className="muted">{t("land.ferfarNo")}</dt><dd>{e.ferfarNo}</dd></>)}
                  {e.deedRegNo && (<><dt className="muted">{t("land.deedRegNo")}</dt><dd>{e.deedRegNo}</dd></>)}
                  {e.refDeedRegNo && (<><dt className="muted">{t("land.refDeed")}</dt><dd>{e.refDeedRegNo}</dd></>)}
                  {e.fromParties.length > 0 && (<><dt className="muted">{t("land.from")}</dt><dd>{e.fromParties.join(", ")}</dd></>)}
                  {e.toParties.length > 0 && (<><dt className="muted">{t("land.to")}</dt><dd>{e.toParties.join(", ")}</dd></>)}
                  {e.owners.length > 0 && (<><dt className="muted">{t("land.owners")}</dt><dd>{e.owners.join(", ")}</dd></>)}
                  {e.areaSqm != null && (<><dt className="muted">{t("land.area")}</dt><dd>{e.areaSqm.toLocaleString(locale === "mr" ? "mr-IN" : "en-IN")}</dd></>)}
                  {e.landClass && (<><dt className="muted">{t("land.landClass")}</dt><dd>{e.landClass}</dd></>)}
                  {e.otherRights.length > 0 && (<><dt className="muted">{t("land.otherRights")}</dt><dd>{e.otherRights.join("; ")}</dd></>)}
                </dl>
                {e.notes && <p className="muted mt-1 text-sm">{e.notes}</p>}
                <div className="mt-1 text-right">
                  <button className="muted text-sm underline" onClick={() => removeEvent(e.id)}>{t("common.delete")}</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Sheet open={adding} title={t("land.addEntry")} onClose={() => setAdding(false)}>
        <EventForm base={base} onDone={() => { setAdding(false); void reload(); }} onCancel={() => setAdding(false)} />
      </Sheet>

      <Sheet open={!!resolving} title={t("land.resolve")} onClose={() => setResolving(null)}>
        {resolving && (
          <form onSubmit={(e) => { e.preventDefault(); void setResolved(resolving, true, resolution); }} className="space-y-3">
            <FlagCard flag={resolving} compact />
            <Field label={t("land.resolution")}><textarea className="input min-h-24" value={resolution} onChange={(e) => setResolution(e.target.value)} /></Field>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setResolving(null)}>{t("common.cancel")}</Button>
              <Button type="submit" className="flex-1">{t("land.resolve")}</Button>
            </div>
          </form>
        )}
      </Sheet>
    </>
  );
}
