import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export function LanguageToggle({
  persist = false,
  compact = false,
  onDark = false,
}: {
  persist?: boolean;
  compact?: boolean;
  onDark?: boolean;
}) {
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
        className={`inline-flex h-8 items-center rounded-md px-2.5 text-sm ${onDark ? "bg-white/12 text-white hover:bg-white/20" : "bg-muted hover:bg-border"}`}
      >
        {other === "en" ? "EN" : "मराठी"}
      </button>
    );
  }
  return (
    <fieldset className="inline-flex gap-1 text-sm">
      <legend className="sr-only">Language</legend>
      {(["mr", "en"] as const).map((l) => (
        <button
          type="button"
          key={l}
          onClick={() => choose(l)}
          aria-pressed={locale === l}
          className={`h-9 rounded-lg border px-3 ${locale === l ? "border-border bg-card text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          {l === "mr" ? "मराठी" : "English"}
        </button>
      ))}
    </fieldset>
  );
}
