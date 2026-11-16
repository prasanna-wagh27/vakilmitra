"use client";
import { useI18n } from "@/lib/i18n";
import { api } from "@/lib/api";

export function LanguageToggle({ persist = false }: { persist?: boolean }) {
  const { locale, setLocale } = useI18n();
  const choose = (l: "mr" | "en") => {
    setLocale(l);
    if (persist) void api("/auth/me", { method: "PATCH", body: { locale: l } }).catch(() => undefined);
  };
  return (
    <div className="surface inline-flex rounded-full border p-0.5 text-sm" role="group" aria-label="Language">
      {(["mr", "en"] as const).map((l) => (
        <button
          key={l}
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          className={`min-h-9 rounded-full px-3 ${locale === l ? "bg-brand-600 text-white" : ""}`}
        >
          {l === "mr" ? "मराठी" : "English"}
        </button>
      ))}
    </div>
  );
}
