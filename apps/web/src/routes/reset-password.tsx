import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { AuthShell } from "@/components/AuthShell";
import { ErrorBox, Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";

/** The emailed link lands here with ?token=..., or ?error=INVALID_TOKEN when it has expired. */
export const Route = createFileRoute("/reset-password")({
  validateSearch: z.object({ token: z.string().optional(), error: z.string().optional() }),
  component: ResetPassword,
});

function ResetPassword() {
  const { t } = useI18n();
  const { token, error: linkError } = Route.useSearch();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [expired, setExpired] = useState(!token || Boolean(linkError));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError(new Error(t("auth.passwordHint")));
    setBusy(true);
    setError(null);
    const r = await authClient.resetPassword({ newPassword: password, token: token! });
    setBusy(false);
    if (!r.error) setDone(true);
    else if (r.error.code === "INVALID_TOKEN") setExpired(true);
    else setError(new Error(r.error.message ?? t("common.error")));
  }

  return (
    <AuthShell title={t("auth.forgotTitle")}>
      {done ? (
        <div className="space-y-4" role="status">
          <p className="text-sm">{t("auth.passwordSet")}</p>
          <Button className="w-full" asChild>
            <Link to="/login">{t("auth.signIn")}</Link>
          </Button>
        </div>
      ) : expired ? (
        <div className="space-y-4">
          <p className="text-sm">{t("auth.linkExpired")}</p>
          <Button className="w-full" asChild>
            <Link to="/forgot-password">{t("auth.sendLink")}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field id="password" label={t("auth.newPassword")} hint={t("auth.passwordHint")}>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorBox error={error} />
          <Button type="submit" className="w-full" disabled={busy}>
            {t("auth.setPassword")}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
