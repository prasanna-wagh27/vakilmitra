/**
 * Still pictures of the product for the home page, drawn with HTML in the reader's language
 * (no screenshots, so they never go stale or mix languages). All hidden from screen readers.
 */
import {
  Alert02Icon,
  Camera01Icon,
  CheckmarkBadge01Icon,
  CheckmarkCircle02Icon,
  DocumentValidationIcon,
  Link04Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { addDays, istDate } from "@vakilmitra/shared";
import type { ReactNode } from "react";
import { Brand } from "@/components/Brand";
import { fmtDate, fmtNumber } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** The cases list with a 7/12 detail card laid over it. */
export function CasesMock() {
  const { t, locale } = useI18n();
  const today = istDate();
  const day = (n: number) => fmtDate(addDays(today, n), locale, { day: "numeric", month: "short" });
  const rows: { c: number; court: MessageKey; next: string | null; stage: number | null }[] = [
    { c: 1, court: "home.mock.courtCivil", next: day(0), stage: 1 },
    { c: 2, court: "home.mock.courtFamily", next: day(0), stage: 2 },
    { c: 3, court: "home.mock.courtSessions", next: day(1), stage: 3 },
    { c: 4, court: "home.mock.courtCivil", next: null, stage: null },
    { c: 5, court: "home.mock.courtCivil", next: day(6), stage: 4 },
  ];
  return (
    <div aria-hidden className="relative mx-auto max-w-4xl sm:pb-10">
      <div className="overflow-hidden rounded-2xl bg-card shadow-xl ring-1 ring-foreground/10">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Brand compact />
          <span className="font-medium">{t("home.mock.cases")}</span>
          <span className="ms-auto rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground tabular-nums">
            {fmtNumber(rows.length, locale)}
          </span>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="px-4 py-2 font-medium">{t("home.mock.case")}</th>
              <th className="hidden px-4 py-2 font-medium sm:table-cell">{t("home.mock.court")}</th>
              <th className="px-4 py-2 font-medium">{t("home.mock.next")}</th>
              <th className="hidden px-4 py-2 font-medium md:table-cell">{t("home.mock.stage")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.c} className={cn("border-b last:border-0", r.c === 1 && "bg-amber-50")}>
                <td className="px-4 py-2.5 font-medium">{t(`home.mock.case${r.c}` as MessageKey)}</td>
                <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">{t(r.court)}</td>
                <td className="px-4 py-2.5 tabular-nums">
                  {r.next ?? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      <HugeiconsIcon icon={Alert02Icon} className="size-3" />
                      {t("home.mock.noDate")}
                    </span>
                  )}
                </td>
                <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                  {r.stage ? t(`home.mock.stage${r.stage}` as MessageKey) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* The detail card, overlapping the list like a panel opened from it. */}
      <div className="relative mx-3 -mt-6 rotate-1 rounded-2xl bg-card p-4 shadow-2xl ring-1 ring-foreground/10 sm:absolute sm:top-1/2 sm:-right-6 sm:mx-0 sm:mt-0 sm:w-[19rem] md:-right-12">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <HugeiconsIcon icon={DocumentValidationIcon} className="size-4" />
          </span>
          <p className="text-sm font-semibold">{t("home.mock.factTitle")}</p>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">{t("home.mock.survey")}</dt>
          <dd className="font-medium">{t("home.mock.surveyValue")}</dd>
          <dt className="text-muted-foreground">{t("home.mock.owner")}</dt>
          <dd className="font-medium">
            <mark className="rounded bg-amber-100 px-1">{t("home.mock.ownerName")}</mark>
          </dd>
          <dt className="text-muted-foreground">{t("home.mock.area")}</dt>
          <dd className="font-medium">{t("home.mock.areaValue")}</dd>
        </dl>
        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <HugeiconsIcon icon={Link04Icon} className="size-3.5" />
            {t("home.mock.source")}
          </span>
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
            {t("home.mock.checked")}
          </span>
        </div>
      </div>
    </div>
  );
}

/** A phone frame. */
export function Phone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div aria-hidden className={cn("rounded-[2.2rem] bg-neutral-900 p-2 shadow-2xl", className)}>
      <div className="relative overflow-hidden rounded-[1.8rem] bg-background">
        <div className="absolute top-2 left-1/2 h-5 w-20 -translate-x-1/2 rounded-full bg-neutral-900" />
        <div className="pt-9">{children}</div>
      </div>
    </div>
  );
}

/** The Today screen, as it looks on a phone. */
export function TodayMock() {
  const { t, tf, locale } = useI18n();
  const groups = [
    { court: "home.mock.courtCivil", items: [1, 4] },
    { court: "home.mock.courtSessions", items: [3] },
  ] as const;
  const stageFor: Record<number, number> = { 1: 1, 4: 4, 3: 3 };
  return (
    <div className="px-4 pb-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-heading text-lg font-semibold">{t("nav.today")}</p>
          <p className="text-xs text-muted-foreground">{tf("home.demo.count", { n: fmtNumber(3, locale) })}</p>
        </div>
        <Brand compact />
      </div>
      {groups.map((g) => (
        <div key={g.court} className="mt-4">
          <p className="text-[11px] font-medium text-muted-foreground">{t(g.court)}</p>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {g.items.map((n) => (
              <li key={n} className="flex items-center justify-between gap-2 rounded-xl bg-muted/70 px-3 py-2 text-sm">
                <span className="font-medium">{t(`home.mock.case${n}` as MessageKey)}</span>
                <span className="text-xs text-muted-foreground">{t(`home.mock.stage${stageFor[n]}` as MessageKey)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4 shrink-0" />
        {t("home.demo.reportReady")}
      </div>
    </div>
  );
}

// ---------- The four steps ----------

const Line = ({ w, hi }: { w: string; hi?: boolean }) => (
  <span className={cn("block h-2 rounded-full", hi ? "bg-amber-300" : "bg-foreground/15")} style={{ width: w }} />
);

export function ScanStep() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <div className="relative w-36 -rotate-2 rounded-md bg-white p-3 shadow-md ring-1 ring-foreground/10">
        <div className="absolute -inset-1.5 rounded-lg border-2 border-dashed border-orange-400" />
        <div className="flex flex-col gap-1.5">
          <Line w="60%" />
          <Line w="90%" />
          <Line w="80%" />
          <Line w="95%" />
          <Line w="70%" />
          <Line w="85%" />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("home.how.page")}</p>
      <span className="flex size-11 items-center justify-center rounded-full bg-orange-500 text-white shadow-md ring-4 ring-orange-200">
        <HugeiconsIcon icon={Camera01Icon} className="size-5" />
      </span>
    </div>
  );
}

export function ReadStep() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-foreground/10">
        <HugeiconsIcon icon={Search01Icon} className="size-4 text-muted-foreground" />
        {t("home.how.searchWord")}
      </div>
      <div className="flex flex-col gap-1.5 rounded-lg bg-white p-3 shadow-sm ring-1 ring-foreground/10">
        <Line w="85%" />
        <Line w="40%" hi />
        <Line w="92%" />
        <Line w="70%" />
        <Line w="35%" hi />
        <Line w="80%" />
      </div>
      <p className="text-xs font-medium text-emerald-700">{t("home.how.found")}</p>
    </div>
  );
}

export function CheckStep() {
  const { t } = useI18n();
  const rows: [MessageKey, MessageKey][] = [
    ["home.mock.survey", "home.mock.surveyValue"],
    ["home.mock.owner", "home.mock.ownerName"],
    ["home.mock.area", "home.mock.areaValue"],
  ];
  return (
    <ul className="flex flex-col gap-2 p-4">
      {rows.map(([k, v]) => (
        <li key={k} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/10">
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] text-muted-foreground">{t(k)}</span>
            <span className="block truncate font-medium">{t(v)}</span>
          </span>
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5 shrink-0 text-sky-600" />
        </li>
      ))}
    </ul>
  );
}

export function ApproveStep() {
  const { t } = useI18n();
  return (
    <div className="flex justify-center p-4">
      <div className="relative w-40 rounded-md bg-white p-3 shadow-md ring-1 ring-foreground/10">
        <p className="text-[11px] font-semibold">{t("report.title")}</p>
        <div className="mt-2 flex flex-col gap-1.5">
          <Line w="90%" />
          <Line w="75%" />
          <Line w="85%" />
          <Line w="60%" />
          <Line w="80%" />
        </div>
        <span className="absolute -right-4 -bottom-3 inline-flex -rotate-12 items-center gap-1 rounded-md border-2 border-violet-600 bg-white px-2 py-0.5 text-xs font-bold text-violet-700">
          <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-3.5" />
          {t("home.how.approved")}
        </span>
      </div>
    </div>
  );
}

function Src({ k }: { k: MessageKey }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
      <HugeiconsIcon icon={Link04Icon} className="size-3" />
      {t(k)}
    </span>
  );
}

/** The title report as a sheet of paper, each line tagged with its source. */
export function ReportMock() {
  const { t } = useI18n();
  return (
    <div aria-hidden className="mx-auto max-w-2xl rounded-xl bg-white p-6 text-neutral-900 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-4">
        <div>
          <p className="font-serif text-2xl">{t("report.title")}</p>
          <p className="mt-1 text-sm text-neutral-500">{t("home.report.village")}</p>
        </div>
        <span className="shrink-0 rounded-md border-2 border-emerald-600 px-2 py-0.5 text-xs font-bold text-emerald-700">
          {t("home.how.approved")}
        </span>
      </div>
      <p className="mt-4 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{t("report.owners")}</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>
          {t("home.mock.ownerName")} · {t("home.mock.areaValue")}
        </span>
        <Src k="home.report.src2" />
      </div>
      <p className="mt-5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{t("report.chain")}</p>
      <ul className="mt-2 flex flex-col gap-2 text-sm">
        <li className="flex flex-wrap items-center justify-between gap-2">
          <span>{t("home.report.chain1")}</span>
          <Src k="home.report.src1" />
        </li>
        <li className="flex flex-wrap items-center justify-between gap-2">
          <span>{t("home.report.chain2")}</span>
          <Src k="home.report.src2" />
        </li>
      </ul>
      <p className="mt-5 text-xs font-semibold tracking-wide text-neutral-500 uppercase">{t("report.encumbrances")}</p>
      <p className="mt-2 text-sm">{t("report.noEncumbrances")}</p>
    </div>
  );
}
