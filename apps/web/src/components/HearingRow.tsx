import { Link } from "@tanstack/react-router";
import type { HearingWithCase } from "@vakilmitra/shared";

/** One hearing, as a row inside a .list. */
export function HearingRow({ h }: { h: HearingWithCase }) {
  const meta = [h.case.caseNumber, h.case.client?.name].filter(Boolean).join(" · ");
  return (
    <Link to="/cases/$caseId" params={{ caseId: h.case.id }} className="list-row">
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[17px] leading-snug break-words">{h.case.title}</span>
        {meta && <span className="mt-1 line-clamp-1 block text-[15px] text-muted-foreground">{meta}</span>}
      </span>
      {h.purpose && <span className="chip max-w-[45%] shrink-0 truncate">{h.purpose}</span>}
    </Link>
  );
}
