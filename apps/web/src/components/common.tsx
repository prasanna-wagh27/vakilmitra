import { Link } from "@tanstack/react-router";
import { ArrowLeft, Lock } from "lucide-react";
import type { ReactNode } from "react";
import type { FieldError } from "react-hook-form";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

export function PageHeader({ title, back, action, eyebrow }: { title: string; back?: string; action?: ReactNode; eyebrow?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="mb-8">
      {/* With a back link, the back link and actions sit on their own row so the title gets the full width. */}
      {back && (
        <div className="mb-5 flex min-h-9 items-center justify-between gap-3">
          <Link to={back} aria-label={t("common.back")} className="icon-btn size-9 shrink-0">
            <ArrowLeft className="size-[18px]" />
          </Link>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="label-mono mb-2">{eyebrow}</div>}
          <h1 className="font-display line-clamp-3 text-[2rem] leading-[1.1] break-words">{title}</h1>
        </div>
        {!back && action}
      </div>
    </div>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl leading-[1.25]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return <p className="border-y py-5 text-[15px] text-muted-foreground">{children ?? t("common.none")}</p>;
}

/** Loading placeholder: grey bars shaped like a list, instead of a "Loading…" line. */
export function Loading({ rows = 3 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-label={t("common.loading")} className="list">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="py-4">
          <div className="skeleton h-4 w-3/5" />
          <div className="skeleton mt-2 h-3 w-2/5" />
        </div>
      ))}
    </div>
  );
}

/** Quiet privacy line, shown where trust matters (home, login). */
export function TrustLine({ className }: { className?: string }) {
  const { t } = useI18n();
  return (
    <p className={`label-mono flex items-start gap-2 text-[12px] ${className ?? ""}`}>
      <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>{t("trust.line")}</span>
    </p>
  );
}

const DOC_ABBR: Record<string, string> = {
  SEVEN_TWELVE: "7/12",
  FERFAR: "FER",
  EIGHT_A: "8A",
  INDEX_II: "IDX",
  SALE_DEED: "SALE",
  GIFT_DEED: "GIFT",
  WILL: "WILL",
  PARTITION_DEED: "PART",
  MORTGAGE_DEED: "MORT",
  COURT_ORDER: "ORD",
  OTHER: "DOC",
};

/** Document-type tile: a bordered square with a mono abbreviation. */
export function DocTile({ type }: { type: string }) {
  const abbr = DOC_ABBR[type] ?? type.replace(/_/g, " ").slice(0, 4);
  return (
    <span className="doc-tile" aria-hidden>
      {abbr}
    </span>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n();
  if (!error) return null;
  const message = error instanceof Error ? error.message : t("common.error");
  const details = error instanceof ApiError ? error.details : undefined;
  return (
    <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive-soft px-4 py-3 text-[15px] text-destructive">
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
      className={`h-9 shrink-0 rounded-lg border px-3 text-[15px] transition-colors ${active ? "border-border bg-card text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
