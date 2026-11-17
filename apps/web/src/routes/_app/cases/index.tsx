import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CASE_STATUSES, type CaseStatus } from "@vakilmitra/shared";
import { Flag, Plus } from "lucide-react";
import { useState } from "react";
import { Chip, Empty, ErrorBox, Loading, PageHeader } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { casesQuery } from "@/lib/queries";
import { useDebounced } from "@/lib/useDebounced";

export const Route = createFileRoute("/_app/cases/")({ component: CasesPage });

function CasesPage() {
  const { t, locale } = useI18n();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<CaseStatus | "">("ACTIVE");
  const { data, error, isPending, refetch } = useQuery(casesQuery(useDebounced(q), status));

  return (
    <>
      <PageHeader
        title={t("nav.cases")}
        action={
          <Button asChild>
            <Link to="/cases/new">
              <Plus /> {t("case.new")}
            </Link>
          </Button>
        }
      />
      <Input
        className="mb-3"
        type="search"
        placeholder={t("case.searchHint")}
        aria-label={t("common.search")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="mb-6 flex gap-1 overflow-x-auto pb-1">
        {(["", ...CASE_STATUSES] as const).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {s ? t(`status.${s}`) : t("case.all")}
          </Chip>
        ))}
      </div>
      <ErrorBox error={error} onRetry={() => refetch()} />
      {isPending ? (
        <Loading />
      ) : data?.length === 0 ? (
        <Empty />
      ) : (
        <ul className="list">
          {data?.map((c) => (
            <li key={c.id}>
              <Link to="/cases/$caseId" params={{ caseId: c.id }} className="list-item">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[17px] leading-snug">{c.title}</p>
                  {c.openFlags > 0 && (
                    <Badge tone="red">
                      <Flag /> {c.openFlags}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-[15px] text-muted-foreground">
                  {[c.caseNumber, c.court, c.client?.name].filter(Boolean).join(" · ")}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[15px]">
                  <Badge>{t(`kind.${c.kind}`)}</Badge>
                  {c.shared && <Badge tone="blue">{t("case.shared")}</Badge>}
                  <span className={c.nextHearing ? "" : "text-muted-foreground"}>
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
