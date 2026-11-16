import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
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
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-primary">{t("app.name")}</h1>
          <p className="text-sm text-muted-foreground">{t("app.tagline")}</p>
        </div>
        <LanguageToggle />
      </div>
      <form onSubmit={f.handleSubmit(submit)} className="space-y-3" noValidate>
        {mode === "register" && (
          <Field id="name" label={t("auth.name")} error={e.name}>
            <Input id="name" autoComplete="name" {...f.register("name")} />
          </Field>
        )}
        <Field id="email" label={t("auth.email")} error={e.email}>
          <Input id="email" type="email" autoComplete="email" {...f.register("email")} />
        </Field>
        <Field id="password" label={t("auth.password")} hint={mode === "register" ? t("auth.passwordHint") : undefined} error={e.password}>
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
        <Link className="font-medium text-primary underline" to={mode === "login" ? "/register" : "/login"} search={{ next }}>
          {mode === "login" ? t("auth.signUp") : t("auth.signIn")}
        </Link>
      </p>
    </main>
  );
}
