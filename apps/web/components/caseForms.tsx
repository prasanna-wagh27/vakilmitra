"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { courtDateIso, istDate } from "@/lib/format";
import type { Hearing } from "@/lib/types";
import { Button, ErrorBox, Field, FormActions } from "./ui";

/** Shared submit/error/busy handling for the small forms on the case page. */
function useSubmit(fn: () => Promise<unknown>, onDone: () => void) {
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await fn();
      onDone();
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  };
  return { error, busy, submit };
}

function Form({ s, onCancel, children, submitLabel }: { s: ReturnType<typeof useSubmit>; onCancel: () => void; children: ReactNode; submitLabel?: string }) {
  return (
    <form onSubmit={s.submit} className="space-y-3">
      {children}
      <ErrorBox error={s.error} />
      <FormActions busy={s.busy} onCancel={onCancel} submitLabel={submitLabel} />
    </form>
  );
}

export function HearingForm({ caseId, onDone, onCancel }: { caseId: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ date: istDate(), purpose: "", nextStep: "" });
  const s = useSubmit(
    () => api(`/cases/${caseId}/hearings`, { body: { date: courtDateIso(f.date), purpose: f.purpose || null, nextStep: f.nextStep || null } }),
    onDone,
  );
  return (
    <Form s={s} onCancel={onCancel}>
      <Field label={t("common.date")}><input className="input" type="date" required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
      <Field label={t("case.purpose")}><input className="input" value={f.purpose} onChange={(e) => setF({ ...f, purpose: e.target.value })} /></Field>
      <Field label={t("case.nextStep")}><textarea className="input" value={f.nextStep} onChange={(e) => setF({ ...f, nextStep: e.target.value })} /></Field>
    </Form>
  );
}

/** Record what happened at a hearing and set the next date in one go. */
export function OutcomeForm({ hearing, onDone, onCancel }: { hearing: Hearing; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ outcome: hearing.outcome ?? "", nextStep: hearing.nextStep ?? "", nextDate: "", nextPurpose: "" });
  const s = useSubmit(
    () =>
      api(`/hearings/${hearing.id}`, {
        method: "PATCH",
        body: {
          outcome: f.outcome || null,
          nextStep: f.nextStep || null,
          ...(f.nextDate ? { next: { date: courtDateIso(f.nextDate), purpose: f.nextPurpose || null } } : {}),
        },
      }),
    onDone,
  );
  return (
    <Form s={s} onCancel={onCancel}>
      <Field label={t("case.outcome")}><textarea className="input" value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })} /></Field>
      <Field label={t("case.nextStep")}><textarea className="input" value={f.nextStep} onChange={(e) => setF({ ...f, nextStep: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("case.nextDate")}><input className="input" type="date" value={f.nextDate} onChange={(e) => setF({ ...f, nextDate: e.target.value })} /></Field>
        <Field label={t("case.nextPurpose")}><input className="input" value={f.nextPurpose} onChange={(e) => setF({ ...f, nextPurpose: e.target.value })} /></Field>
      </div>
    </Form>
  );
}

const ROLES = ["PETITIONER", "RESPONDENT", "PLAINTIFF", "DEFENDANT", "APPLICANT", "OPPONENT", "APPELLANT", "OTHER"] as const;

export function PartyForm({ caseId, onDone, onCancel }: { caseId: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: "", role: "PLAINTIFF", isOurClient: false, opposingCounsel: "" });
  const s = useSubmit(() => api(`/cases/${caseId}/parties`, { body: { ...f, opposingCounsel: f.opposingCounsel || null } }), onDone);
  return (
    <Form s={s} onCancel={onCancel}>
      <Field label={t("common.name")}><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label={t("case.role")}>
        <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
        </select>
      </Field>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" className="h-5 w-5" checked={f.isOurClient} onChange={(e) => setF({ ...f, isOurClient: e.target.checked })} />
        {t("case.ourClient")}
      </label>
      {!f.isOurClient && (
        <Field label={`${t("case.opposingCounsel")} (${t("common.optional")})`}><input className="input" value={f.opposingCounsel} onChange={(e) => setF({ ...f, opposingCounsel: e.target.value })} /></Field>
      )}
    </Form>
  );
}

export function PropertyForm({ caseId, onDone, onCancel }: { caseId: string; onDone: (id: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ surveyNo: "", gatNo: "", hissaNo: "", village: "", taluka: "", district: "" });
  const s = useSubmit(async () => {
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || null]));
    const r = await api<{ property: { id: string } }>(`/cases/${caseId}/properties`, { body });
    onDone(r.property.id);
  }, () => undefined);
  const input = (k: keyof typeof f, label: string) => (
    <Field label={label}><input className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>
  );
  return (
    <Form s={s} onCancel={onCancel}>
      <div className="grid grid-cols-3 gap-3">
        {input("surveyNo", t("land.survey"))}
        {input("gatNo", t("land.gat"))}
        {input("hissaNo", t("land.hissa"))}
      </div>
      {input("village", t("land.village"))}
      <div className="grid grid-cols-2 gap-3">
        {input("taluka", t("land.taluka"))}
        {input("district", t("land.district"))}
      </div>
    </Form>
  );
}

export function FeeAgreementForm({ clientId, caseId, onDone, onCancel }: { clientId: string; caseId?: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ description: "", total: "" });
  const [inst, setInst] = useState<{ dueDate: string; amount: string }[]>([]);
  const s = useSubmit(
    () =>
      api("/fees/agreements", {
        body: {
          clientId,
          caseId: caseId ?? null,
          description: f.description,
          totalRupees: Number(f.total),
          installments: inst.filter((i) => i.dueDate && Number(i.amount) > 0).map((i) => ({ dueDate: i.dueDate, amountRupees: Number(i.amount) })),
        },
      }),
    onDone,
  );
  return (
    <Form s={s} onCancel={onCancel}>
      <Field label={t("fees.description")}><input className="input" required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      <Field label={t("fees.amount")}><input className="input" required type="number" inputMode="decimal" min="1" step="0.01" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></Field>
      <div>
        <p className="mb-1 text-sm font-medium">{t("fees.installments")} ({t("common.optional")})</p>
        {inst.map((i, n) => (
          <div key={n} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <input className="input" type="date" aria-label={t("common.date")} value={i.dueDate} onChange={(e) => setInst(inst.map((x, k) => (k === n ? { ...x, dueDate: e.target.value } : x)))} />
            <input className="input" type="number" inputMode="decimal" aria-label={t("fees.amount")} placeholder="₹" value={i.amount} onChange={(e) => setInst(inst.map((x, k) => (k === n ? { ...x, amount: e.target.value } : x)))} />
            <Button type="button" variant="ghost" aria-label={t("common.delete")} onClick={() => setInst(inst.filter((_, k) => k !== n))}>✕</Button>
          </div>
        ))}
        <Button type="button" variant="secondary" onClick={() => setInst([...inst, { dueDate: "", amount: "" }])}>+ {t("fees.addInstallment")}</Button>
      </div>
    </Form>
  );
}

export function PaymentForm({ agreementId, onDone, onCancel }: { agreementId: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ amount: "", paidOn: istDate(), mode: "upi", reference: "" });
  const s = useSubmit(
    () => api(`/fees/agreements/${agreementId}/payments`, { body: { amountRupees: Number(f.amount), paidOn: f.paidOn, mode: f.mode, reference: f.reference || undefined } }),
    onDone,
  );
  return (
    <Form s={s} onCancel={onCancel}>
      <Field label={t("fees.amount")}><input className="input" required type="number" inputMode="decimal" min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.date")}><input className="input" type="date" required value={f.paidOn} onChange={(e) => setF({ ...f, paidOn: e.target.value })} /></Field>
        <Field label={t("fees.mode")}>
          <select className="input" value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
            {(["cash", "upi", "cheque", "bank"] as const).map((m) => <option key={m} value={m}>{t(`fees.mode.${m}`)}</option>)}
          </select>
        </Field>
      </div>
      <Field label={`${t("fees.reference")} (${t("common.optional")})`}><input className="input" value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></Field>
    </Form>
  );
}

export function ShareForm({ caseId, onDone, onCancel }: { caseId: string; onDone: () => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ email: "", role: "VIEWER" });
  const s = useSubmit(() => api(`/cases/${caseId}/grants`, { body: f }), onDone);
  return (
    <Form s={s} onCancel={onCancel} submitLabel={t("case.share")}>
      <p className="muted text-sm">{t("case.shareHint")}</p>
      <Field label={t("common.email")}><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label={t("case.access")}>
        <select className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          <option value="VIEWER">{t("case.viewer")}</option>
          <option value="EDITOR">{t("case.editor")}</option>
        </select>
      </Field>
    </Form>
  );
}
