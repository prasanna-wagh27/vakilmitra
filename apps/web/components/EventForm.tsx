"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { lines } from "@/lib/format";
import type { OwnershipEvent } from "@/lib/types";
import { ErrorBox, Field, FormActions } from "./ui";

type Kind = OwnershipEvent["kind"];
const SUBTYPES: Record<Kind, string[]> = {
  RECORD_SNAPSHOT: [],
  DEED: ["SALE", "GIFT", "PARTITION", "MORTGAGE", "WILL", "RELEASE", "EXCHANGE", "OTHER"],
  MUTATION: ["SALE", "HEIRSHIP", "GIFT", "PARTITION", "MORTGAGE", "RELEASE", "EXCHANGE", "CORRECTION", "ACQUISITION", "OTHER"],
};

/** Manual entry of one land record. Later releases fill these from scanned pages, with source crops. */
export function EventForm({ base, onDone, onCancel }: { base: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>("RECORD_SNAPSHOT");
  const [f, setF] = useState({
    date: "", subtype: "SALE", ferfarNo: "", deedRegNo: "", refDeedRegNo: "", from: "", to: "", owners: "",
    areaSqm: "", landClass: "", otherRights: "", section155: false, notes: "",
  });
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const snapshot = kind === "RECORD_SNAPSHOT";
    try {
      await api(`${base}/events`, {
        body: {
          kind,
          date: f.date,
          subtype: snapshot ? null : f.subtype,
          ferfarNo: kind === "MUTATION" ? f.ferfarNo || null : null,
          deedRegNo: kind === "DEED" ? f.deedRegNo || null : null,
          refDeedRegNo: kind === "MUTATION" ? f.refDeedRegNo || null : null,
          fromParties: snapshot ? [] : lines(f.from),
          toParties: snapshot ? [] : lines(f.to),
          owners: snapshot ? lines(f.owners) : [],
          areaSqm: snapshot && f.areaSqm ? Number(f.areaSqm) : null,
          landClass: snapshot ? f.landClass || null : null,
          otherRights: snapshot ? lines(f.otherRights) : [],
          section155: kind === "MUTATION" && f.section155,
          notes: f.notes || null,
        },
      });
      onDone();
    } catch (err) {
      setError(err as Error);
      setBusy(false);
    }
  }

  const hint = t("land.onePerLine");
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-xl border hairline p-1" role="radiogroup">
        {(Object.keys(SUBTYPES) as Kind[]).map((k) => (
          <button type="button" key={k} role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-lg px-1 text-sm ${kind === k ? "bg-brand-600 text-white" : ""}`}>
            {t(`land.kind.${k}`)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.date")}><input className="input" type="date" required value={f.date} onChange={set("date")} /></Field>
        {kind !== "RECORD_SNAPSHOT" && (
          <Field label={t("land.subtype")}>
            <select className="input" value={f.subtype} onChange={set("subtype")}>
              {SUBTYPES[kind].map((s) => <option key={s} value={s}>{t(`sub.${s}` as never)}</option>)}
            </select>
          </Field>
        )}
      </div>

      {kind === "RECORD_SNAPSHOT" && (
        <>
          <Field label={t("land.owners")} hint={hint}><textarea className="input" required value={f.owners} onChange={set("owners")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("land.area")}><input className="input" type="number" inputMode="decimal" min="0" step="any" value={f.areaSqm} onChange={set("areaSqm")} /></Field>
            <Field label={t("land.landClass")}><input className="input" list="land-classes" value={f.landClass} onChange={set("landClass")} /></Field>
          </div>
          <datalist id="land-classes"><option value="Class-I" /><option value="Class-II" /><option value="सरकारी" /></datalist>
          <Field label={t("land.otherRights")} hint={hint}><textarea className="input" value={f.otherRights} onChange={set("otherRights")} /></Field>
        </>
      )}

      {kind === "DEED" && <Field label={t("land.deedRegNo")}><input className="input" value={f.deedRegNo} onChange={set("deedRegNo")} placeholder="1234/2001" /></Field>}
      {kind === "MUTATION" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("land.ferfarNo")}><input className="input" value={f.ferfarNo} onChange={set("ferfarNo")} /></Field>
          <Field label={t("land.refDeed")}><input className="input" value={f.refDeedRegNo} onChange={set("refDeedRegNo")} /></Field>
        </div>
      )}
      {kind !== "RECORD_SNAPSHOT" && (
        <>
          <Field label={t("land.from")} hint={hint}><textarea className="input" value={f.from} onChange={set("from")} /></Field>
          <Field label={t("land.to")} hint={hint}><textarea className="input" value={f.to} onChange={set("to")} /></Field>
        </>
      )}
      {kind === "MUTATION" && (
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" className="h-5 w-5" checked={f.section155} onChange={(e) => setF({ ...f, section155: e.target.checked })} />
          {t("land.section155")}
        </label>
      )}
      <Field label={t("common.notes")}><input className="input" value={f.notes} onChange={set("notes")} /></Field>
      <ErrorBox error={error} />
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}
