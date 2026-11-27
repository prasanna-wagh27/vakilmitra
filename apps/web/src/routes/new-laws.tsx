import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { LawCode } from "@vakilmitra/shared/law-codes";
import { z } from "zod";
import { NewLawsPage } from "@/components/legal/NewLaws";

// Listed here, not imported: importing the law-codes module would put its whole table in the main bundle.
const CODES = ["bns", "bnss", "bsa"] as const satisfies readonly LawCode[];
const search = z.object({
  q: z.string().max(100).optional().catch(undefined),
  code: z.enum(CODES).optional().catch(undefined),
});

export const Route = createFileRoute("/new-laws")({
  validateSearch: search,
  component: NewLaws,
});

function NewLaws() {
  const { q, code } = Route.useSearch();
  const navigate = useNavigate({ from: "/new-laws" });
  const onChange = (next: { q?: string; code?: LawCode }) =>
    navigate({ search: { q: next.q || undefined, code: next.code }, replace: true, resetScroll: false });
  return <NewLawsPage q={q ?? ""} code={code} onChange={onChange} />;
}
