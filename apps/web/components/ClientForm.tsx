"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Client } from "@/lib/types";
import { ErrorBox, Field, FormActions } from "./ui";

export function ClientForm({ initial, onSaved, onCancel }: { initial?: Client; onSaved: (c: Client) => void; onCancel: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({
    name: initial?.name ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", address: initial?.address ?? "",
    whatsappOptIn: initial?.whatsappOptIn ?? false, notes: initial?.notes ?? "",
  });
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...f, phone: f.phone || null, email: f.email || null, address: f.address || null, notes: f.notes || null };
      const r = initial
        ? await api<{ client: Client }>(`/clients/${initial.id}`, { method: "PATCH", body })
        : await api<{ client: Client }>("/clients", { body });
      onSaved(r.client);
    } catch (err) {
      setError(err as Error);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label={t("common.name")}><input className="input" required value={f.name} onChange={set("name")} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.phone")}><input className="input" type="tel" inputMode="tel" value={f.phone} onChange={set("phone")} /></Field>
        <Field label={t("common.email")}><input className="input" type="email" value={f.email} onChange={set("email")} /></Field>
      </div>
      <Field label={t("common.address")}><textarea className="input" value={f.address} onChange={set("address")} /></Field>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" className="h-5 w-5" checked={f.whatsappOptIn} onChange={(e) => setF({ ...f, whatsappOptIn: e.target.checked })} />
        {t("client.whatsapp")}
      </label>
      <Field label={t("common.notes")}><textarea className="input" value={f.notes} onChange={set("notes")} /></Field>
      <ErrorBox error={error} />
      <FormActions busy={busy} onCancel={onCancel} />
    </form>
  );
}
