import { AlertCircleIcon, ArrowLeft01Icon, InboxIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { FieldError } from "react-hook-form";
import { ApiError } from "@/lib/api";
import { errorText } from "@/lib/errors";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { EmptyDescription, EmptyHeader, EmptyMedia, Empty as EmptyRoot } from "./ui/empty";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";

/** Page title with an optional back link, description and actions. */
export function PageHeader({
  title,
  back,
  action,
  eyebrow,
  description,
}: {
  title: string;
  back?: string;
  action?: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="mb-8">
      {back && (
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3 text-muted-foreground">
          <Link to={back}>
            <HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
            {t("common.back")}
          </Link>
        </Button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-1 text-sm text-muted-foreground">{eyebrow}</div>}
          <h1 className="font-display text-[1.75rem] leading-tight md:text-[2rem] break-words">{title}</h1>
          {description && <p className="mt-2 text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </div>
    </div>
  );
}

/** A titled block of a page. */
export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Empty state: dashed box with an icon and a short line. */
export function Empty({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return (
    <EmptyRoot className="rounded-xl border border-dashed bg-muted/40 py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <HugeiconsIcon icon={InboxIcon} />
        </EmptyMedia>
        <EmptyDescription>{children ?? t("common.none")}</EmptyDescription>
      </EmptyHeader>
    </EmptyRoot>
  );
}

/** Loading placeholder shaped like a list. */
export function Loading({ rows = 3 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t("common.loading")} className="flex flex-col gap-3 rounded-xl p-4 ring-1 ring-foreground/10">
      {Array.from({ length: rows }, (_, i) => (
        <div key={`s${i}`} className="flex items-center gap-3">
          <Skeleton className="size-9 rounded-md" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t, locale } = useI18n();
  if (!error) return null;
  const message = errorText(error, locale, t("common.error"));
  // Field-level details are English from the server: shown only to English readers.
  const details = error instanceof ApiError && locale === "en" && Array.isArray(error.details) ? error.details : undefined;
  return (
    <Alert variant="destructive" className="my-3">
      <HugeiconsIcon icon={AlertCircleIcon} />
      <AlertDescription>
        <p>{message}</p>
        {details?.map((d) => (
          <p key={d.path}>
            {d.path}: {d.message}
          </p>
        ))}
        {onRetry && (
          <button type="button" className="mt-1 underline underline-offset-4" onClick={onRetry}>
            {t("common.retry")}
          </button>
        )}
      </AlertDescription>
    </Alert>
  );
}

/** Label + control + hint/error, wired for screen readers. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: FieldError;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error.message || t("common.required")}</p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function FormActions({ busy, onCancel, submitLabel }: { busy?: boolean; onCancel?: () => void; submitLabel?: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-6 flex gap-2">
      {onCancel && (
        <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      )}
      <Button type="submit" size="lg" className="flex-1" disabled={busy}>
        {submitLabel ?? t("common.save")}
      </Button>
    </div>
  );
}

/** Toggle chip for filters and day pickers. */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "shrink-0 rounded-xl",
        active ? "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand" : "text-muted-foreground",
      )}
    >
      {children}
    </Button>
  );
}
