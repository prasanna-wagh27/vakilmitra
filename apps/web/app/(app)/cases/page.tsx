"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { fmtDate } from "@/lib/format";
import type { CaseStatus, CaseSummary } from "@/lib/types";
import { Badge, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui";
import { STATUSES } from "@/components/CaseForm";

export default function CasesPage() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<CaseStatus | "">("ACTIVE");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(id);
  }, [q]);
  const { data, error, loading, reload } = useApi<{ cases: CaseSummary[] }>("/cases", { q: debounced, status: status || undefined });

  return (
    <>
      <PageHeader
        title={t("nav.cases")}
        action={<Link href="/cases/new" className="flex min-h-11 items-center rounded-xl bg-brand-600 px-4 font-medium text-white">+ {t("case.new")}</Link>}
      />
      <input className="input mb-2" type="search" placeholder={t("case.searchHint")} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {(["", ...STATUSES] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} className={`min-h-9 shrink-0 rounded-full border px-3 text-sm ${status === s ? "border-brand-600 bg-brand-600 text-white" : "surface"}`}>
            {s ? t(`status.${s}`) : t("case.all")}
          </button>
        ))}
      </div>
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : data?.cases.length === 0 ? (
        <Empty />
      ) : (
        <ul className="space-y-2">
          {data?.cases.map((c) => (
            <li key={c.id}>
              <Link href={`/cases/${c.id}`} className="surface block rounded-2xl border p-3 hover:brightness-95">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">{c.title}</p>
                  {(c._count?.flags ?? 0) > 0 && <Badge tone="red">⚑ {c._count!.flags}</Badge>}
                </div>
                <p className="muted text-sm">{[c.caseNumber, c.court, c.client?.name].filter(Boolean).join(" · ")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <Badge>{t(`kind.${c.kind}`)}</Badge>
                  {c.shared && <Badge tone="blue">{t("case.shared")}</Badge>}
                  <span className={c.nextHearing ? "" : "muted"}>
                    {c.nextHearing ? `${t("case.nextHearing")}: ${fmtDate(c.nextHearing.date, locale)}` : t("case.noNextHearing")}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
