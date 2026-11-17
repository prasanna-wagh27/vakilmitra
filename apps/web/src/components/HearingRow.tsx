import { Link } from "@tanstack/react-router";
import type { HearingWithCase } from "@vakilmitra/shared";

/** One hearing as a cause-list entry: serial, case, docket number in mono, stage on the right. */
export function HearingRow({ h, serial }: { h: HearingWithCase; serial?: number }) {
  return (
    <Link to="/cases/$caseId" params={{ caseId: h.case.id }} className="list-row items-start">
      {serial !== undefined && (
        <span className="num w-7 shrink-0 pt-0.5 text-[15px] text-subtle-foreground">{String(serial).padStart(2, "0")}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 block text-[17px] leading-snug break-words">{h.case.title}</span>
        <span className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[15px] text-muted-foreground">
          {h.case.caseNumber && <span className="num text-foreground">{h.case.caseNumber}</span>}
          {h.case.client?.name && <span className="truncate">{h.case.client.name}</span>}
        </span>
      </span>
      {h.purpose && <span className="chip max-w-[40%] shrink-0 truncate">{h.purpose}</span>}
    </Link>
  );
}
