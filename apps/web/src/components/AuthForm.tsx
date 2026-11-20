import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { AuthShell } from "./AuthShell";
import { ErrorBox, Field } from "./common";
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
    <AuthShell title={mode === "login" ? t("auth.signIn") : t("auth.signUp")}>
      <form onSubmit={f.handleSubmit(submit)} className="space-y-4" noValidate>
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
        {mode === "login" && (
          <Link to="/forgot-password" className="-mt-2 block text-right text-sm text-muted-foreground underline-offset-4 hover:underline">
            {t("auth.forgot")}
          </Link>
        )}
        <ErrorBox error={error} />
        <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>
          {mode === "login" ? t("auth.signIn") : t("auth.signUp")}
        </Button>
        {mode === "register" && (
          <p className="text-center text-xs text-muted-foreground">
            {t("legal.agree1")}{" "}
            <Link to="/terms" className="underline underline-offset-4">
              {t("legal.terms")}
            </Link>{" "}
            {t("legal.and")}{" "}
            <Link to="/privacy" className="underline underline-offset-4">
              {t("legal.privacy")}
            </Link>
            {locale === "en" ? "" : " "}
            {t("legal.agree2")}
          </p>
        )}
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
        <Link
          className="font-medium text-primary underline underline-offset-4"
          to={mode === "login" ? "/register" : "/login"}
          search={{ next }}
        >
          {mode === "login" ? t("auth.signUp") : t("auth.signIn")}
        </Link>
      </p>
    </AuthShell>
  );
}
