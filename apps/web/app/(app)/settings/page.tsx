"use client";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { Advocate } from "@/lib/types";
import { useAdvocate } from "@/components/AppShell";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button, Card, ErrorBox, Field, PageHeader, Section } from "@/components/ui";

export default function SettingsPage() {
  const { t } = useI18n();
  const { advocate, setAdvocate } = useAdvocate();
  const [f, setF] = useState({ name: advocate.name, phone: advocate.phone ?? "", barCouncilNo: advocate.barCouncilNo ?? "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [password, setPassword] = useState("");
  const [delError, setDelError] = useState<Error | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      const r = await api<{ advocate: Advocate }>("/auth/me", { method: "PATCH", body: { name: f.name, phone: f.phone || null, barCouncilNo: f.barCouncilNo || null } });
      setAdvocate(r.advocate);
      setSaved(true);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    location.href = "/login";
  }

  async function deleteAccount(e: FormEvent) {
    e.preventDefault();
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      await api("/auth/me", { method: "DELETE", body: { password } });
      location.href = "/register";
    } catch (err) {
      setDelError(err as Error);
    }
  }

  return (
    <>
      <PageHeader title={t("settings.title")} />
      <Section title={t("settings.language")}><LanguageToggle persist /></Section>

      <Section title={t("settings.profile")}>
        <form onSubmit={save} className="space-y-3">
          <p className="muted text-sm">{advocate.email}</p>
          <Field label={t("auth.name")}><input className="input" required value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setSaved(false); }} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("common.phone")}><input className="input" type="tel" value={f.phone} onChange={(e) => { setF({ ...f, phone: e.target.value }); setSaved(false); }} /></Field>
            <Field label={t("auth.barNo")}><input className="input" value={f.barCouncilNo} onChange={(e) => { setF({ ...f, barCouncilNo: e.target.value }); setSaved(false); }} /></Field>
          </div>
          <ErrorBox error={error} />
          <Button type="submit">{saved ? "✓" : t("common.save")}</Button>
        </form>
      </Section>

      <Section title={t("settings.privacy")}>
        <Card><p className="text-sm">{t("settings.privacyText")}</p></Card>
      </Section>

      <Section title={t("auth.signOut")}>
        <Button variant="secondary" onClick={logout}>{t("auth.signOut")}</Button>
      </Section>

      <Section title={t("settings.deleteAccount")}>
        <form onSubmit={deleteAccount} className="space-y-3">
          <p className="muted text-sm">{t("settings.deleteAccountHint")}</p>
          <Field label={t("auth.password")}><input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></Field>
          <ErrorBox error={delError} />
          <Button type="submit" variant="danger">{t("settings.deleteAccount")}</Button>
        </form>
      </Section>
    </>
  );
}
