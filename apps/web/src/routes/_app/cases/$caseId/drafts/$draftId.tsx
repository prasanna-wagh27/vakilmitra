import { Delete02Icon, File01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useBlocker, useNavigate } from "@tanstack/react-router";
import type { Draft } from "@vakilmitra/shared";
import { useEffect, useRef, useState } from "react";
import { ErrorBox, Field, Loading, PageHeader } from "@/components/common";
import { DraftParts } from "@/components/DraftParts";
import { CopyButton } from "@/components/PageTranslation";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { API_BASE, api } from "@/lib/api";
import { fmtDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { caseQuery, draftQuery, useApiMutation } from "@/lib/queries";

export const Route = createFileRoute("/_app/cases/$caseId/drafts/$draftId")({ component: DraftPage });

function DraftPage() {
  const { caseId, draftId } = Route.useParams();
  const { data, error, isPending, refetch } = useQuery(draftQuery(draftId));
  if (isPending) return <Loading />;
  if (error || !data) return <ErrorBox error={error} onRetry={() => refetch()} />;
  return <DraftEditor key={data.id} caseId={caseId} draft={data} />;
}

function DraftEditor({ caseId, draft }: { caseId: string; draft: Draft }) {
  const { t, tf, locale } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const caseData = useQuery(caseQuery(caseId));
  const canEdit = caseData.data ? caseData.data.access !== "VIEWER" : false;
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const dirty = title !== draft.title || body !== draft.body;

  const save = useApiMutation(() => api<{ draft: Draft }>(`/drafts/${draft.id}`, { method: "PATCH", body: { title, body } }), {
    onSuccess: (r) => qc.setQueryData(draftQuery(draft.id).queryKey, r.draft),
  });
  const deleted = useRef(false);
  const remove = useApiMutation(() => api(`/drafts/${draft.id}`, { method: "DELETE" }), {
    onSuccess: () => {
      deleted.current = true;
      navigate({ to: "/cases/$caseId", params: { caseId } });
    },
  });

  // Unsaved edits: ask before leaving the page or closing the tab.
  useBlocker({ shouldBlockFn: () => dirty && !deleted.current && !confirm(t("draft.unsaved")), disabled: !dirty });
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <>
      <PageHeader
        title={draft.title}
        back={`/cases/${caseId}`}
        description={tf("draft.meta", { kind: t(`draft.kind.${draft.kind}`), date: fmtDate(draft.updatedAt, locale) })}
      />
      <p className="mb-4 rounded-lg bg-warning-soft p-3 text-sm text-warning">
        {t(draft.source === "form" ? "draft.formCheck" : "draft.check")}
      </p>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(undefined);
        }}
      >
        <Field id="title" label={t("draft.title")}>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} readOnly={!canEdit} maxLength={200} />
        </Field>
        <Field id="body" label={t("draft.body")}>
          <Textarea
            id="body"
            lang={draft.language}
            rows={24}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            readOnly={!canEdit}
            className="leading-relaxed"
          />
        </Field>
        <ErrorBox error={save.error} />
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button type="submit" disabled={!dirty || save.isPending || !title.trim()}>
              {save.isSuccess && !dirty ? "✓" : t("common.save")}
            </Button>
          )}
          <Button asChild variant="outline">
            <a
              href={`${API_BASE}/api/drafts/${draft.id}/docx`}
              download
              aria-disabled={dirty}
              title={dirty ? t("draft.saveFirst") : undefined}
            >
              <HugeiconsIcon icon={File01Icon} /> {t("report.word")}
            </a>
          </Button>
          <CopyButton text={body} />
        </div>
        {dirty && <p className="text-sm text-muted-foreground">{t("draft.saveFirst")}</p>}
      </form>

      <div className="mt-8">
        <DraftParts kind={draft.kind} body={body} />
      </div>

      {draft.instructions && (
        <details className="mt-8 text-sm">
          <summary className="cursor-pointer font-medium">{t("draft.instructionsUsed")}</summary>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{draft.instructions}</p>
        </details>
      )}

      {canEdit && (
        <div className="mt-8">
          <ErrorBox error={remove.error} />
          <Button
            variant="destructive"
            onClick={() => confirm(t("common.confirmDelete")) && remove.mutate(undefined)}
            disabled={remove.isPending}
          >
            <HugeiconsIcon icon={Delete02Icon} /> {t("draft.delete")}
          </Button>
        </div>
      )}
    </>
  );
}
