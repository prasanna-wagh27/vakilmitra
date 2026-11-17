import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertCircleIcon,
  Camera01Icon,
  Cancel01Icon,
  FileUploadIcon,
  Image02Icon,
  Loading03Icon,
  RotateLeft01Icon,
  ScanIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DOC_TYPES, type DocumentSummary } from "@vakilmitra/shared";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ErrorBox, Field } from "@/components/common";
import { CornerEditor } from "@/components/scanner/CornerEditor";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { api } from "@/lib/api";
import { orNull } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { caseQuery, documentQuery } from "@/lib/queries";
import { capture, openCamera, stopCamera } from "@/lib/scanner/camera";
import { defaultQuad, type Quad } from "@/lib/scanner/geometry";
import { canvasToJpeg, fileToCanvas, thumbnail } from "@/lib/scanner/image";
import { type CV, cropToBox, detectPage, loadOpenCv, warpPage } from "@/lib/scanner/opencv";
import { renderPdf } from "@/lib/scanner/pdf";
import { uploadPage } from "@/lib/scanner/upload";
import { UploadQueue } from "@/lib/scanner/upload-queue";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/cases/$caseId/scan")({
  validateSearch: z.object({ documentId: z.string().optional(), mode: z.enum(["camera", "upload"]).optional() }),
  component: ScanPage,
});

type Phase = "setup" | "capture" | "review" | "finishing";
interface Review {
  canvas: HTMLCanvasElement;
  quad: Quad;
  detected: boolean;
}

const setupForm = z.object({
  type: z.enum(DOC_TYPES),
  year: z.union([z.literal(""), z.string().regex(/^\d{4}$/)]),
  title: z.string(),
  propertyId: z.string(),
});

function ScanPage() {
  const { caseId } = Route.useParams();
  const { documentId: existingId, mode = "camera" } = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, tf } = useI18n();

  const [documentId, setDocumentId] = useState<string | null>(existingId ?? null);
  const [phase, setPhase] = useState<Phase>(existingId ? "capture" : "setup");
  const existing = useQuery({ ...documentQuery(existingId ?? ""), enabled: !!existingId });
  const nextPageNo = useRef(1);
  useEffect(() => {
    // Never go backwards: the document refetches while pages are queued, and a smaller number
    // would make the next capture replace a page that is already there.
    if (existing.data) nextPageNo.current = Math.max(nextPageNo.current, Math.max(0, ...existing.data.pages.map((p) => p.pageNo)) + 1);
  }, [existing.data]);

  // ---- background uploads ----
  const docIdRef = useRef(documentId);
  docIdRef.current = documentId;
  const [queue] = useState(() => new UploadQueue((item) => uploadPage(docIdRef.current!, item.pageNo, item.blob)));
  const items = useSyncExternalStore(queue.subscribe, queue.getSnapshot);
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed");
  const allSettled = items.length > 0 && queue.settled;
  // Adding to an existing document: wait for its pages so numbering continues after them.
  const numberingReady = !existingId || existing.isSuccess;

  // ---- edge detection (loaded in the background) ----
  // The OpenCV module is a thenable: keep it in a ref, never in React state or a resolved promise.
  const cvRef = useRef<CV | null>(null);
  const [cvState, setCvState] = useState<"loading" | "ready" | "failed">("loading");
  useEffect(() => {
    loadOpenCv().then(
      ({ cv }) => {
        cvRef.current = cv;
        setCvState("ready");
      },
      () => setCvState("failed"),
    );
  }, []);

  // ---- camera: kept running between captures, stopped when leaving ----
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState(false);
  const cameraWanted = mode === "camera" && (phase === "capture" || phase === "review");
  useEffect(() => {
    if (!cameraWanted || streamRef.current || !videoRef.current) return;
    let cancelled = false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError(true);
      return;
    }
    openCamera(videoRef.current).then(
      (s) => {
        if (cancelled) stopCamera(s);
        else streamRef.current = s;
      },
      () => setCamError(true),
    );
    return () => {
      cancelled = true;
    };
  }, [cameraWanted]);
  useEffect(
    () => () => {
      stopCamera(streamRef.current);
      for (const i of queue.getSnapshot()) URL.revokeObjectURL(i.thumbUrl);
    },
    [queue],
  );

  // ---- warn before losing pages that are not uploaded yet ----
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (queue.pending) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [queue]);

  // ---- review: corners for one image at a time ----
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [pdfProgress, setPdfProgress] = useState<{ n: number; total: number } | null>(null);
  const toReview = useRef<HTMLCanvasElement[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const startReview = useCallback((canvas: HTMLCanvasElement) => {
    const cv = cvRef.current;
    const detected = cv ? detectPage(cv, canvas) : null;
    setReview({ canvas, quad: detected ?? defaultQuad(canvas.width, canvas.height), detected: !!detected });
    setPhase("review");
  }, []);

  function nextOrCapture() {
    const n = toReview.current.shift();
    if (n) startReview(n);
    else {
      setReview(null);
      setPhase("capture");
    }
  }

  async function addPage(canvas: HTMLCanvasElement) {
    if (!numberingReady) throw new Error(t("common.loading"));
    const [blob, thumb] = await Promise.all([canvasToJpeg(canvas), thumbnail(canvas)]);
    queue.add(nextPageNo.current++, blob, thumb);
  }

  async function onCapture() {
    if (!streamRef.current || !videoRef.current || busy || !numberingReady) return;
    setBusy(true);
    try {
      startReview(await capture(streamRef.current, videoRef.current));
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function keep(whole: boolean) {
    if (!review || busy) return;
    setBusy(true);
    try {
      const { canvas, quad } = review;
      const cv = cvRef.current;
      const page = whole ? canvas : cv ? warpPage(cv, canvas, quad) : cropToBox(canvas, quad);
      await addPage(page);
      nextOrCapture();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length || !numberingReady) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        if (f.type === "application/pdf") {
          // PDFs are already flat pages: upload each page directly.
          await renderPdf(f, async (canvas, n, total) => {
            setPdfProgress({ n, total });
            await addPage(canvas);
          });
          setPdfProgress(null);
        } else if (f.type.startsWith("image/")) {
          toReview.current.push(await fileToCanvas(f));
        }
      }
      if (!review) nextOrCapture();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      setPdfProgress(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  // ---- finishing: wait for uploads, then open the document ----
  useEffect(() => {
    if (phase !== "finishing" || !documentId || !allSettled || failed.length) return;
    void qc.invalidateQueries({ queryKey: ["documents", caseId] });
    void qc.invalidateQueries({ queryKey: ["document", documentId] });
    void navigate({ to: "/cases/$caseId/documents/$documentId", params: { caseId, documentId }, replace: true });
  }, [phase, documentId, allSettled, failed.length, qc, caseId, navigate]);

  function close() {
    if (queue.pending && !confirm(t("doc.leaveWarning"))) return;
    void navigate({ to: "/cases/$caseId", params: { caseId } });
  }

  // ---- setup ----
  const caseData = useQuery(caseQuery(caseId));
  const f = useForm<z.infer<typeof setupForm>>({
    resolver: zodResolver(setupForm),
    defaultValues: { type: "SEVEN_TWELVE", year: "", title: "", propertyId: "" },
  });
  async function createDocument(v: z.infer<typeof setupForm>) {
    setError(null);
    try {
      const r = await api<{ document: DocumentSummary }>(`/cases/${caseId}/documents`, {
        body: {
          type: v.type,
          year: v.year ? Number(v.year) : null,
          title: orNull(v.title),
          propertyId: v.propertyId || null,
          source: mode === "camera" ? "scan" : "upload",
        },
      });
      setDocumentId(r.document.id);
      setPhase("capture");
    } catch (e) {
      setError(e);
    }
  }

  const statusLine =
    items.length === 0
      ? null
      : done === items.length
        ? t("doc.uploaded")
        : tf("doc.uploading", { n: Math.min(done + 1, items.length), total: items.length });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      <div className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
        <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" aria-label={t("common.cancel")} onClick={close}>
          <HugeiconsIcon icon={Cancel01Icon} className="size-6!" />
        </Button>
        <p className="flex-1 truncate text-sm" aria-live="polite">
          {pdfProgress
            ? tf("doc.renderingPdf", pdfProgress)
            : (statusLine ?? (cvState === "loading" && phase !== "setup" ? t("doc.preparing") : ""))}
        </p>
        {phase !== "setup" && phase !== "finishing" && items.length > 0 && (
          <Button className="bg-white text-black hover:bg-white/90" onClick={() => setPhase("finishing")} disabled={busy}>
            <HugeiconsIcon icon={Tick02Icon} /> {t("doc.done")}
          </Button>
        )}
      </div>

      <div className="relative min-h-0 flex-1">
        {/* Kept mounted so the camera keeps running while reviewing. */}
        {mode === "camera" && (
          <video
            ref={videoRef}
            className={cn("absolute inset-0 h-full w-full object-contain", phase !== "capture" && "invisible")}
            playsInline
            muted
          />
        )}

        {phase === "setup" && (
          <div className="absolute inset-0 overflow-y-auto bg-background p-4 text-foreground">
            <form onSubmit={f.handleSubmit(createDocument)} className="mx-auto max-w-md space-y-3" noValidate>
              <h1 className="font-display text-2xl">{mode === "camera" ? t("doc.scan") : t("doc.upload")}</h1>
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
                <Field id="year" label={`${t("doc.year")} (${t("common.optional")})`} error={f.formState.errors.year}>
                  <Input id="year" inputMode="numeric" maxLength={4} placeholder="2025" {...f.register("year")} />
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
              <Field id="title" label={`${t("doc.name")} (${t("common.optional")})`}>
                <Input id="title" {...f.register("title")} />
              </Field>
              <p className="rounded-xl bg-muted p-3 text-sm text-primary">{t("doc.privacyNote")}</p>
              <ErrorBox error={error} />
              <Button type="submit" className="w-full" disabled={f.formState.isSubmitting}>
                {mode === "camera" ? <HugeiconsIcon icon={ScanIcon} /> : <HugeiconsIcon icon={FileUploadIcon} />}{" "}
                {mode === "camera" ? t("doc.start") : t("doc.upload")}
              </Button>
            </form>
          </div>
        )}

        {phase === "capture" && (mode === "upload" || camError) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {camError && <p className="max-w-sm text-sm text-white/80">{t("doc.cameraDenied")}</p>}
            <Button
              className="bg-white text-black hover:bg-white/90"
              onClick={() => fileInput.current?.click()}
              disabled={busy || !numberingReady}
            >
              <HugeiconsIcon icon={FileUploadIcon} /> {mode === "upload" ? t("doc.upload") : t("doc.choosePhotos")}
            </Button>
            {busy && <HugeiconsIcon icon={Loading03Icon} className="size-6 animate-spin" />}
          </div>
        )}

        {phase === "review" && review && (
          <div className="absolute inset-0 flex flex-col p-2">
            <p className="pb-2 text-center text-sm text-white/80">{t("doc.adjustHint")}</p>
            <div className="min-h-0 flex-1">
              <CornerEditor
                label={t("doc.adjustHint")}
                canvas={review.canvas}
                quad={review.quad}
                onChange={(quad) => setReview({ ...review, quad })}
              />
            </div>
          </div>
        )}

        {phase === "finishing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            {failed.length ? (
              <HugeiconsIcon icon={AlertCircleIcon} className="size-10 text-destructive" />
            ) : (
              <HugeiconsIcon icon={Loading03Icon} className="size-10 animate-spin" />
            )}
            <p aria-live="polite">{statusLine}</p>
            {failed.length > 0 && (
              <Button
                className="bg-white text-black hover:bg-white/90"
                onClick={() => {
                  for (const i of failed) queue.retry(i.key);
                }}
              >
                <HugeiconsIcon icon={RotateLeft01Icon} /> {t("common.retry")}
              </Button>
            )}
          </div>
        )}
      </div>

      {error != null && phase !== "setup" && (
        <div className="px-3 pb-2">
          <ErrorBox error={error} />
        </div>
      )}

      {phase !== "setup" && items.length > 0 && (
        <ol className="flex gap-2 overflow-x-auto px-3 pb-2" aria-label={t("doc.pages")}>
          {items.map((i) => (
            <li key={i.key} className="relative shrink-0">
              <button
                type="button"
                disabled={i.status !== "failed"}
                onClick={() => queue.retry(i.key)}
                className="block"
                aria-label={`${t("doc.page")} ${i.pageNo}${i.status === "failed" ? ` — ${t("doc.uploadFailed")}` : ""}`}
              >
                <img
                  src={i.thumbUrl}
                  alt=""
                  className={cn("h-16 w-12 rounded-md object-cover", i.status === "failed" && "ring-2 ring-destructive")}
                />
                <span className="absolute right-0.5 bottom-0.5 rounded-full bg-black/70 p-0.5">
                  {i.status === "done" ? (
                    <HugeiconsIcon icon={Tick02Icon} className="size-3 text-green-400" />
                  ) : i.status === "failed" ? (
                    <HugeiconsIcon icon={RotateLeft01Icon} className="size-3 text-red-400" />
                  ) : (
                    <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
                  )}
                </span>
                <span className="absolute top-0.5 left-1 text-[10px] font-bold drop-shadow">{i.pageNo}</span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {phase === "capture" && mode === "camera" && !camError && (
        <div className="flex items-center justify-around px-6 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <Button
            variant="ghost"
            size="icon"
            className="size-14 text-white hover:bg-white/10"
            aria-label={t("doc.choosePhotos")}
            onClick={() => fileInput.current?.click()}
            disabled={busy || !numberingReady}
          >
            <HugeiconsIcon icon={Image02Icon} className="size-7!" />
          </Button>
          <button
            type="button"
            onClick={onCapture}
            disabled={busy || !numberingReady}
            aria-label={t("doc.capture")}
            className="flex size-20 items-center justify-center rounded-full border-4 border-white bg-white/20 active:scale-95 disabled:opacity-50"
          >
            {busy ? (
              <HugeiconsIcon icon={Loading03Icon} className="size-8 animate-spin" />
            ) : (
              <HugeiconsIcon icon={Camera01Icon} className="size-8" />
            )}
          </button>
          <span className="size-14" />
        </div>
      )}

      {phase === "review" && (
        <div className="grid grid-cols-3 gap-2 px-3 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={nextOrCapture} disabled={busy}>
            <HugeiconsIcon icon={RotateLeft01Icon} /> {t("doc.retake")}
          </Button>
          <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => keep(true)} disabled={busy}>
            {t("doc.wholePage")}
          </Button>
          <Button className="bg-white text-black hover:bg-white/90" onClick={() => keep(false)} disabled={busy}>
            {busy ? <HugeiconsIcon icon={Loading03Icon} className="animate-spin" /> : <HugeiconsIcon icon={Tick02Icon} />} {t("doc.keep")}
          </Button>
        </div>
      )}

      {/* Files picker: no `capture` attribute, so nothing is ever saved to the gallery from here. */}
      <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => void onFiles(e.target.files)} />
    </div>
  );
}
