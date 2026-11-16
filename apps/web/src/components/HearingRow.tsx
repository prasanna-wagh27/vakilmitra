import { Link } from "@tanstack/react-router";
import type { HearingWithCase } from "@vakilmitra/shared";
import { ChevronRight } from "lucide-react";

export function HearingRow({ h }: { h: HearingWithCase }) {
  return (
    <Link to="/cases/$caseId" params={{ caseId: h.case.id }} className="row-card flex items-center gap-3 p-4">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{h.case.title}</span>
        <span className="block truncate text-sm text-muted-foreground">
          {[h.case.caseNumber, h.case.client?.name].filter(Boolean).join(" · ")}
        </span>
        {h.purpose && <span className="mt-1.5 inline-flex rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{h.purpose}</span>}
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
