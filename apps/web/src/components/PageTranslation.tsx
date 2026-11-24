import { Copy01Icon, Tick02Icon, TranslateIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQueryClient } from "@tanstack/react-query";
import { type DocumentDetail, type Locale, type PageDetail, type PageTranslation as Saved, textLocale } from "@vakilmitra/shared";
import { useState } from "react";
import { ConsentPrompt, isConsentError, ownerOff, useAi } from "@/components/AiConsent";
import { ErrorBox } from "@/components/common";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { documentQuery } from "@/lib/queries";

/** A Marathi page is translated into English, anything else into Marathi. */
export const targetLang = (text: string | null): Locale => (textLocale(text ?? "") === "mr" ? "en" : "mr");

const translatable = (p: PageDetail) => p.ocrStatus === "DONE" && !!p.ocrText?.trim();

function postTranslate(documentId: string, pageId: string, lang: Locale, fresh = false) {
  return api<{ translation: Saved }>(`/documents/${documentId}/pages/${pageId}/translate`, { body: { lang, fresh } }).then(
    (r) => r.translation,
  );
}

/** Puts a new translation into the cached document, so the page shows it without reloading every page. */
function useStoreTranslation(documentId: string) {
  const qc = useQueryClient();
  return (pageId: string, tr: Saved) =>
    qc.setQueryData(
      documentQuery(documentId).queryKey,
      (doc: DocumentDetail | undefined) =>
        doc && {
          ...doc,
          pages: doc.pages.map((p) =>
            p.id === pageId ? { ...p, translations: [...p.translations.filter((x) => x.lang !== tr.lang), tr] } : p,
          ),
        },
    );
}

export function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() =>
        navigator.clipboard.writeText(text).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        })
      }
    >
      <HugeiconsIcon icon={done ? Tick02Icon : Copy01Icon} /> {t(done ? "doc.copied" : "doc.copy")}
    </Button>
  );
}

/** A page's saved translation, or the button to make one. Viewers see saved translations only. */
export function PageTranslation({
  documentId,
  page,
  canEdit,
  isOwner,
}: {
  documentId: string;
  page: PageDetail;
  canEdit: boolean;
  isOwner: boolean;
}) {
  const { t } = useI18n();
  const ai = useAi("translation", isOwner);
  const store = useStoreTranslation(documentId);
  const lang = targetLang(page.ocrText);
  const saved = page.translations.find((x) => x.lang === lang);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [asking, setAsking] = useState(false);
  const [open, setOpen] = useState(false);

  const run = async (fresh: boolean) => {
    setBusy(true);
    setError(null);
    try {
      store(page.id, await postTranslate(documentId, page.id, lang, fresh));
      setOpen(true);
    } catch (e) {
      if (isConsentError(e) && !ownerOff(e)) setAsking(true);
      else setError(e);
    } finally {
      setBusy(false);
    }
  };
  const start = (fresh: boolean) => (ai.needsConsent ? setAsking(true) : run(fresh));

  const canRun = canEdit && ai.enabled && translatable(page);
  if (!saved && !canRun) return null;
  return (
    <div className="border-t px-3 py-2">
      {saved ? (
        <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
          <summary className="cursor-pointer text-sm font-medium">{t(lang === "en" ? "doc.translationEn" : "doc.translationMr")}</summary>
          <p className="mt-2 text-xs text-muted-foreground">{t("doc.translationCheck")}</p>
          <p lang={lang} className="mt-2 text-sm whitespace-pre-wrap">
            {saved.text}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            <CopyButton text={saved.text} />
            {canRun && (
              <Button variant="ghost" size="sm" onClick={() => start(true)} disabled={busy}>
                <HugeiconsIcon icon={TranslateIcon} /> {busy ? t("doc.translating") : t("doc.translateAgain")}
              </Button>
            )}
          </div>
        </details>
      ) : (
        <Button variant="outline" size="sm" onClick={() => start(false)} disabled={busy}>
          <HugeiconsIcon icon={TranslateIcon} />
          {busy ? t("doc.translating") : t(lang === "en" ? "doc.translateToEn" : "doc.translateToMr")}
        </Button>
      )}
      {asking && (
        <ConsentPrompt
          where={ai.where}
          allowLabel={t("settings.aiAllow")}
          onAllowed={() => {
            setAsking(false);
            run(!!saved);
          }}
        />
      )}
      {ownerOff(error) ? <p className="mt-2 text-sm text-muted-foreground">{t("doc.aiOwnerOff")}</p> : <ErrorBox error={error} />}
    </div>
  );
}

/** Translates every read page that has no translation yet, one page at a time (each is one AI request). */
export function TranslateAll({ doc, canEdit, isOwner }: { doc: DocumentDetail; canEdit: boolean; isOwner: boolean }) {
  const { t, tf } = useI18n();
  const ai = useAi("translation", isOwner);
  const store = useStoreTranslation(doc.id);
  const [progress, setProgress] = useState<{ n: number; total: number } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [asking, setAsking] = useState(false);

  const todo = doc.pages.filter((p) => translatable(p) && !p.translations.some((x) => x.lang === targetLang(p.ocrText)));
  if (!canEdit || !ai.enabled || (todo.length < 2 && !progress && !error && !asking)) return null;
  // The button names the language most pages go into.
  const toEn = todo.filter((p) => targetLang(p.ocrText) === "en").length * 2 >= todo.length;

  const run = async () => {
    setError(null);
    try {
      for (const [i, p] of todo.entries()) {
        setProgress({ n: i + 1, total: todo.length });
        store(p.id, await postTranslate(doc.id, p.id, targetLang(p.ocrText)));
      }
    } catch (e) {
      if (isConsentError(e) && !ownerOff(e)) setAsking(true);
      else setError(e);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="mt-8">
      <Button variant="outline" onClick={() => (ai.needsConsent ? setAsking(true) : run())} disabled={!!progress}>
        <HugeiconsIcon icon={TranslateIcon} />
        {progress ? tf("doc.translatingPage", progress) : t(toEn ? "doc.translateAllEn" : "doc.translateAllMr")}
      </Button>
      {asking && (
        <ConsentPrompt
          where={ai.where}
          allowLabel={t("settings.aiAllow")}
          onAllowed={() => {
            setAsking(false);
            run();
          }}
        />
      )}
      {ownerOff(error) ? <p className="mt-2 text-sm text-muted-foreground">{t("doc.aiOwnerOff")}</p> : <ErrorBox error={error} />}
    </div>
  );
}
