import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle({ persist = false }: { persist?: boolean }) {
  const { locale, setLocale } = useI18n();
  const choose = (l: "mr" | "en") => {
    setLocale(l);
    if (persist) void api("/me", { method: "PATCH", body: { locale: l } }).catch(() => undefined);
  };
  return (
    <fieldset className="inline-flex rounded-full border bg-card p-0.5 text-sm">
      <legend className="sr-only">Language</legend>
      {(["mr", "en"] as const).map((l) => (
        <button
          type="button"
          key={l}
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          className={`min-h-9 rounded-full px-3 ${locale === l ? "bg-primary text-primary-foreground" : ""}`}
        >
          {l === "mr" ? "मराठी" : "English"}
        </button>
      ))}
    </fieldset>
  );
}
