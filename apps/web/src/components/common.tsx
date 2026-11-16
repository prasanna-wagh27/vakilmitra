import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import type { FieldError } from "react-hook-form";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link
          to={back}
          aria-label={t("common.back")}
          className="-ml-2 flex size-11 items-center justify-center rounded-full hover:bg-muted"
        >
          <ArrowLeft className="size-5" />
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
      {action}
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{children ?? t("common.none")}</p>;
}

export function Loading() {
  const { t } = useI18n();
  return <p className="p-6 text-center text-sm text-muted-foreground">{t("common.loading")}</p>;
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  if (!error) return null;
  const message = error instanceof Error ? error.message : t("common.error");
  const details = error instanceof ApiError ? error.details : undefined;
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive-soft p-3 text-sm text-destructive">
      <p>{message}</p>
      {details?.map((d) => (
        <p key={d.path}>
          {d.path}: {d.message}
        </p>
      ))}
      {onRetry && (
        <button type="button" className="mt-1 underline" onClick={onRetry}>
          {t("common.retry")}
        </button>
      )}
    </div>
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
    <div>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-destructive">{error.message || t("common.required")}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export function FormActions({ busy, onCancel, submitLabel }: { busy?: boolean; onCancel?: () => void; submitLabel?: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-4 flex gap-2">
      {onCancel && (
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
      )}
      <Button type="submit" className="flex-1" disabled={busy}>
        {submitLabel ?? t("common.save")}
      </Button>
    </div>
  );
}

/** Chip-style toggle used for filters and day pickers. */
export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-10 shrink-0 rounded-full border px-4 text-sm ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
    >
      {children}
    </button>
  );
}
