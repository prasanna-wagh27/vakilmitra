import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { DOC_TYPES, type DocumentDetail, type OcrStatus, type PageDetail } from "@vakilmitra/shared";
import { Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Empty, ErrorBox, Field, FormActions, Loading, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, NativeSelect } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { orNull } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { caseQuery, documentQuery, pageImageUrl, useApiMutation } from "@/lib/queries";

export const Route = createFileRoute("/_app/cases/$caseId/documents/$documentId")({
  validateSearch: z.object({ page: z.coerce.number().int().optional() }),
  component: DocumentPage,
});

/** Below this, a word is outlined for the advocate to check against the scan. */
const UNCLEAR = 0.6;
const statusTone: Record<OcrStatus, "neutral" | "blue" | "green" | "red"> = {
  PENDING: "neutral",
  PROCESSING: "blue",
  DONE: "green",
  FAILED: "red",
};

export function OcrBadge({ status }: { status: OcrStatus }) {
  const { t } = useI18n();
  return (
    <Badge tone={statusTone[status]}>
      {status === "PROCESSING" && <Loader2 className="animate-spin" />}
      {t(`doc.ocr.${status}`)}
    </Badge>
  );
}

function PageCard({ documentId, page, outline, canEdit }: { documentId: string; page: PageDetail; outline: boolean; canEdit: boolean }) {
  const { t } = useI18n();
  const retry = useApiMutation(() => api(`/documents/${documentId}/pages/${page.id}/ocr`, { method: "POST" }));
  const remove = useApiMutation(() => api(`/documents/${documentId}/pages/${page.id}`, { method: "DELETE" }));
  const unclear = outline ? (page.ocrWords ?? []).filter((w) => w.c < UNCLEAR) : [];
  return (
    <li id={`page-${page.pageNo}`} className="panel scroll-mt-20 overflow-hidden">
      <div className="relative bg-muted" style={page.width && page.height ? { aspectRatio: `${page.width} / ${page.height}` } : undefined}>
        <img
          src={pageImageUrl(documentId, page.id)}
          alt={`${t("doc.page")} ${page.pageNo}`}
          loading="lazy"
          className="block h-full w-full object-contain"
        />
        {unclear.map((w, i) => (
          <span
            key={i}
            title={w.t}
            className="pointer-events-none absolute rounded-sm border-2 border-amber-500 bg-amber-400/15"
            style={{
              left: `${w.b[0] * 100}%`,
              top: `${w.b[1] * 100}%`,
              width: `${(w.b[2] - w.b[0]) * 100}%`,
              height: `${(w.b[3] - w.b[1]) * 100}%`,
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3">
        <span className="font-semibold">
          {t("doc.page")} {page.pageNo}
        </span>
        <OcrBadge status={page.ocrStatus} />
        {page.ocrConfidence != null && (
          <span className="text-sm text-muted-foreground" title={t("doc.confidence")}>
            {Math.round(page.ocrConfidence * 100)}%
          </span>
        )}
        {page.ocrStatus === "DONE" && page.ocrRoute && (
          <Badge tone={page.ocrRoute === "cloud" ? "amber" : "neutral"} title={page.ocrEngine ?? undefined}>
            {page.ocrRoute === "cloud"
              ? t("doc.readCloud")
              : page.ocrRoute === "local:cloud-queued"
                ? t("doc.readCloudQueued")
                : t("doc.readLocal")}
          </Badge>
        )}
        {canEdit && (
          <span className="ml-auto flex gap-1">
            {(page.ocrStatus === "FAILED" || page.ocrStatus === "DONE") && (
              <Button variant="ghost" size="sm" onClick={() => retry.mutate(undefined)} disabled={retry.isPending}>
                <RotateCcw /> {t("doc.retryOcr")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("doc.deletePage")}
              onClick={() => confirm(t("common.confirmDelete")) && remove.mutate(undefined)}
              disabled={remove.isPending}
            >
              <Trash2 />
            </Button>
          </span>
        )}
      </div>
      {page.ocrError && <p className="px-3 pb-2 text-sm text-destructive">{page.ocrError}</p>}
      <details className="border-t px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium">{t("doc.text")}</summary>
        {page.ocrText ? (
          <p lang="mr" className="mt-2 text-sm whitespace-pre-wrap">
            {page.ocrText}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{t("doc.noText")}</p>
        )}
      </details>
    </li>
  );
}

const editForm = z.object({
  type: z.enum(DOC_TYPES),
  year: z.union([z.literal(""), z.string().regex(/^\d{4}$/)]),
  title: z.string(),
  propertyId: z.string(),
});

function EditDocument({ doc, caseId, onDone }: { doc: DocumentDetail; caseId: string; onDone: () => void }) {
  const { t } = useI18n();
  const caseData = useQuery(caseQuery(caseId));
  const f = useForm<z.infer<typeof editForm>>({
    resolver: zodResolver(editForm),
    defaultValues: { type: doc.type, year: doc.year ? String(doc.year) : "", title: doc.title ?? "", propertyId: doc.propertyId ?? "" },
  });
  const save = useApiMutation(
    (v: z.infer<typeof editForm>) =>
      api(`/documents/${doc.id}`, {
        method: "PATCH",
        body: { type: v.type, year: v.year ? Number(v.year) : null, title: orNull(v.title), propertyId: v.propertyId || null },
      }),
    { onSuccess: onDone },
  );
  return (
    <form onSubmit={f.handleSubmit((v) => save.mutate(v))} className="space-y-3" noValidate>
      <Field id="type" label={t("doc.type")}>
        <NativeSelect id="type" {...f.register("type")}>
          {DOC_TYPES.map((d) => (
            <option key={d} value={d}>
              {t(`doctype.${d}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field id="year" label={t("doc.year")} error={f.formState.errors.year}>
          <Input id="year" inputMode="numeric" maxLength={4} {...f.register("year")} />
        </Field>
        <Field id="propertyId" label={t("doc.property")}>
          <NativeSelect id="propertyId" {...f.register("propertyId")}>
            <option value="">{t("doc.noProperty")}</option>
            {caseData.data?.case.properties.map((p) => (
              <option key={p.id} value={p.id}>
                {[p.gatNo && `${t("land.gat")} ${p.gatNo}`, p.surveyNo && `${t("land.survey")} ${p.surveyNo}`, p.village]
                  .filter(Boolean)
                  .join(", ")}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <Field id="title" label={t("doc.name")}>
        <Input id="title" {...f.register("title")} />
      </Field>
      <ErrorBox error={save.error} />
      <FormActions busy={save.isPending} onCancel={onDone} />
    </form>
  );
}

function DocumentPage() {
  const { caseId, documentId } = Route.useParams();
  const { page: focusPage } = Route.useSearch();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: doc, error, isPending, refetch } = useQuery(documentQuery(documentId));
  const caseData = useQuery(caseQuery(caseId));
  const [outline, setOutline] = useState(false);
  const [editing, setEditing] = useState(false);
  const remove = useApiMutation(() => api(`/documents/${documentId}`, { method: "DELETE" }), {
    onSuccess: () => navigate({ to: "/cases/$caseId", params: { caseId } }),
  });

  // Opened from search: jump to the matching page.
  useEffect(() => {
    if (doc && focusPage) document.getElementById(`page-${focusPage}`)?.scrollIntoView({ block: "start" });
  }, [doc, focusPage]);

  if (isPending) return <Loading />;
  if (error || !doc) return <ErrorBox error={error} onRetry={() => refetch()} />;
  const canEdit = caseData.data ? caseData.data.access !== "VIEWER" : false;

  return (
    <>
      <PageHeader
        title={`${doc.title || t(`doctype.${doc.type}`)}${doc.year ? ` · ${doc.year}` : ""}`}
        back={`/cases/${caseId}`}
        action={
          canEdit && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              {t("common.edit")}
            </Button>
          )
        }
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge>{t(`doctype.${doc.type}`)}</Badge>
        <OcrBadge status={doc.ocrStatus} />
        <span className="text-sm text-muted-foreground">
          {doc.pageCount} {t("doc.pages")}
        </span>
        {canEdit && (
          <Button asChild size="sm" className="ml-auto">
            <Link to="/cases/$caseId/scan" params={{ caseId }} search={{ documentId }}>
              <Plus /> {t("doc.addPages")}
            </Link>
          </Button>
        )}
      </div>

      {doc.pages.length > 0 && (
        <label className="mb-3 flex min-h-11 items-start gap-2 text-sm">
          <Checkbox checked={outline} onChange={(e) => setOutline(e.target.checked)} className="mt-0.5" />
          <span>
            <span className="font-medium">{t("doc.lowConfidence")}</span>
            <span className="block text-muted-foreground">{t("doc.lowConfidenceHint")}</span>
          </span>
        </label>
      )}

      {doc.pages.length === 0 ? (
        <Empty />
      ) : (
        <ol className="space-y-4">
          {doc.pages.map((p) => (
            <PageCard key={p.id} documentId={documentId} page={p} outline={outline} canEdit={canEdit} />
          ))}
        </ol>
      )}

      {canEdit && (
        <div className="mt-8">
          <ErrorBox error={remove.error} />
          <Button
            variant="destructive"
            onClick={() => confirm(t("common.confirmDelete")) && remove.mutate(undefined)}
            disabled={remove.isPending}
          >
            <Trash2 /> {t("doc.deleteDoc")}
          </Button>
        </div>
      )}

      <Sheet open={editing} onOpenChange={setEditing} title={t("common.edit")}>
        <EditDocument doc={doc} caseId={caseId} onDone={() => setEditing(false)} />
      </Sheet>
    </>
  );
}
