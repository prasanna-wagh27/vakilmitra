import { ArrowUpRight01Icon, RefreshIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type CaseTracking, type CourtChange, type CourtUpdate, formatCnr, type Locale, normalizeCnr } from "@vakilmitra/shared";
import type { MessageKey } from "@vakilmitra/shared/i18n";
import { type FormEvent, useEffect, useRef, useState } from "react";
import { ErrorBox, Field, Section } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { fmtDate, fmtDay } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { trackingQuery, useApiMutation } from "@/lib/queries";

type Tf = (key: MessageKey, vars: Record<string, string | number>) => string;

/** One court change in a line, e.g. "Next date Fri, 18 Dec (was Fri, 4 Dec) · Arguments". */
export function changeText(c: CourtChange, t: (k: MessageKey) => string, tf: Tf, locale: Locale): string {
  switch (c.kind) {
    case "NEXT_DATE":
      return [
        tf("track.change.NEXT_DATE", { to: fmtDay(c.to, locale) }) +
          (c.from ? ` (${tf("track.change.was", { from: fmtDay(c.from, locale) })})` : ""),
        c.purpose,
      ]
        .filter(Boolean)
        .join(" · ");
    case "NEW_ORDER":
      return [tf("track.change.NEW_ORDER", { date: fmtDay(c.date, locale) }), c.title].filter(Boolean).join(" · ");
    case "DISPOSED":
      return [t("track.change.DISPOSED"), c.on && fmtDay(c.on, locale), c.nature].filter(Boolean).join(" · ");
  }
}

/** An order's PDF on the court's site; opened in a new tab, never through our servers. */
function OrderLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline"
    >
      {label}
      <HugeiconsIcon icon={ArrowUpRight01Icon} className="size-3.5" />
    </a>
  );
}

function StartForm({ caseId, cnrNumber }: { caseId: string; cnrNumber: string | null }) {
  const { t } = useI18n();
  const [cnr, setCnr] = useState(cnrNumber ? formatCnr(cnrNumber) : "");
  const start = useApiMutation((value: string) => api(`/cases/${caseId}/tracking`, { method: "PUT", body: { cnr: value } }));
  const valid = normalizeCnr(cnr) !== null;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (valid) start.mutate(cnr);
  };
  return (
    <Card className="gap-4 px-(--card-spacing)">
      <p className="text-sm">{t("track.intro")}</p>
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field id="cnr" label={t("case.cnr")} hint={t("track.cnrHint")}>
            <Input
              id="cnr"
              value={cnr}
              onChange={(e) => setCnr(e.target.value)}
              placeholder="MHPU010012342024"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className="font-mono uppercase"
            />
          </Field>
        </div>
        <Button type="submit" disabled={!valid || start.isPending} className="sm:mb-6">
          {start.isPending && <Spinner data-icon="inline-start" />}
          {t("track.start")}
        </Button>
      </form>
      <ErrorBox error={start.error} />
    </Card>
  );
}

function Tracked({
  caseId,
  tracking,
  updates,
  canEdit,
  checking,
  onAsked,
}: {
  caseId: string;
  tracking: CaseTracking;
  updates: CourtUpdate[];
  canEdit: boolean;
  /** A reading asked for by hand is on its way. */
  checking: boolean;
  onAsked: () => void;
}) {
  const { t, tf, locale } = useI18n();
  const refresh = useApiMutation(() => api(`/cases/${caseId}/tracking/refresh`, { method: "POST" }), { onSuccess: onAsked });
  const stop = useApiMutation(() => api(`/cases/${caseId}/tracking`, { method: "DELETE" }));
  const s = tracking.snapshot;
  const when = (iso: string) => fmtDate(iso, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <>
        <dt className="text-muted-foreground">{label}</dt>
        <dd>{value}</dd>
      </>
    ) : null;

  return (
    <Card className="gap-4 px-(--card-spacing)">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm">{formatCnr(tracking.cnr)}</span>
          {s && (
            <Badge tone={s.disposed ? "neutral" : "green"}>
              {s.statusText ?? (s.disposed ? t("status.DISPOSED") : t("status.ACTIVE"))}
            </Badge>
          )}
        </div>
        {tracking.lastCheckedAt && (
          <span className="text-xs text-muted-foreground">{tf("track.lastChecked", { when: when(tracking.lastCheckedAt) })}</span>
        )}
      </div>

      {tracking.status === "PENDING" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> {t("track.pending")}
        </p>
      )}
      {tracking.status === "NOT_FOUND" && <p className="text-sm text-warning">{t("track.notFound")}</p>}
      {tracking.error && <p className="text-sm text-warning">{t("track.error")}</p>}

      {s && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {s.disposed
            ? row(
                t("track.status"),
                [s.decidedOn && tf("track.disposedOn", { date: fmtDay(s.decidedOn, locale) }), s.disposalNature]
                  .filter(Boolean)
                  .join(" · ") || t("track.change.DISPOSED"),
              )
            : row(
                t("track.nextDate"),
                s.nextHearingDate ? [fmtDay(s.nextHearingDate, locale), s.nextPurpose].filter(Boolean).join(" · ") : "—",
              )}
          {row(t("track.courtNo"), s.courtNo)}
          {row(t("case.number"), s.caseNumber)}
          {row(t("case.court"), s.court)}
        </dl>
      )}

      {s && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("track.orders")}</h3>
          {s.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("track.noOrders")}</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {s.orders.slice(0, 6).map((o) => (
                <li key={`${o.date}-${o.url ?? o.title}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    {fmtDay(o.date, locale)}
                    {o.title ? ` · ${o.title}` : ""}
                  </span>
                  {o.url && <OrderLink url={o.url} label={t("track.open")} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {updates.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold">{t("track.changes")}</h3>
          <ul className="space-y-1 text-sm">
            {updates.slice(0, 5).map((u) => (
              <li key={u.id}>
                <span className="text-muted-foreground">{fmtDate(u.createdAt, locale, { day: "numeric", month: "short" })}: </span>
                {changeText(u.change, t, tf, locale)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t("track.check")}</p>

      {checking && tracking.status !== "PENDING" && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> {t("track.queued")}
        </p>
      )}
      <ErrorBox error={refresh.error ?? stop.error} />
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={refresh.isPending || checking || tracking.status === "PENDING"}
            onClick={() => refresh.mutate(undefined)}
          >
            <HugeiconsIcon icon={RefreshIcon} data-icon="inline-start" />
            {t("track.refresh")}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={stop.isPending}
            onClick={() => confirm(t("track.stopConfirm")) && stop.mutate(undefined)}
          >
            {t("track.stop")}
          </Button>
        </div>
      )}
    </Card>
  );
}

/**
 * The case on eCourts: start following it by CNR, or see its status, next date and orders as
 * last read. Hidden when tracking is not set up on the server and the case is not tracked.
 */
export function CourtTrackingSection({ caseId, cnrNumber, canEdit }: { caseId: string; cnrNumber: string | null; canEdit: boolean }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  // After "Check now": the reading time before asking, and when we asked (we stop waiting after 2 minutes).
  const [asked, setAsked] = useState<{ before: string | null; at: number } | null>(null);
  const q = useQuery({
    ...trackingQuery(caseId),
    refetchInterval: (query) => {
      const tr = query.state.data?.tracking;
      if (tr?.status === "PENDING") return 5_000;
      return asked && tr?.lastCheckedAt === asked.before && Date.now() - asked.at < 120_000 ? 5_000 : false;
    },
  });
  const checkedAt = q.data?.tracking?.lastCheckedAt ?? null;
  const checking = !!asked && checkedAt === asked.before && Date.now() - asked.at < 120_000;
  // A new reading may have changed the diary, the case details and Today: refresh them.
  const seen = useRef(checkedAt);
  useEffect(() => {
    if (seen.current === checkedAt) return;
    seen.current = checkedAt;
    setAsked(null);
    qc.invalidateQueries({ predicate: (x) => x.queryKey[0] !== "me" && x.queryKey[0] !== "tracking" });
  }, [checkedAt, qc]);
  if (!q.data) return null;
  const { available, tracking, updates } = q.data;
  if (!tracking && (!available || !canEdit)) return null;
  return (
    <Section title={t("track.title")}>
      {tracking ? (
        <Tracked
          caseId={caseId}
          tracking={tracking}
          updates={updates}
          canEdit={canEdit && available}
          checking={checking}
          onAsked={() => setAsked({ before: tracking.lastCheckedAt, at: Date.now() })}
        />
      ) : (
        <StartForm caseId={caseId} cnrNumber={cnrNumber} />
      )}
    </Section>
  );
}
