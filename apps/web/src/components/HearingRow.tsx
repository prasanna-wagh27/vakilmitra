import { Link } from "@tanstack/react-router";
import type { HearingWithCase } from "@vakilmitra/shared";
import { ChevronRight } from "lucide-react";

/** One hearing, as a row inside a .list. */
export function HearingRow({ h }: { h: HearingWithCase }) {
  const meta = [h.case.caseNumber, h.case.client?.name].filter(Boolean).join(" · ");
  return (
    <Link to="/cases/$caseId" params={{ caseId: h.case.id }} className="list-row">
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block font-medium break-words">{h.case.title}</span>
        {meta && <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">{meta}</span>}
      </span>
      {h.purpose && <span className="max-w-[40%] shrink-0 truncate text-sm text-muted-foreground">{h.purpose}</span>}
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
