import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { Link2, LockKeyhole, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { Brand } from "./AppShell";
import { ErrorBox, Field } from "./common";
import { LanguageToggle } from "./LanguageToggle";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

const schema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string().min(1),
  barCouncilNo: z.string(),
});

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<Error | null>(null);
  const f = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(
      mode === "register" ? schema.extend({ name: z.string().trim().min(2), password: z.string().min(8, t("auth.passwordHint")) }) : schema,
    ),
    defaultValues: { name: "", email: "", password: "", barCouncilNo: "" },
  });

  async function submit(v: z.infer<typeof schema>) {
    setError(null);
    const res =
      mode === "login"
        ? await authClient.signIn.email({ email: v.email, password: v.password })
        : await authClient.signUp.email({
            name: v.name,
            email: v.email,
            password: v.password,
            barCouncilNo: v.barCouncilNo || undefined,
            locale,
          });
    if (res.error) {
      setError(new Error(res.error.message ?? t("common.error")));
      return;
    }
    qc.clear();
    const safe = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
    await navigate({ to: safe });
  }

  const e = f.formState.errors;
  const trust = [
    { icon: LockKeyhole, text: t("auth.trust1") },
    { icon: Link2, text: t("auth.trust2") },
    { icon: ShieldCheck, text: t("auth.trust3") },
  ];
  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl items-center gap-6 px-4 py-6 md:grid-cols-[1.05fr_1fr] md:gap-10 md:py-10">
      {/* Brand side: what this is and why it can be trusted. */}
      <section className="hero-ink relative overflow-hidden px-6 py-7 sm:px-9 sm:py-10">
        <Brand onDark />
        <h1 className="font-display mt-8 text-[2rem] leading-[1.15] sm:text-[2.6rem]">{t("auth.hero")}</h1>
        <p className="mt-3 max-w-md text-white/70">{t("auth.heroSub")}</p>
        <ul className="mt-7 hidden space-y-3 sm:block">
          {trust.map((x) => (
            <li key={x.text} className="flex items-center gap-3 text-sm text-white/85">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5">
                <x.icon className="size-4" aria-hidden />
              </span>
              {x.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel w-full p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-2">
          <h2 className="font-display text-2xl">{mode === "login" ? t("auth.signIn") : t("auth.signUp")}</h2>
          <LanguageToggle />
        </div>
        <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
          {mode === "register" && (
            <Field id="name" label={t("auth.name")} error={e.name}>
              <Input id="name" autoComplete="name" {...f.register("name")} />
            </Field>
          )}
          <Field id="email" label={t("auth.email")} error={e.email}>
            <Input id="email" type="email" autoComplete="email" {...f.register("email")} />
          </Field>
          <Field
            id="password"
            label={t("auth.password")}
            hint={mode === "register" ? t("auth.passwordHint") : undefined}
            error={e.password}
          >
            <Input
              id="password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              {...f.register("password")}
            />
          </Field>
          {mode === "register" && (
            <Field id="barCouncilNo" label={`${t("auth.barNo")} (${t("common.optional")})`}>
              <Input id="barCouncilNo" {...f.register("barCouncilNo")} />
            </Field>
          )}
          <ErrorBox error={error} />
          <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>
            {mode === "login" ? t("auth.signIn") : t("auth.signUp")}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
          <Link
            className="font-medium text-accent underline underline-offset-4"
            to={mode === "login" ? "/register" : "/login"}
            search={{ next }}
          >
            {mode === "login" ? t("auth.signUp") : t("auth.signIn")}
          </Link>
        </p>
        <ul className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t pt-5 text-xs text-muted-foreground sm:hidden">
          {trust.map((x) => (
            <li key={x.text} className="flex items-center gap-1.5">
              <x.icon className="size-3.5" aria-hidden />
              {x.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
