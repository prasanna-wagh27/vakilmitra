"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import type { CaseDetail, CaseKind, CaseStatus, Client } from "@/lib/types";
import { ErrorBox, Field, FormActions } from "./ui";

export const KINDS: CaseKind[] = ["CIVIL", "LAND_PROPERTY", "TITLE_SEARCH", "CRIMINAL", "FAMILY", "REVENUE", "OTHER"];
export const STATUSES: CaseStatus[] = ["ACTIVE", "DISPOSED", "ON_HOLD", "CLOSED"];

export function CaseForm({ initial, onSaved, onCancel }: { initial?: CaseDetail; onSaved: (id: string) => void; onCancel?: () => void }) {
  const { t } = useI18n();
  const clients = useApi<{ clients: Client[] }>("/clients");
  const [f, setF] = useState({
    title: initial?.title ?? "",
    kind: initial?.kind ?? "CIVIL",
    clientId: initial?.clientId ?? "",
    caseNumber: initial?.caseNumber ?? "",
    court: initial?.court ?? "",
    cnrNumber: initial?.cnrNumber ?? "",
    status: initial?.status ?? "ACTIVE",
    notes: initial?.notes ?? "",
  });
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f, clientId: f.clientId || null, caseNumber: f.caseNumber || null, court: f.court || null, cnrNumber: f.cnrNumber || null, notes: f.notes || null };
      const r = initial
        ? await api<{ case: { id: string } }>(`/cases/${initial.id}`, { method: "PATCH", body })
        : await api<{ case: { id: string } }>("/cases", { body });
      onSaved(r.case.id);
    } catch (err) {
      setError(err as Error);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label={t("case.title")}><input className="input" required value={f.title} onChange={set("title")} placeholder="जाधव वि. पाटील" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("case.kind")}>
          <select className="input" value={f.kind} onChange={set("kind")}>{KINDS.map((k) => <option key={k} value={k}>{t(`kind.${k}`)}</option>)}</select>
        </Field>
        <Field label={t("case.status")}>
          <select className="input" value={f.status} onChange={set("status")}>{STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}</select>
        </Field>
      </div>
      <Field label={t("case.client")}>
        <select className="input" value={f.clientId} onChange={set("clientId")}>
          <option value="">{t("case.noClient")}</option>
          {clients.data?.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("case.number")}><input className="input" value={f.caseNumber} onChange={set("caseNumber")} placeholder="RCS 123/2025" /></Field>
        <Field label={`${t("case.cnr")} (${t("common.optional")})`}><input className="input" value={f.cnrNumber} onChange={set("cnrNumber")} /></Field>
      </div>
      <Field label={t("case.court")}><input className="input" value={f.court} onChange={set("court")} /></Field>
      <Field label={t("common.notes")}><textarea className="input min-h-24" value={f.notes} onChange={set("notes")} /></Field>
      <ErrorBox error={error} />
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}
