import { ChevronDown } from "lucide-react";
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
    // Libra-style language chip: the current language, with a small chevron.
    return (
      <label
        className={`relative inline-flex h-8 items-center rounded-md ${onDark ? "bg-white/12 text-white" : "bg-muted text-foreground"}`}
      >
        <span className="sr-only">Language</span>
        <select
          value={locale}
          onChange={(e) => choose(e.target.value as "mr" | "en")}
          className="h-8 cursor-pointer appearance-none bg-transparent pr-7 pl-2.5 text-[15px] outline-none"
        >
          <option value="mr" className="text-foreground">
            मराठी
          </option>
          <option value="en" className="text-foreground">
            EN
          </option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 size-3.5 opacity-80" aria-hidden />
      </label>
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
