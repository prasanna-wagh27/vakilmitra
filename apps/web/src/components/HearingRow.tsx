import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Link } from "@tanstack/react-router";
import type { HearingWithCase } from "@vakilmitra/shared";
import { Badge } from "./ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "./ui/item";

/** One hearing: case, number and client, with the stage on the right. */
export function HearingRow({ h }: { h: HearingWithCase; serial?: number }) {
  const meta = [h.time, h.courtHall, h.case.caseNumber, h.case.client?.name].filter(Boolean).join(" · ");
  return (
    <Item asChild size="sm" className="rounded-none px-4">
      <Link to="/cases/$caseId" params={{ caseId: h.case.id }}>
        <ItemContent className="min-w-0">
          <ItemTitle className="line-clamp-2 text-[15px]">{h.case.title}</ItemTitle>
          {meta && <ItemDescription className="line-clamp-1">{meta}</ItemDescription>}
        </ItemContent>
        <ItemActions>
          {h.source === "ecourts" && (
            <Badge variant="outline" className="hidden sm:inline-flex">
              eCourts
            </Badge>
          )}
          {h.purpose && (
            <Badge variant="outline" className="max-w-32 truncate">
              {h.purpose}
            </Badge>
          )}
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-muted-foreground" />
        </ItemActions>
      </Link>
    </Item>
  );
}
