import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { Advocate } from "@vakilmitra/shared";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ErrorBox, Field, PageHeader, Section } from "@/components/common";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Input } from "@/components/ui/input";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { fmtDate, orNull } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { billingQuery, meQuery, useApiMutation } from "@/lib/queries";

export const Route = createFileRoute("/_app/settings")({ component: SettingsPage });

const profileForm = z.object({ name: z.string().trim().min(2), phone: z.string(), barCouncilNo: z.string() });

function SettingsPage() {
  const { t } = useI18n();
  const { advocate } = Route.useRouteContext();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");

  const f = useForm<z.infer<typeof profileForm>>({
    resolver: zodResolver(profileForm),
    defaultValues: { name: advocate.name, phone: advocate.phone ?? "", barCouncilNo: advocate.barCouncilNo ?? "" },
  });
  const save = useApiMutation(
    (v: z.infer<typeof profileForm>) =>
      api<{ advocate: Advocate }>("/me", {
        method: "PATCH",
        body: { name: v.name, phone: orNull(v.phone), barCouncilNo: orNull(v.barCouncilNo) },
      }),
    { onSuccess: (r) => qc.setQueryData(meQuery.queryKey, r.advocate) },
  );
  const del = useApiMutation((pw: string) => api("/me", { method: "DELETE", body: { password: pw } }), {
    onSuccess: () => {
      qc.clear();
      void navigate({ to: "/register" });
    },
  });

  async function logout() {
    await authClient.signOut();
    qc.clear();
    await navigate({ to: "/login" });
  }

  return (
    <>
      <PageHeader title={t("settings.title")} />
      <Section title={t("settings.language")}>
        <LanguageToggle persist />
      </Section>

      <Section title={t("nav.billing")}>
        <PlanLink />
      </Section>

      <Section title={t("settings.profile")}>
        <form onSubmit={f.handleSubmit((v) => save.mutate(v))} className="space-y-3" noValidate>
          <EmailLine advocate={advocate} />
          <Field id="name" label={t("auth.name")} error={f.formState.errors.name}>
            <Input id="name" {...f.register("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="phone" label={t("common.phone")}>
              <Input id="phone" type="tel" {...f.register("phone")} />
            </Field>
            <Field id="barCouncilNo" label={t("auth.barNo")}>
              <Input id="barCouncilNo" {...f.register("barCouncilNo")} />
            </Field>
          </div>
          <ErrorBox error={save.error} />
          <Button type="submit" disabled={save.isPending}>
            {save.isSuccess && !f.formState.isDirty ? "✓" : t("common.save")}
          </Button>
        </form>
      </Section>

      <CloudOcrConsent />

      <Section title={t("settings.privacy")}>
        <Card className="gap-3 px-(--card-spacing)">
          <p className="text-sm">{t("settings.privacyText")}</p>
        </Card>
      </Section>

      <Section title={t("auth.signOut")}>
        <Button variant="outline" onClick={logout}>
          {t("auth.signOut")}
        </Button>
      </Section>

      <Section title={t("settings.deleteAccount")}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (confirm(t("common.confirmDelete"))) del.mutate(password);
          }}
          className="space-y-3"
        >
          <p className="text-sm text-muted-foreground">{t("settings.deleteAccountHint")}</p>
          <Field id="delete-password" label={t("auth.password")}>
            <Input
              id="delete-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <ErrorBox error={del.error} />
          <Button type="submit" variant="destructive" disabled={del.isPending}>
            {t("settings.deleteAccount")}
          </Button>
        </form>
      </Section>
    </>
  );
}

function PlanLink() {
  const { t } = useI18n();
  const { data: b } = useQuery(billingQuery);
  return (
    <Item asChild variant="outline">
      <Link to="/billing">
        <ItemContent>
          <ItemTitle>{b ? t(`billing.plan.${b.plan}` as MessageKey) : t("billing.yourPlan")}</ItemTitle>
          {b && <ItemDescription>{t(`billing.state.${b.state}` as MessageKey)}</ItemDescription>}
        </ItemContent>
        <ItemActions>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-muted-foreground" />
        </ItemActions>
      </Link>
    </Item>
  );
}

/** Consent to send hard-to-read pages to a cloud OCR provider. Off by default; every change is logged. */
function CloudOcrConsent() {
  const { t, tf, locale } = useI18n();
  const qc = useQueryClient();
  const me = useQuery(meQuery);
  // Optimistic: the box changes in the same click (no flicker on slow connections) and
  // falls back to the saved value if the save fails.
  const [pending, setPending] = useState<boolean | null>(null);
  const toggle = useApiMutation((on: boolean) => api<{ advocate: Advocate }>("/me", { method: "PATCH", body: { cloudOcrConsent: on } }), {
    onSuccess: (r) => qc.setQueryData(meQuery.queryKey, r.advocate),
  });
  const on = pending ?? me.data?.cloudOcrConsent ?? false;
  const change = (next: boolean) => {
    setPending(next);
    toggle.mutate(next, { onSettled: () => setPending(null) });
  };
  return (
    <Section title={t("settings.cloudOcr")}>
      <Card className="gap-3 px-(--card-spacing)">
        <label className="flex min-h-11 items-start gap-3">
          <Checkbox className="mt-1" checked={on} disabled={toggle.isPending || !me.data} onChange={(e) => change(e.target.checked)} />
          <span className="text-sm">
            <span className="block font-medium">{t("settings.cloudOcr")}</span>
            <span className="block text-muted-foreground">{t("settings.cloudOcrText")}</span>
            {on && me.data?.cloudOcrConsentAt && (
              <span className="mt-1 block text-primary">
                {tf("settings.cloudOcrOn", { date: fmtDate(me.data.cloudOcrConsentAt, locale) })}
              </span>
            )}
          </span>
        </label>
        <ErrorBox error={toggle.error} />
      </Card>
    </Section>
  );
}

/** The sign-in email, and whether its owner has opened the confirmation link. */
function EmailLine({ advocate }: { advocate: Advocate }) {
  const { t } = useI18n();
  const resend = useApiMutation(() =>
    authClient.sendVerificationEmail({ email: advocate.email, callbackURL: `${window.location.origin}/settings?verified=1` }).then((r) => {
      if (r.error) throw new Error(r.error.message ?? t("common.error"));
    }),
  );
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-muted-foreground">{advocate.email}</span>
      {advocate.emailVerified ? (
        <Badge tone="green">{t("auth.emailConfirmed")}</Badge>
      ) : (
        <>
          <Badge tone="amber">{t("auth.emailUnconfirmed")}</Badge>
          {resend.isSuccess ? (
            <span role="status">{t("auth.resent")}</span>
          ) : (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 underline underline-offset-4"
              disabled={resend.isPending}
              onClick={() => resend.mutate()}
            >
              {t("auth.resendLink")}
            </Button>
          )}
          <ErrorBox error={resend.error} />
        </>
      )}
    </div>
  );
}
