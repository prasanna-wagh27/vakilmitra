import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { ErrorBox, Field } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { authError } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPassword });

function ForgotPassword() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}/reset-password` });
    setBusy(false);
    // The answer is the same whether or not the account exists.
    if (r.error) setError(authError(r.error));
    else setSent(true);
  }

  return (
    <AuthShell title={t("auth.forgotTitle")}>
      {sent ? (
        <p className="text-sm" role="status">
          {t("auth.linkSent")}
        </p>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("auth.forgotHelp")}</p>
          <Field id="email" label={t("auth.email")}>
            <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <ErrorBox error={error} />
          <Button type="submit" className="w-full" disabled={busy}>
            {t("auth.sendLink")}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="font-medium text-brand underline underline-offset-4">
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </AuthShell>
  );
}
