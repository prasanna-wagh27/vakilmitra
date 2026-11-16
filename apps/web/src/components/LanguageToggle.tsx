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
        className="icon-ring h-10 px-3.5 text-sm font-medium hover:bg-muted"
      >
        {other === "en" ? "EN" : "मराठी"}
      </button>
    );
  }
  return (
    <fieldset className="inline-flex rounded-full border bg-card p-1 text-sm shadow-[0_1px_2px_rgb(17_17_20/0.05)]">
      <legend className="sr-only">Language</legend>
      {(["mr", "en"] as const).map((l) => (
        <button
          type="button"
          key={l}
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          className={`min-h-9 rounded-full px-3.5 font-medium ${locale === l ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {l === "mr" ? "मराठी" : "English"}
        </button>
      ))}
    </fieldset>
  );
}
