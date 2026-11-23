import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";

export function LanguageToggle({
  persist = false,
  compact = false,
  onDark = false,
}: {
  persist?: boolean;
  compact?: boolean;
  onDark?: boolean;
}) {
  const { t, locale, setLocale } = useI18n();
  const choose = (l: "mr" | "en") => {
    setLocale(l);
    if (persist) void api("/me", { method: "PATCH", body: { locale: l } }).catch(() => undefined);
  };
  if (compact) {
    // One tap switches to the other language; fits a phone header.
    const other = locale === "mr" ? "en" : "mr";
    return (
      <Button
        variant="ghost"
        size="sm"
        className={cn(onDark && "text-white hover:bg-white/10 hover:text-white")}
        onClick={() => choose(other)}
        lang={other}
        aria-label={other === "en" ? "Switch to English" : "मराठीत बदला"}
      >
        {other === "en" ? "EN" : "मराठी"}
      </Button>
    );
  }
  return (
    <Tabs value={locale} onValueChange={(v) => choose(v as "mr" | "en")}>
      <TabsList aria-label={t("settings.language")}>
        <TabsTrigger value="mr">मराठी</TabsTrigger>
        <TabsTrigger value="en">English</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
