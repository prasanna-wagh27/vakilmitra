"use client";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import { fmtDate } from "@/lib/format";
import type { Hearing } from "@/lib/types";

export type HearingWithCase = Hearing & { case: { id: string; title: string; caseNumber?: string | null; court?: string | null; client?: { name: string } | null } };

export function HearingRow({ h, showDate }: { h: HearingWithCase; showDate?: boolean }) {
  const { locale } = useI18n();
  return (
    <Link href={`/cases/${h.case.id}`} className="surface block rounded-2xl border p-3 hover:brightness-95">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold">{h.case.title}</p>
        {showDate && <span className="muted shrink-0 text-sm">{fmtDate(h.date, locale, { day: "numeric", month: "short" })}</span>}
      </div>
      <p className="muted text-sm">
        {[h.case.caseNumber, h.case.client?.name].filter(Boolean).join(" · ")}
      </p>
      {h.purpose && <p className="mt-1 text-sm">{h.purpose}</p>}
    </Link>
  );
}
