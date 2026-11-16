"use client";
import Link from "next/link";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { ApiError } from "@/lib/api";

type Variant = "primary" | "secondary" | "danger" | "ghost";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-60",
  secondary: "surface border hover:brightness-95",
  danger: "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60",
  ghost: "hover:bg-black/5 dark:hover:bg-white/5",
};

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...p} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-medium transition ${variants[variant]} ${className}`} />;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`surface rounded-2xl border p-4 ${className}`}>{children}</div>;
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

export function PageHeader({ title, back, action }: { title: string; back?: string; action?: ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="mb-4 flex items-center gap-2">
      {back && (
        <Link href={back} aria-label={t("common.back")} className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5">
          <span aria-hidden className="text-xl">←</span>
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{title}</h1>
      {action}
    </div>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="muted mt-1 block text-xs">{hint}</span>}
    </label>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "red" | "amber" | "green" | "blue" }) {
  const tones = {
    neutral: "bg-black/5 dark:bg-white/10",
    red: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    amber: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
    green: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200",
    blue: "bg-brand-100 text-brand-900 dark:bg-brand-900 dark:text-brand-100",
  };
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function Empty({ children }: { children?: ReactNode }) {
  const { t } = useI18n();
  return <p className="muted rounded-2xl border border-dashed hairline p-6 text-center text-sm">{children ?? t("common.none")}</p>;
}

export function Loading() {
  const { t } = useI18n();
  return <p className="muted p-6 text-center text-sm">{t("common.loading")}</p>;
}

export function ErrorBox({ error, onRetry }: { error: Error | null; onRetry?: () => void }) {
  const { t } = useI18n();
  if (!error) return null;
  const details = error instanceof ApiError ? error.details : undefined;
  return (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
      <p>{error.message || t("common.error")}</p>
      {details?.map((d) => <p key={d.path}>{d.path}: {d.message}</p>)}
      {onRetry && <button className="mt-1 underline" onClick={onRetry}>{t("common.retry")}</button>}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog on desktop. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal
        aria-label={title}
        className="surface max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function FormActions({ busy, onCancel, submitLabel }: { busy?: boolean; onCancel?: () => void; submitLabel?: string }) {
  const { t } = useI18n();
  return (
    <div className="mt-4 flex gap-2">
      {onCancel && <Button type="button" variant="secondary" className="flex-1" onClick={onCancel}>{t("common.cancel")}</Button>}
      <Button type="submit" className="flex-1" disabled={busy}>{submitLabel ?? t("common.save")}</Button>
    </div>
  );
}
