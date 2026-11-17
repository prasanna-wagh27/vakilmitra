import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle({ persist = false, compact = false }: { persist?: boolean; compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  const choose = (l: "mr" | "en") => {
    setLocale(l);
    if (persist) void api("/me", { method: "PATCH", body: { locale: l } }).catch(() => undefined);
  };
  if (compact) {
    // One tap switches to the other language; fits a phone header.
    const other = locale === "mr" ? "en" : "mr";
    return (
      <button
        type="button"
        onClick={() => choose(other)}
        lang={other}
        aria-label={other === "en" ? "Switch to English" : "मराठीत बदला"}
        className="inline-flex h-9 items-center rounded-md px-2.5 text-sm font-medium hover:bg-muted"
      >
        {other === "en" ? "EN" : "मराठी"}
      </button>
    );
  }
  return (
    <fieldset className="inline-flex rounded-md border border-input bg-card p-0.5 text-sm">
      <legend className="sr-only">Language</legend>
      {(["mr", "en"] as const).map((l) => (
        <button
          type="button"
          key={l}
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          className={`h-8 rounded-[4px] px-3 font-medium ${locale === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l === "mr" ? "मराठी" : "English"}
        </button>
      ))}
    </fieldset>
  );
}
