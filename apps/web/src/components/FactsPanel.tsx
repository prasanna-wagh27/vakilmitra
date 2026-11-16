import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  type DocumentDetail,
  type Extraction,
  FACT_FIELDS,
  type Fact,
  type FactField,
  factValueProblem,
  MUTATION_TYPES,
  RECORD_KINDS,
} from "@vakilmitra/shared";
import { Check, FileSearch, Pencil, Plus, ScanSearch, Trash2, TriangleAlert, Undo2 } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { caseQuery, factsQuery, pageImageUrl, useApiMutation } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { ErrorBox, Field, Section } from "./common";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Input, NativeSelect } from "./ui/input";

/** Below this, a fact is marked for a careful look. */
const UNSURE = 0.8;
const CHOICES: Partial<Record<FactField, readonly string[]>> = {
  land_class: ["Class-I", "Class-II"],
  mutation_type: MUTATION_TYPES,
  section_155: ["true", "false"],
};

/** The fact's source: its crop cut out of the page image, with a little margin. */
function SourceCrop({ documentId, page, crop }: { documentId: string; page: DocumentDetail["pages"][number]; crop: NonNullable<Fact["crop"]> }) {
  const m = 0.01;
  const x = Math.max(0, crop.x - m);
  const y = Math.max(0, crop.y - m);
  const w = Math.min(1 - x, crop.w + 2 * m);
  const h = Math.min(1 - y, crop.h + 2 * m);
  const W = page.width ?? 1000;
  const H = page.height ?? 1400;
  return (
    <a
      href={`#page-${page.pageNo}`}
      className="relative block max-h-24 overflow-hidden rounded-xl border bg-muted"
      style={{ aspectRatio: `${w * W} / ${h * H}` }}
    >
      <img
        src={pageImageUrl(documentId, page.id)}
        alt=""
        loading="lazy"
        className="absolute max-w-none"
        style={{ width: `${100 / w}%`, left: `${(-x / w) * 100}%`, top: `${(-y / h) * 100}%` }}
      />
    </a>
  );
}

function useFieldText() {
  const { t, locale } = useI18n();
  return (field: FactField, value: string) => {
    if (field === "area" && /^\d+$/.test(value)) {
      const sqm = Number(value);
      const n = (x: number, d = 0) => x.toLocaleString(locale === "mr" ? "mr-IN" : "en-IN", { maximumFractionDigits: d });
      return `${n(sqm)} ${t("fact.sqm")} (${n(sqm / 10_000, 4)} ${t("fact.ha")})`;
    }
    if (field === "date" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return fmtDate(value, locale);
    if (field === "mutation_type") return t(`sub.${value}` as never) || value;
    if (field === "section_155") return value === "true" ? t("common.yes") : t("common.no");
    return value;
  };
}

function ValueInput({ field, value, onChange, id }: { field: FactField; value: string; onChange: (v: string) => void; id: string }) {
  const { t } = useI18n();
  const choices = CHOICES[field];
  if (choices)
    return (
      <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="" />
        {choices.map((c) => (
          <option key={c} value={c}>
            {field === "mutation_type" ? t(`sub.${c}` as never) : field === "section_155" ? (c === "true" ? t("common.yes") : t("common.no")) : c}
          </option>
        ))}
      </NativeSelect>
    );
  return (
    <Input
      id={id}
      type={field === "date" ? "date" : "text"}
      inputMode={field === "area" ? "numeric" : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function FactRow({ fact, doc, canEdit }: { fact: Fact; doc: DocumentDetail; canEdit: boolean }) {
  const { t, tf } = useI18n();
  const show = useFieldText();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fact.value);
  const patch = useApiMutation((body: { value?: string; reviewed?: boolean }) => api(`/facts/${fact.id}`, { method: "PATCH", body }), {
    onSuccess: () => setEditing(false),
  });
  const remove = useApiMutation(() => api(`/facts/${fact.id}`, { method: "DELETE" }));
  const page = doc.pages.find((p) => p.id === fact.pageId);
  const unsure = !fact.reviewed && fact.confidence < UNSURE;
  const problem = editing ? factValueProblem(fact.field, draft) : null;

  return (
    <li className={cn("row-card grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)]", fact.reviewed && "bg-success-soft/30", unsure && "border-warning/60")}>
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t(`field.${fact.field}`)}</p>
        {editing ? (
          <form
            className="mt-1.5 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!problem && draft.trim()) patch.mutate({ value: draft.trim() });
            }}
          >
            <ValueInput id={`fact-${fact.id}`} field={fact.field} value={draft} onChange={setDraft} />
            {problem && <p className="text-sm text-destructive">{t(problem)}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!!problem || !draft.trim() || patch.isPending}>
                {t("common.save")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => (setEditing(false), setDraft(fact.value))}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <p className="mt-0.5 text-lg font-medium break-words">{show(fact.field, fact.value)}</p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {fact.reviewed ? (
            <Badge tone="green">
              <Check /> {t("fact.checked")}
            </Badge>
          ) : unsure ? (
            <Badge tone="amber">
              <TriangleAlert /> {t("fact.unsure")}
            </Badge>
          ) : null}
          {!fact.reviewed && <span className="text-muted-foreground tabular-nums">{Math.round(fact.confidence * 100)}%</span>}
          {fact.originalValue && <span className="text-muted-foreground">{tf("fact.readAs", { v: show(fact.field, fact.originalValue) })}</span>}
          {!fact.pageId && !fact.crop && fact.confidence === 1 && <span className="text-muted-foreground">{t("fact.manual")}</span>}
        </div>
        <ErrorBox error={patch.error ?? remove.error} />
        {canEdit && !editing && (
          <div className="mt-3 flex flex-wrap gap-2">
            {fact.reviewed ? (
              <Button size="sm" variant="ghost" onClick={() => patch.mutate({ reviewed: false })} disabled={patch.isPending}>
                <Undo2 /> {t("fact.uncheck")}
              </Button>
            ) : (
              <Button size="sm" onClick={() => patch.mutate({ reviewed: true })} disabled={patch.isPending}>
                <Check /> {t("fact.confirm")}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> {t("common.edit")}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label={t("common.delete")}
              onClick={() => confirm(t("common.confirmDelete")) && remove.mutate(undefined)}
              disabled={remove.isPending}
            >
              <Trash2 />
            </Button>
          </div>
        )}
      </div>
      <div className="min-w-0">
        {page && fact.crop ? (
          <SourceCrop documentId={doc.id} page={page} crop={fact.crop} />
        ) : page ? (
          <a href={`#page-${page.pageNo}`} className="text-sm text-accent underline underline-offset-4">
            {t("fact.wholePage")}
          </a>
        ) : null}
      </div>
    </li>
  );
}

function AddFact({ documentId }: { documentId: string }) {
  const { t } = useI18n();
  const [field, setField] = useState<FactField>("gat_no");
  const [value, setValue] = useState("");
  const add = useApiMutation(() => api(`/documents/${documentId}/facts`, { method: "POST", body: { field, value: value.trim() } }), {
    onSuccess: () => setValue(""),
  });
  const problem = value ? factValueProblem(field, value) : null;
  return (
    <details className="mt-4 rounded-2xl border border-dashed p-4">
      <summary className="cursor-pointer font-medium">
        <Plus className="mr-1 inline size-4" aria-hidden /> {t("fact.add")}
      </summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim() && !problem) add.mutate(undefined);
        }}
      >
        <Field id="new-fact-field" label={t("fact.field")}>
          <NativeSelect id="new-fact-field" value={field} onChange={(e) => (setField(e.target.value as FactField), setValue(""))}>
            {FACT_FIELDS.map((f) => (
              <option key={f} value={f}>
                {t(`field.${f}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="new-fact-value" label={t("fact.value")} error={problem ? { type: "validate", message: t(problem) } : undefined}>
          <ValueInput id="new-fact-value" field={field} value={value} onChange={setValue} />
        </Field>
        <Button type="submit" disabled={!value.trim() || !!problem || add.isPending}>
          {t("common.save")}
        </Button>
      </form>
      <ErrorBox error={add.error} />
    </details>
  );
}

interface AddResult {
  event: { id: string };
  filled: Record<string, string>;
  mismatches: { field: FactField; property: string; document: string }[];
  flags: { resolved: boolean }[];
}

function AddToChain({ doc, caseId, extraction }: { doc: DocumentDetail; caseId: string; extraction: Extraction }) {
  const { t, tf, locale } = useI18n();
  const caseData = useQuery(caseQuery(caseId));
  const properties = caseData.data?.case.properties ?? [];
  const factDate = extraction.facts.find((f) => f.field === "date")?.value;
  const [propertyId, setPropertyId] = useState(doc.propertyId ?? properties[0]?.id ?? "new");
  const [date, setDate] = useState(factDate ?? (doc.year ? `${doc.year}-01-01` : ""));
  const [result, setResult] = useState<(AddResult & { propertyId: string }) | null>(null);
  const add = useApiMutation(
    async () => {
      let pid = propertyId;
      if (pid === "new") {
        pid = (await api<{ property: { id: string } }>(`/cases/${caseId}/properties`, { method: "POST", body: {} })).property.id;
      }
      const r = await api<AddResult>(`/cases/${caseId}/properties/${pid}/events/from-document?lang=${locale}`, {
        method: "POST",
        body: { documentId: doc.id, ...(date ? { date } : {}) },
      });
      return { ...r, propertyId: pid };
    },
    { onSuccess: setResult },
  );
  const pending = extraction.facts.filter((f) => !f.reviewed).length;
  const done = result ?? (extraction.events[0] ? { propertyId: extraction.events[0].propertyId } : null);
  const propName = (p: (typeof properties)[number]) =>
    [p.gatNo && `${t("land.gat")} ${p.gatNo}`, p.surveyNo && `${t("land.survey")} ${p.surveyNo}`, p.village].filter(Boolean).join(", ") ||
    t("land.property");

  if (done)
    return (
      <div className="panel mt-6 p-5">
        <p className="flex items-center gap-2 font-medium">
          <Check className="size-5 text-success" aria-hidden /> {t("fact.added")}
        </p>
        {result && (
          <ul className="mt-2 space-y-1 text-sm">
            {Object.keys(result.filled).length > 0 && (
              <li className="text-muted-foreground">
                {tf("fact.filled", { fields: Object.keys(result.filled).map((k) => t(`field.${k.replace(/No$/, "_no")}` as never)).join(", ") })}
              </li>
            )}
            {result.mismatches.map((m) => (
              <li key={m.field} className="flex items-start gap-1.5 text-warning">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {tf("fact.mismatch", { field: t(`field.${m.field}`), property: m.property, document: m.document })}
              </li>
            ))}
            <li>{tf("fact.flags", { n: String(result.flags.filter((f) => !f.resolved).length) })}</li>
          </ul>
        )}
        <Button asChild size="sm" className="mt-3">
          <Link to="/cases/$caseId/properties/$propertyId" params={{ caseId, propertyId: done.propertyId }}>
            {t("fact.openProperty")}
          </Link>
        </Button>
      </div>
    );

  return (
    <div className="panel mt-6 p-5">
      <h3 className="font-display text-xl">{t("fact.toChain")}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{t("fact.toChainHint")}</p>
      {pending > 0 ? (
        <p className="mt-3 rounded-2xl bg-warning-soft p-3 text-sm text-warning">{tf("fact.needReview", { n: String(pending) })}</p>
      ) : (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(undefined);
          }}
        >
          <Field id="chain-property" label={t("fact.property")}>
            <NativeSelect id="chain-property" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {propName(p)}
                </option>
              ))}
              <option value="new">{t("fact.newProperty")}</option>
            </NativeSelect>
          </Field>
          <Field id="chain-date" label={t("fact.recordDate")} hint={!factDate ? t("fact.recordDateHint") : undefined}>
            <Input id="chain-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required={!factDate} />
          </Field>
          <div className="sm:col-span-2">
            <ErrorBox error={add.error} />
            <Button type="submit" disabled={add.isPending || (!date && !factDate)}>
              {t("fact.addToChain")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** Land-file analyzer on a document: read its details, check each against its source, add it to a property. */
export function FactsPanel({ doc, caseId, canEdit }: { doc: DocumentDetail; caseId: string; canEdit: boolean }) {
  const { t, tf } = useI18n();
  const facts = useQuery(factsQuery(doc.id));
  const extract = useApiMutation(() => api(`/documents/${doc.id}/extract`, { method: "POST" }));
  const ex = facts.data;
  const isRecord = (RECORD_KINDS as readonly string[]).includes(doc.type);
  const ocrBusy = doc.ocrStatus === "PENDING" || doc.ocrStatus === "PROCESSING";
  // Land records, and documents not yet typed (the reader can tell a 7/12, Ferfar or Index-II apart).
  if (!ex || !doc.pages.length || (!isRecord && doc.type !== "OTHER" && !ex.facts.length)) return null;

  const reviewed = ex.facts.filter((f) => f.reviewed).length;
  const ordered = [...ex.facts].sort((a, b) => FACT_FIELDS.indexOf(a.field) - FACT_FIELDS.indexOf(b.field) || a.position - b.position);
  const tried = extract.isSuccess || ex.facts.length > 0;

  return (
    <Section
      title={t("fact.title")}
      action={
        canEdit && (
          <Button size="sm" variant={ex.facts.length ? "outline" : "default"} onClick={() => extract.mutate(undefined)} disabled={ocrBusy || extract.isPending}>
            {ex.facts.length ? <ScanSearch /> : <FileSearch />} {ex.facts.length ? t("fact.readAgain") : t("fact.read")}
          </Button>
        )
      }
    >
      <p className="mb-3 max-w-prose text-sm text-muted-foreground">
        {t("fact.hint")} {ex.facts.length > 0 && t("fact.readAgainHint")}
      </p>
      <ErrorBox error={extract.error ?? facts.error} />
      {ocrBusy && <p className="mb-3 rounded-2xl bg-muted p-3 text-sm">{t("fact.waitOcr")}</p>}
      {tried && !ex.kind && <p className="mb-3 rounded-2xl bg-warning-soft p-3 text-sm text-warning">{t("fact.unknownKind")}</p>}
      {tried && ex.kind && ex.facts.length === 0 && <p className="mb-3 text-sm text-muted-foreground">{t("fact.none")}</p>}

      {ex.facts.length > 0 && (
        <>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(reviewed / ex.facts.length) * 100}%` }} />
            </div>
            <span className="text-sm text-muted-foreground tabular-nums">
              {tf("fact.progress", { n: String(reviewed), total: String(ex.facts.length) })}
            </span>
          </div>
          <ul className="space-y-2">
            {ordered.map((f) => (
              <FactRow key={`${f.id}-${f.value}-${f.reviewed}`} fact={f} doc={doc} canEdit={canEdit} />
            ))}
          </ul>
        </>
      )}
      {canEdit && tried && ex.kind && <AddFact documentId={doc.id} />}
      {canEdit && ex.kind && ex.facts.length > 0 && <AddToChain doc={doc} caseId={caseId} extraction={ex} />}
    </Section>
  );
}
