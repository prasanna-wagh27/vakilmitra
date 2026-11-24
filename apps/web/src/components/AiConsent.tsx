import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Advocate, AiStatus } from "@vakilmitra/shared";
import { useState } from "react";
import { ErrorBox } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { aiQuery, aiWhere, meQuery } from "@/lib/queries";

type AiTask = keyof AiStatus;

export const isConsentError = (e: unknown): e is ApiError => e instanceof ApiError && e.code === "ai_consent_required";
/** The 403 says whose consent is missing: the advocate's own, or the case owner's. */
export const ownerOff = (e: unknown) => isConsentError(e) && (e.details as unknown as { yours?: boolean } | undefined)?.yours === false;

/** Whether an AI task is set up, and whether the advocate has still to allow AI for their own cases. */
export function useAi(task: AiTask, isOwner: boolean) {
  const ai = useQuery(aiQuery);
  const me = useQuery(meQuery);
  const enabled = !!ai.data?.[task].enabled;
  const where: ReturnType<typeof aiWhere> = ai.data ? aiWhere(ai.data[task].models) : "unknown";
  return {
    enabled,
    where,
    needsConsent: isOwner && me.data ? !me.data.aiConsent : false,
  };
}

/** Asks for AI consent in place, so the advocate does not have to leave the page. */
export function ConsentPrompt({
  where,
  allowLabel,
  onAllowed,
}: {
  where: "india" | "abroad" | "unknown";
  /** The button: allow, and do what was asked ("Allow and translate"). */
  allowLabel: string;
  onAllowed: () => void;
}) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const allow = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ advocate: Advocate }>("/me", { method: "PATCH", body: { aiConsent: true } });
      qc.setQueryData(meQuery.queryKey, r.advocate);
      onAllowed();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-2 space-y-2 rounded-lg border bg-muted/40 p-3 text-sm">
      <p className="font-medium">{t("settings.ai")}</p>
      <p className="text-muted-foreground">{t("settings.aiText")}</p>
      <p className="font-medium">{t(`ai.where.${where}`)}</p>
      <ErrorBox error={error} />
      <Button size="sm" onClick={allow} disabled={busy}>
        {allowLabel}
      </Button>
    </div>
  );
}
