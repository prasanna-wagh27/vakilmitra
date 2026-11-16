import { Link } from "@tanstack/react-router";
import type { HearingWithCase } from "@vakilmitra/shared";

export function HearingRow({ h }: { h: HearingWithCase }) {
  return (
    <Link to="/cases/$caseId" params={{ caseId: h.case.id }} className="block rounded-2xl border bg-card p-3 hover:bg-muted">
      <p className="font-semibold">{h.case.title}</p>
      <p className="text-sm text-muted-foreground">{[h.case.caseNumber, h.case.client?.name].filter(Boolean).join(" · ")}</p>
      {h.purpose && <p className="mt-1 text-sm">{h.purpose}</p>}
    </Link>
  );
}
