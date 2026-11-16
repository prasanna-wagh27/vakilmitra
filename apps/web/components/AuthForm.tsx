"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "./LanguageToggle";
import { Button, ErrorBox, Field } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const { t, locale } = useI18n();
  const [form, setForm] = useState({ name: "", email: "", password: "", barCouncilNo: "" });
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "login") await api("/auth/login", { body: { email: form.email, password: form.password } });
      else await api("/auth/register", { body: { ...form, barCouncilNo: form.barCouncilNo || undefined, locale } });
      const next = new URLSearchParams(location.search).get("next");
      location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    } catch (err) {
      setError(err as Error);
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-700 dark:text-brand-100">{t("app.name")}</h1>
          <p className="muted text-sm">{t("app.tagline")}</p>
        </div>
        <LanguageToggle />
      </div>
      <form onSubmit={submit} className="space-y-3">
        {mode === "register" && (
          <Field label={t("auth.name")}><input className="input" required minLength={2} value={form.name} onChange={set("name")} autoComplete="name" /></Field>
        )}
        <Field label={t("auth.email")}><input className="input" type="email" required value={form.email} onChange={set("email")} autoComplete="email" /></Field>
        <Field label={t("auth.password")} hint={mode === "register" ? t("auth.passwordHint") : undefined}>
          <input className="input" type="password" required minLength={mode === "register" ? 8 : 1} value={form.password} onChange={set("password")} autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </Field>
        {mode === "register" && (
          <Field label={`${t("auth.barNo")} (${t("common.optional")})`}><input className="input" value={form.barCouncilNo} onChange={set("barCouncilNo")} /></Field>
        )}
        <ErrorBox error={error} />
        <Button type="submit" className="w-full" disabled={busy}>{mode === "login" ? t("auth.signIn") : t("auth.signUp")}</Button>
      </form>
      <p className="muted mt-6 text-center text-sm">
        {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
        <Link className="font-medium text-brand-600 underline" href={mode === "login" ? "/register" : "/login"}>
          {mode === "login" ? t("auth.signUp") : t("auth.signIn")}
        </Link>
      </p>
    </main>
  );
}
