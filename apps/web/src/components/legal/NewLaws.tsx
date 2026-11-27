import { Search01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import {
  LAW_CODES,
  LAW_NAMES,
  LAW_TABLES,
  type LawCode,
  type LawMatch,
  type LawSection,
  searchLawCodes,
} from "@vakilmitra/shared/law-codes";
import { useMemo } from "react";
import { fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { PublicPage } from "./LegalPage";

const SOURCES: Record<LawCode, string> = {
  bns: "https://keralaprisons.gov.in/userfiles/act-and-rules/comparison_summary_BNS_to_IPC.pdf",
  bnss: "https://keralaprisons.gov.in/userfiles/act-and-rules/comparison_summary_BNSS_to_CrPC.pdf",
  bsa: "https://keralaprisons.gov.in/userfiles/act-and-rules/comparison_summary_BSA_to_IEA.pdf",
};

/** One correspondence: old section(s) → new section, and the heading. */
function Row({ code, row, showCode }: { code: LawCode; row: LawSection; showCode?: boolean }) {
  const { t } = useI18n();
  const names = LAW_NAMES[code];
  return (
    <li className="grid grid-cols-[minmax(0,7rem)_minmax(0,8rem)_1fr] items-baseline gap-x-3 gap-y-1 px-4 py-3 max-sm:grid-cols-2">
      <span className="text-sm">
        {row.old ? (
          <>
            <span className="text-muted-foreground">{names.oldShort} </span>
            <span className="font-medium">{row.old}</span>
          </>
        ) : (
          <Badge variant="outline">{t("laws.new")}</Badge>
        )}
      </span>
      <span className="text-sm">
        <span className="text-muted-foreground">→ {names.short} </span>
        <span className="font-semibold">{row.section}</span>
        {showCode && <span className="sr-only"> ({names.short})</span>}
      </span>
      <span lang="en" className="text-sm text-muted-foreground max-sm:col-span-2">
        {row.title}
      </span>
    </li>
  );
}

function Table({ code, rows }: { code: LawCode; rows: LawSection[] }) {
  const { t } = useI18n();
  return (
    <section className="mt-8">
      <h2 className="font-heading text-lg font-semibold">{t(`laws.code.${code}`)}</h2>
      <ul className="mt-3 divide-y rounded-xl border">
        {rows.map((row) => (
          <Row key={row.section} code={code} row={row} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Free public lookup of old to new criminal law sections, prebuilt as a whole page so search
 * engines find "IPC 420 in BNS". The search box filters as the advocate types; the address keeps
 * the search (?q=420), so a result can be shared.
 */
export function NewLawsPage({
  q,
  code,
  onChange,
}: {
  q: string;
  code: LawCode | undefined;
  onChange: (next: { q?: string; code?: LawCode }) => void;
}) {
  const { t, tf, locale } = useI18n();
  const matches: LawMatch[] = useMemo(() => searchLawCodes(q, code), [q, code]);
  const searching = q.trim().length > 0;
  const shown = code ? [code] : LAW_CODES;

  return (
    <PublicPage title={t("laws.title")}>
      <p className="mt-3 max-w-3xl text-muted-foreground">{t("laws.intro")}</p>

      <div className="sticky top-0 z-10 -mx-4 mt-6 bg-background/95 px-4 py-3 backdrop-blur">
        <label htmlFor="law-search" className="mb-2 block text-sm font-medium">
          {t("laws.search")}
        </label>
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="law-search"
            type="search"
            value={q}
            onChange={(e) => onChange({ q: e.target.value, code })}
            placeholder={t("laws.placeholder")}
            autoComplete="off"
            className="pl-9"
          />
        </div>
        <fieldset className="mt-3 flex flex-wrap gap-2">
          <legend className="sr-only">{t("laws.filter")}</legend>
          {([undefined, ...LAW_CODES] as const).map((c) => (
            <button
              key={c ?? "all"}
              type="button"
              aria-pressed={code === c}
              onClick={() => onChange({ q, code: c })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                code === c ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              {c ? t(`laws.tab.${c}`) : t("laws.all")}
            </button>
          ))}
        </fieldset>
      </div>

      {searching ? (
        <section className="mt-4" aria-live="polite">
          <p className="text-sm text-muted-foreground">
            {matches.length === 1
              ? t("laws.countOne")
              : matches.length
                ? tf("laws.count", { n: fmtNumber(matches.length, locale) })
                : t("laws.none")}
          </p>
          {matches.length > 0 && (
            <ul className="mt-3 divide-y rounded-xl border">
              {matches.slice(0, 200).map((m) => (
                <Row key={`${m.code}-${m.row.section}-${m.by}`} code={m.code} row={m.row} showCode />
              ))}
            </ul>
          )}
        </section>
      ) : (
        shown.map((c) => <Table key={c} code={c} rows={LAW_TABLES[c]} />)
      )}

      <p className="mt-6 text-sm text-muted-foreground">{t("laws.headings")}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("laws.source")} {t("laws.sourceLink")}:{" "}
        {LAW_CODES.map((c, i) => (
          <span key={c}>
            {i > 0 && ", "}
            <a href={SOURCES[c]} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-4">
              {LAW_NAMES[c].short}
            </a>
          </span>
        ))}
      </p>

      <div className="mt-10 rounded-2xl bg-muted/60 p-6">
        <h2 className="font-heading text-lg font-semibold">{t("laws.ctaTitle")}</h2>
        <p className="mt-1 text-muted-foreground">{t("laws.ctaText")}</p>
        <Button asChild className="mt-4">
          <Link to="/register">{t("legal.startTrial")}</Link>
        </Button>
      </div>
    </PublicPage>
  );
}
