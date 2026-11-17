import { zodResolver } from "@hookform/resolvers/zod";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import {
  CASE_KINDS,
  CASE_STATUSES,
  type CaseDetail,
  type Client,
  courtDateIso,
  DEED_SUBTYPES,
  type Hearing,
  istDate,
  MUTATION_SUBTYPES,
  PARTY_ROLES,
  PAYMENT_MODES,
} from "@vakilmitra/shared";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/lib/api";
import { lines, orNull } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { clientsQuery, useApiMutation } from "@/lib/queries";
import { ErrorBox, Field, FormActions } from "./common";
import { Button } from "./ui/button";
import { Checkbox, Input, NativeSelect, Textarea } from "./ui/input";

type Done = { onDone: () => void; onCancel: () => void };
const req = z.string().trim().min(1);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optDay = z.union([day, z.literal("")]);
const money = z.string().refine((s) => Number(s) > 0);

// ---------- Case ----------

const caseForm = z.object({
  title: req,
  kind: z.enum(CASE_KINDS),
  status: z.enum(CASE_STATUSES),
  clientId: z.string(),
  caseNumber: z.string(),
  court: z.string(),
  cnrNumber: z.string(),
  notes: z.string(),
});

export function CaseForm({ initial, onSaved, onCancel }: { initial?: CaseDetail; onSaved: (id: string) => void; onCancel?: () => void }) {
  const { t } = useI18n();
  const clients = useQuery(clientsQuery(""));
  const f = useForm<z.infer<typeof caseForm>>({
    resolver: zodResolver(caseForm),
    defaultValues: {
      title: initial?.title ?? "",
      kind: initial?.kind ?? "CIVIL",
      status: initial?.status ?? "ACTIVE",
      clientId: initial?.clientId ?? "",
      caseNumber: initial?.caseNumber ?? "",
      court: initial?.court ?? "",
      cnrNumber: initial?.cnrNumber ?? "",
      notes: initial?.notes ?? "",
    },
  });
  const m = useApiMutation(
    (v: z.infer<typeof caseForm>) => {
      const body = {
        ...v,
        clientId: v.clientId || null,
        caseNumber: orNull(v.caseNumber),
        court: orNull(v.court),
        cnrNumber: orNull(v.cnrNumber),
        notes: orNull(v.notes),
      };
      return initial
        ? api<{ case: { id: string } }>(`/cases/${initial.id}`, { method: "PATCH", body })
        : api<{ case: { id: string } }>("/cases", { body });
    },
    { onSuccess: (r) => onSaved(r.case.id) },
  );
  const e = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="space-y-3" noValidate>
      <Field id="title" label={t("case.title")} error={e.title}>
        <Input id="title" placeholder="जाधव वि. पाटील" aria-invalid={!!e.title} {...f.register("title")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="kind" label={t("case.kind")}>
          <NativeSelect id="kind" {...f.register("kind")}>
            {CASE_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field id="status" label={t("case.status")}>
          <NativeSelect id="status" {...f.register("status")}>
            {CASE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`status.${s}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field id="clientId" label={t("case.client")}>
        <NativeSelect id="clientId" {...f.register("clientId")}>
          <option value="">{t("case.noClient")}</option>
          {clients.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="caseNumber" label={t("case.number")}>
          <Input id="caseNumber" placeholder="RCS 123/2025" {...f.register("caseNumber")} />
        </Field>
        <Field id="cnrNumber" label={`${t("case.cnr")} (${t("common.optional")})`}>
          <Input id="cnrNumber" {...f.register("cnrNumber")} />
        </Field>
      </div>
      <Field id="court" label={t("case.court")}>
        <Input id="court" {...f.register("court")} />
      </Field>
      <Field id="notes" label={t("common.notes")}>
        <Textarea id="notes" className="min-h-24" {...f.register("notes")} />
      </Field>
      <ErrorBox error={m.error} />
      <FormActions busy={m.isPending} onCancel={onCancel} />
    </form>
  );
}

// ---------- Client ----------

const clientForm = z.object({
  name: req,
  phone: z.string(),
  email: z.union([z.email(), z.literal("")]),
  address: z.string(),
  whatsappOptIn: z.boolean(),
  notes: z.string(),
});

export function ClientForm({ initial, onSaved, onCancel }: { initial?: Client; onSaved: (id: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const f = useForm<z.infer<typeof clientForm>>({
    resolver: zodResolver(clientForm),
    defaultValues: {
      name: initial?.name ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      address: initial?.address ?? "",
      whatsappOptIn: initial?.whatsappOptIn ?? false,
      notes: initial?.notes ?? "",
    },
  });
  const m = useApiMutation(
    (v: z.infer<typeof clientForm>) => {
      const body = { ...v, phone: orNull(v.phone), email: orNull(v.email), address: orNull(v.address), notes: orNull(v.notes) };
      return initial
        ? api<{ client: Client }>(`/clients/${initial.id}`, { method: "PATCH", body })
        : api<{ client: Client }>("/clients", { body });
    },
    { onSuccess: (r) => onSaved(r.client.id) },
  );
  const e = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="space-y-3" noValidate>
      <Field id="name" label={t("common.name")} error={e.name}>
        <Input id="name" aria-invalid={!!e.name} {...f.register("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="phone" label={t("common.phone")}>
          <Input id="phone" type="tel" inputMode="tel" {...f.register("phone")} />
        </Field>
        <Field id="email" label={t("common.email")} error={e.email}>
          <Input id="email" type="email" aria-invalid={!!e.email} {...f.register("email")} />
        </Field>
      </div>
      <Field id="address" label={t("common.address")}>
        <Textarea id="address" {...f.register("address")} />
      </Field>
      <label className="flex min-h-11 items-center gap-2">
        <Checkbox {...f.register("whatsappOptIn")} />
        {t("client.whatsapp")}
      </label>
      <Field id="notes" label={t("common.notes")}>
        <Textarea id="notes" {...f.register("notes")} />
      </Field>
      <ErrorBox error={m.error} />
      <FormActions busy={m.isPending} onCancel={onCancel} />
    </form>
  );
}

// ---------- Hearings ----------

const hearingForm = z.object({ date: day, purpose: z.string(), nextStep: z.string() });

export function HearingForm({ caseId, onDone, onCancel }: { caseId: string } & Done) {
  const { t } = useI18n();
  const f = useForm<z.infer<typeof hearingForm>>({
    resolver: zodResolver(hearingForm),
    defaultValues: { date: istDate(), purpose: "", nextStep: "" },
  });
  const m = useApiMutation(
    (v: z.infer<typeof hearingForm>) =>
      api(`/cases/${caseId}/hearings`, { body: { date: courtDateIso(v.date), purpose: orNull(v.purpose), nextStep: orNull(v.nextStep) } }),
    { onSuccess: onDone },
  );
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="space-y-3" noValidate>
      <Field id="date" label={t("common.date")} error={f.formState.errors.date}>
        <Input id="date" type="date" {...f.register("date")} />
      </Field>
      <Field id="purpose" label={t("case.purpose")}>
        <Input id="purpose" {...f.register("purpose")} />
      </Field>
      <Field id="nextStep" label={t("case.nextStep")}>
        <Textarea id="nextStep" {...f.register("nextStep")} />
      </Field>
      <ErrorBox error={m.error} />
      <FormActions busy={m.isPending} onCancel={onCancel} />
    </form>
  );
}

const outcomeForm = z.object({ outcome: z.string(), nextStep: z.string(), nextDate: optDay, nextPurpose: z.string() });

/** Record what happened at a hearing and set the next date in one go. */
export function OutcomeForm({ hearing, onDone, onCancel }: { hearing: Hearing } & Done) {
  const { t } = useI18n();
  const f = useForm<z.infer<typeof outcomeForm>>({
    resolver: zodResolver(outcomeForm),
    defaultValues: { outcome: hearing.outcome ?? "", nextStep: hearing.nextStep ?? "", nextDate: "", nextPurpose: "" },
  });
  const m = useApiMutation(
    (v: z.infer<typeof outcomeForm>) =>
      api(`/hearings/${hearing.id}`, {
        method: "PATCH",
        body: {
          outcome: orNull(v.outcome),
          nextStep: orNull(v.nextStep),
          ...(v.nextDate ? { next: { date: courtDateIso(v.nextDate), purpose: orNull(v.nextPurpose) } } : {}),
        },
      }),
    { onSuccess: onDone },
  );
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="space-y-3" noValidate>
      <Field id="outcome" label={t("case.outcome")}>
        <Textarea id="outcome" {...f.register("outcome")} />
      </Field>
      <Field id="nextStep" label={t("case.nextStep")}>
        <Textarea id="nextStep" {...f.register("nextStep")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="nextDate" label={t("case.nextDate")}>
          <Input id="nextDate" type="date" {...f.register("nextDate")} />
        </Field>
        <Field id="nextPurpose" label={t("case.nextPurpose")}>
          <Input id="nextPurpose" {...f.register("nextPurpose")} />
        </Field>
      </div>
      <ErrorBox error={m.error} />
      <FormActions busy={m.isPending} onCancel={onCancel} />
    </form>
  );
}

// ---------- Parties, properties, sharing ----------

const partyForm = z.object({ name: req, role: z.enum(PARTY_ROLES), isOurClient: z.boolean(), opposingCounsel: z.string() });

export function PartyForm({ caseId, onDone, onCancel }: { caseId: string } & Done) {
  const { t } = useI18n();
  const f = useForm<z.infer<typeof partyForm>>({
    resolver: zodResolver(partyForm),
    defaultValues: { name: "", role: "PLAINTIFF", isOurClient: false, opposingCounsel: "" },
  });
  const ours = f.watch("isOurClient");
  const m = useApiMutation(
    (v: z.infer<typeof partyForm>) =>
      api(`/cases/${caseId}/parties`, { body: { ...v, opposingCounsel: v.isOurClient ? null : orNull(v.opposingCounsel) } }),
    { onSuccess: onDone },
  );
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="space-y-3" noValidate>
      <Field id="name" label={t("common.name")} error={f.formState.errors.name}>
        <Input id="name" {...f.register("name")} />
      </Field>
      <Field id="role" label={t("case.role")}>
        <NativeSelect id="role" {...f.register("role")}>
          {PARTY_ROLES.map((r) => (
            <option key={r} value={r}>
              {t(`role.${r}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <label className="flex min-h-11 items-center gap-2">
        <Checkbox {...f.register("isOurClient")} />
        {t("case.ourClient")}
      </label>
      {!ours && (
        <Field id="opposingCounsel" label={`${t("case.opposingCounsel")} (${t("common.optional")})`}>
          <Input id="opposingCounsel" {...f.register("opposingCounsel")} />
        </Field>
      )}
      <ErrorBox error={m.error} />
      <FormActions busy={m.isPending} onCancel={onCancel} />
    </form>
  );
}

const propertyForm = z.object({
  surveyNo: z.string(),
  gatNo: z.string(),
  hissaNo: z.string(),
  village: z.string(),
  taluka: z.string(),
  district: z.string(),
});
type PropertyFields = z.infer<typeof propertyForm>;

export function PropertyForm({ caseId, onSaved, onCancel }: { caseId: string; onSaved: (id: string) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const f = useForm<PropertyFields>({
    resolver: zodResolver(propertyForm),
    defaultValues: { surveyNo: "", gatNo: "", hissaNo: "", village: "", taluka: "", district: "" },
  });
  const m = useApiMutation(
    (v: PropertyFields) =>
      api<{ property: { id: string } }>(`/cases/${caseId}/properties`, {
        body: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, orNull(x)])),
      }),
    { onSuccess: (r) => onSaved(r.property.id) },
  );
  const input = (k: keyof PropertyFields, label: MessageKey) => (
    <Field id={k} label={t(label)}>
      <Input id={k} {...f.register(k)} />
    </Field>
  );
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="space-y-3" noValidate>
      <div className="grid grid-cols-3 gap-3">
        {input("surveyNo", "land.survey")}
        {input("gatNo", "land.gat")}
        {input("hissaNo", "land.hissa")}
      </div>
      {input("village", "land.village")}
      <div className="grid grid-cols-2 gap-3">
        {input("taluka", "land.taluka")}
        {input("district", "land.district")}
      </div>
      <ErrorBox error={m.error} />
      <FormActions busy={m.isPending} onCancel={onCancel} />
    </form>
  );
}

const shareForm = z.object({ email: z.email(), role: z.enum(["VIEWER", "EDITOR"]) });

export function ShareForm({ caseId, onDone, onCancel }: { caseId: string } & Done) {
  const { t } = useI18n();
  const f = useForm<z.infer<typeof shareForm>>({ resolver: zodResolver(shareForm), defaultValues: { email: "", role: "VIEWER" } });
  const m = useApiMutation((v: z.infer<typeof shareForm>) => api(`/cases/${caseId}/grants`, { body: v }), { onSuccess: onDone });
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="space-y-3" noValidate>
      <p className="text-sm text-muted-foreground">{t("case.shareHint")}</p>
      <Field id="email" label={t("common.email")} error={f.formState.errors.email}>
        <Input id="email" type="email" {...f.register("email")} />
      </Field>
      <Field id="role" label={t("case.access")}>
        <NativeSelect id="role" {...f.register("role")}>
          <option value="VIEWER">{t("case.viewer")}</option>
          <option value="EDITOR">{t("case.editor")}</option>
        </NativeSelect>
      </Field>
      <ErrorBox error={m.error} />
      <FormActions busy={m.isPending} onCancel={onCancel} submitLabel={t("case.share")} />
    </form>
  );
}

// ---------- Fees ----------

const feeForm = z.object({
  description: req,
  total: money,
  installments: z.array(z.object({ dueDate: day, amount: money })),
});

export function FeeAgreementForm({ clientId, caseId, onDone, onCancel }: { clientId: string; caseId?: string } & Done) {
  const { t } = useI18n();
  const f = useForm<z.infer<typeof feeForm>>({
    resolver: zodResolver(feeForm),
    defaultValues: { description: "", total: "", installments: [] },
  });
  const inst = useFieldArray({ control: f.control, name: "installments" });
  const m = useApiMutation(
    (v: z.infer<typeof feeForm>) =>
      api("/fees/agreements", {
        body: {
          clientId,
          caseId: caseId ?? null,
          description: v.description,
          totalRupees: Number(v.total),
          installments: v.installments.map((i) => ({ dueDate: i.dueDate, amountRupees: Number(i.amount) })),
        },
      }),
    { onSuccess: onDone },
  );
  const e = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="space-y-3" noValidate>
      <Field id="description" label={t("fees.description")} error={e.description}>
        <Input id="description" {...f.register("description")} />
      </Field>
      <Field id="total" label={t("fees.amount")} error={e.total}>
        <Input id="total" type="number" inputMode="decimal" min="1" step="0.01" {...f.register("total")} />
      </Field>
      <div>
        <p className="mb-1 text-sm font-medium">
          {t("fees.installments")} ({t("common.optional")})
        </p>
        {inst.fields.map((row, n) => (
          <div key={row.id} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
            <Input
              type="date"
              aria-label={t("common.date")}
              aria-invalid={!!e.installments?.[n]?.dueDate}
              {...f.register(`installments.${n}.dueDate`)}
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="₹"
              aria-label={t("fees.amount")}
              aria-invalid={!!e.installments?.[n]?.amount}
              {...f.register(`installments.${n}.amount`)}
            />
            <Button type="button" variant="ghost" size="icon" aria-label={t("common.delete")} onClick={() => inst.remove(n)}>
              <HugeiconsIcon icon={Cancel01Icon} />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => inst.append({ dueDate: "", amount: "" })}>
          + {t("fees.addInstallment")}
        </Button>
      </div>
      <ErrorBox error={m.error} />
      <FormActions busy={m.isPending} onCancel={onCancel} />
    </form>
  );
}

const paymentForm = z.object({ amount: money, paidOn: day, mode: z.enum(PAYMENT_MODES), reference: z.string() });

export function PaymentForm({ agreementId, onDone, onCancel }: { agreementId: string } & Done) {
  const { t } = useI18n();
  const f = useForm<z.infer<typeof paymentForm>>({
    resolver: zodResolver(paymentForm),
    defaultValues: { amount: "", paidOn: istDate(), mode: "upi", reference: "" },
  });
  const m = useApiMutation(
    (v: z.infer<typeof paymentForm>) =>
      api(`/fees/agreements/${agreementId}/payments`, {
        body: { amountRupees: Number(v.amount), paidOn: v.paidOn, mode: v.mode, reference: v.reference.trim() || undefined },
      }),
    { onSuccess: onDone },
  );
  const e = f.formState.errors;
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="space-y-3" noValidate>
      <Field id="amount" label={t("fees.amount")} error={e.amount}>
        <Input id="amount" type="number" inputMode="decimal" min="0.01" step="0.01" {...f.register("amount")} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="paidOn" label={t("common.date")} error={e.paidOn}>
          <Input id="paidOn" type="date" {...f.register("paidOn")} />
        </Field>
        <Field id="mode" label={t("fees.mode")}>
          <NativeSelect id="mode" {...f.register("mode")}>
            {PAYMENT_MODES.map((p) => (
              <option key={p} value={p}>
                {t(`fees.mode.${p}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field id="reference" label={`${t("fees.reference")} (${t("common.optional")})`}>
        <Input id="reference" {...f.register("reference")} />
      </Field>
      <ErrorBox error={m.error} />
      <FormActions busy={m.isPending} onCancel={onCancel} />
    </form>
  );
}

// ---------- Land records (manual entry until the scanner milestone) ----------

type Kind = "RECORD_SNAPSHOT" | "DEED" | "MUTATION";
const SUBTYPES: Record<Kind, readonly string[]> = { RECORD_SNAPSHOT: [], DEED: DEED_SUBTYPES, MUTATION: MUTATION_SUBTYPES };

const eventForm = z.object({
  date: day,
  subtype: z.string(),
  ferfarNo: z.string(),
  deedRegNo: z.string(),
  refDeedRegNo: z.string(),
  from: z.string(),
  to: z.string(),
  owners: z.string(),
  areaSqm: z.string(),
  landClass: z.string(),
  otherRights: z.string(),
  section155: z.boolean(),
  notes: z.string(),
});

export function EventForm({ base, onDone, onCancel }: { base: string } & Done) {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>("RECORD_SNAPSHOT");
  const f = useForm<z.infer<typeof eventForm>>({
    resolver: zodResolver(eventForm),
    defaultValues: {
      date: "",
      subtype: "SALE",
      ferfarNo: "",
      deedRegNo: "",
      refDeedRegNo: "",
      from: "",
      to: "",
      owners: "",
      areaSqm: "",
      landClass: "",
      otherRights: "",
      section155: false,
      notes: "",
    },
  });
  const m = useApiMutation(
    (v: z.infer<typeof eventForm>) => {
      const snap = kind === "RECORD_SNAPSHOT";
      return api(`${base}/events`, {
        body: {
          kind,
          date: v.date,
          subtype: snap ? null : v.subtype,
          ferfarNo: kind === "MUTATION" ? orNull(v.ferfarNo) : null,
          deedRegNo: kind === "DEED" ? orNull(v.deedRegNo) : null,
          refDeedRegNo: kind === "MUTATION" ? orNull(v.refDeedRegNo) : null,
          fromParties: snap ? [] : lines(v.from),
          toParties: snap ? [] : lines(v.to),
          owners: snap ? lines(v.owners) : [],
          areaSqm: snap && v.areaSqm ? Number(v.areaSqm) : null,
          landClass: snap ? orNull(v.landClass) : null,
          otherRights: snap ? lines(v.otherRights) : [],
          section155: kind === "MUTATION" && v.section155,
          notes: orNull(v.notes),
        },
      });
    },
    { onSuccess: onDone },
  );
  const hint = t("land.onePerLine");
  const text = (k: "from" | "to" | "owners" | "otherRights", label: MessageKey) => (
    <Field id={k} label={t(label)} hint={hint}>
      <Textarea id={k} {...f.register(k)} />
    </Field>
  );
  return (
    <form onSubmit={f.handleSubmit((v) => m.mutate(v))} className="space-y-3" noValidate>
      <div className="grid grid-cols-3 gap-1 rounded-xl border p-1" role="radiogroup" aria-label={t("land.subtype")}>
        {(Object.keys(SUBTYPES) as Kind[]).map((k) => (
          // biome-ignore lint/a11y/useSemanticElements: segmented control
          <button
            type="button"
            key={k}
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-11 rounded-lg px-1 text-sm ${kind === k ? "bg-primary text-primary-foreground" : ""}`}
          >
            {t(`land.kind.${k}`)}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field id="date" label={t("common.date")} error={f.formState.errors.date}>
          <Input id="date" type="date" {...f.register("date")} />
        </Field>
        {kind !== "RECORD_SNAPSHOT" && (
          <Field id="subtype" label={t("land.subtype")}>
            <NativeSelect id="subtype" {...f.register("subtype")}>
              {SUBTYPES[kind].map((s) => (
                <option key={s} value={s}>
                  {t(`sub.${s}` as MessageKey)}
                </option>
              ))}
            </NativeSelect>
          </Field>
        )}
      </div>
      {kind === "RECORD_SNAPSHOT" && (
        <>
          {text("owners", "land.owners")}
          <div className="grid grid-cols-2 gap-3">
            <Field id="areaSqm" label={t("land.area")}>
              <Input id="areaSqm" type="number" inputMode="decimal" min="0" step="any" {...f.register("areaSqm")} />
            </Field>
            <Field id="landClass" label={t("land.landClass")}>
              <Input id="landClass" list="land-classes" {...f.register("landClass")} />
            </Field>
          </div>
          <datalist id="land-classes">
            <option value="Class-I" />
            <option value="Class-II" />
            <option value="सरकारी" />
          </datalist>
          {text("otherRights", "land.otherRights")}
        </>
      )}
      {kind === "DEED" && (
        <Field id="deedRegNo" label={t("land.deedRegNo")}>
          <Input id="deedRegNo" placeholder="1234/2001" {...f.register("deedRegNo")} />
        </Field>
      )}
      {kind === "MUTATION" && (
        <div className="grid grid-cols-2 gap-3">
          <Field id="ferfarNo" label={t("land.ferfarNo")}>
            <Input id="ferfarNo" {...f.register("ferfarNo")} />
          </Field>
          <Field id="refDeedRegNo" label={t("land.refDeed")}>
            <Input id="refDeedRegNo" {...f.register("refDeedRegNo")} />
          </Field>
        </div>
      )}
      {kind !== "RECORD_SNAPSHOT" && (
        <>
          {text("from", "land.from")}
          {text("to", "land.to")}
        </>
      )}
      {kind === "MUTATION" && (
        <label className="flex min-h-11 items-center gap-2">
          <Checkbox {...f.register("section155")} />
          {t("land.section155")}
        </label>
      )}
      <Field id="notes" label={t("common.notes")}>
        <Input id="notes" {...f.register("notes")} />
      </Field>
      <ErrorBox error={m.error} />
      <FormActions busy={m.isPending} onCancel={onCancel} />
    </form>
  );
}
