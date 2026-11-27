import { AiMagicIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DRAFT_KINDS, type Draft, type DraftKind, FORM_KINDS, type FormKind, type Locale } from "@vakilmitra/shared";
import { useEffect, useRef, useState } from "react";
import { ConsentPrompt, isConsentError, ownerOff, useAi } from "@/components/AiConsent";
import { ErrorBox, Field, PageHeader } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Checkbox, NativeSelect, Textarea } from "@/components/ui/input";
import { api, apiStream } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { caseQuery, useApiMutation } from "@/lib/queries";

const isForm = (k: DraftKind): k is FormKind => (FORM_KINDS as readonly DraftKind[]).includes(k);

export const Route = createFileRoute("/_app/cases/$caseId/drafts/new")({ component: NewDraftPage });

function NewDraftPage() {
  const { caseId } = Route.useParams();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const caseData = useQuery(caseQuery(caseId));
  const ai = useAi("drafting", caseData.data?.access === "OWNER");

  const [kind, setKind] = useState<DraftKind>("LEGAL_NOTICE");
  const [language, setLanguage] = useState<Locale>(locale);
  const [instructions, setInstructions] = useState("");
  const [useCaseDetails, setUseCaseDetails] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [asking, setAsking] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const draftId = useRef<string | null>(null);
  const out = useRef<HTMLDivElement>(null);

  // Leaving the page stops the draft; what was written so far is kept on the server.
  useEffect(
    () => () => {
      draftId.current = null;
      abort.current?.abort();
    },
    [],
  );
  // Follow the text as it is written.
  const show = (s: string) => {
    setText(s);
    requestAnimationFrame(() => out.current?.scrollTo({ top: out.current.scrollHeight }));
  };

  const tooShort = instructions.trim().length < 10;
  const run = async () => {
    setBusy(true);
    setError(null);
    setText("");
    abort.current = new AbortController();
    draftId.current = null;
    const open = async () => {
      await qc.invalidateQueries({ queryKey: ["case", caseId] });
      if (draftId.current) navigate({ to: "/cases/$caseId/drafts/$draftId", params: { caseId, draftId: draftId.current }, replace: true });
    };
    try {
      await apiStream(`/cases/${caseId}/drafts/generate`, { kind, language, instructions, useCaseDetails }, show, {
        signal: abort.current.signal,
        onStart: (h) => {
          draftId.current = h.get("X-Draft-Id");
        },
      });
      await open();
    } catch (e) {
      if (isConsentError(e) && !ownerOff(e)) setAsking(true);
      // Stopped, or cut off partway: what was written is saved, so open it.
      else if (draftId.current && (e as Error)?.name === "AbortError") await open();
      else setError(e);
    } finally {
      setBusy(false);
    }
  };
  const start = () => (ai.needsConsent ? setAsking(true) : run());
  // A pleading from the blank form: no AI, so no instructions or consent needed.
  const fromForm = useApiMutation(
    (k: FormKind) => api<{ draft: Draft }>(`/cases/${caseId}/drafts/form`, { method: "POST", body: { kind: k, language } }),
    { onSuccess: ({ draft }) => navigate({ to: "/cases/$caseId/drafts/$draftId", params: { caseId, draftId: draft.id }, replace: true }) },
  );

  return (
    <>
      <PageHeader title={t("draft.new")} back={`/cases/${caseId}`} description={caseData.data?.case.title} />
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!tooShort && !busy) start();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="kind" label={t("draft.kind")}>
            <NativeSelect id="kind" value={kind} onChange={(e) => setKind(e.target.value as DraftKind)} disabled={busy}>
              {DRAFT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`draft.kind.${k}`)}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field id="language" label={t("draft.language")}>
            <NativeSelect id="language" value={language} onChange={(e) => setLanguage(e.target.value as Locale)} disabled={busy}>
              <option value="mr">{t("draft.lang.mr")}</option>
              <option value="en">{t("draft.lang.en")}</option>
            </NativeSelect>
          </Field>
        </div>
        <Field id="instructions" label={t("draft.instructions")} hint={t(`draft.hint.${kind}`)}>
          <Textarea
            id="instructions"
            rows={7}
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            disabled={busy}
            maxLength={6000}
          />
        </Field>
        <label className="flex min-h-11 items-start gap-2 text-sm">
          <Checkbox className="mt-0.5" checked={useCaseDetails} onChange={(e) => setUseCaseDetails(e.target.checked)} disabled={busy} />
          <span>
            <span className="font-medium">{t("draft.useCase")}</span>
            <span className="block text-muted-foreground">{t("draft.useCaseHint")}</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={busy || tooShort || !ai.enabled}>
            <HugeiconsIcon icon={AiMagicIcon} /> {busy ? t("draft.writing") : t("draft.write")}
          </Button>
          {busy && (
            <Button type="button" variant="ghost" onClick={() => abort.current?.abort()}>
              {t("draft.stop")}
            </Button>
          )}
        </div>
        {asking && (
          <ConsentPrompt
            where={ai.where}
            allowLabel={t("draft.allow")}
            onAllowed={() => {
              setAsking(false);
              run();
            }}
          />
        )}
        {ownerOff(error) ? <p className="text-sm text-muted-foreground">{t("draft.ownerOff")}</p> : <ErrorBox error={error} />}
        {isForm(kind) && (
          <div className="border-t pt-4">
            <p className="mb-2 text-sm text-muted-foreground">{t("draft.or")}</p>
            <Button type="button" variant="outline" disabled={busy || fromForm.isPending} onClick={() => fromForm.mutate(kind)}>
              {t("draft.form")}
            </Button>
            <p className="mt-2 text-sm text-muted-foreground">{t("draft.formHint")}</p>
            <ErrorBox error={fromForm.error} />
          </div>
        )}
      </form>

      {(busy || text) && (
        <div
          ref={out}
          aria-live="polite"
          lang={language}
          className="panel mt-6 max-h-[60vh] overflow-y-auto p-4 text-sm leading-relaxed whitespace-pre-wrap"
        >
          {text || t("draft.writing")}
        </div>
      )}
    </>
  );
}
