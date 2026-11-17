import { Add01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { addDays, istDate } from "@vakilmitra/shared";
import { useState } from "react";
import { Empty, ErrorBox, Loading } from "@/components/common";
import { HearingRow } from "@/components/HearingRow";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtDate, fmtDay, fmtNumber, rupees } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { boardQuery, feeSummaryQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/")({ component: TodayPage });

function TodayPage() {
  const { t, tf, locale } = useI18n();
  const { advocate } = Route.useRouteContext();
  const today = istDate();
  const tomorrow = addDays(today, 1);
  const [day, setDay] = useState(today);
  const board = useQuery(boardQuery(day));
  const todays = useQuery(boardQuery(today));
  const fees = useQuery(feeSummaryQuery);
  const num = (n: number) => fmtNumber(n, locale);

  // Group the board by court, the way advocates walk the corridor.
  const byCourt = new Map<string, NonNullable<typeof board.data>["hearings"]>();
  for (const h of board.data?.hearings ?? []) {
    const k = h.court || h.case.court || "—";
    byCourt.set(k, [...(byCourt.get(k) ?? []), h]);
  }
  const missing = todays.data?.needsNextDate ?? [];
  const count = board.data?.hearings.length ?? 0;

  return (
    <>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{fmtDay(today, locale)}</p>
          <h1 className="font-heading mt-1 text-2xl leading-tight font-semibold tracking-tight">
            {tf("today.greeting", { name: advocate.name })}
          </h1>
        </div>
        <Button asChild className="shrink-0">
          <Link to="/cases/new">
            <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
            {t("case.new")}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat to="/diary" label={t("today.statHearings")} value={todays.data ? num(todays.data.hearings.length) : "–"} />
        <Stat to="/cases" label={t("today.statMissing")} value={todays.data ? num(missing.length) : "–"} warn={missing.length > 0} />
        <Stat
          to="/fees"
          label={t("today.statFees")}
          value={fees.data ? rupees(fees.data.totals.outstandingPaise, locale) : "–"}
          warn={!!fees.data && fees.data.totals.overduePaise > 0}
        />
      </div>

      <ErrorBox error={board.error} onRetry={() => board.refetch()} />

      <Card className="mt-6 gap-0 pb-0">
        <CardHeader className="border-b pb-4">
          <CardTitle>{t("today.byCourt")}</CardTitle>
          <CardDescription>
            {board.data
              ? count === 0
                ? t("today.countNone")
                : count === 1
                  ? t("today.countOne")
                  : tf("today.count", { n: num(count) })
              : " "}
          </CardDescription>
          <CardAction>
            <Tabs value={day} onValueChange={setDay}>
              <TabsList>
                <TabsTrigger value={today}>{t("today.today")}</TabsTrigger>
                <TabsTrigger value={tomorrow}>{t("today.tomorrow")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {board.isPending ? (
            <div className="p-4">
              <Loading />
            </div>
          ) : byCourt.size === 0 ? (
            <div className="p-4">
              <Empty>{t("today.noHearings")}</Empty>
            </div>
          ) : (
            [...byCourt].map(([court, hs]) => (
              <div key={court} className="border-b last:border-b-0">
                <div className="flex items-center justify-between bg-muted/50 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <span className="truncate">{court}</span>
                  <span>{num(hs.length)}</span>
                </div>
                <div className="divide-y">
                  {hs.map((h) => (
                    <HearingRow key={h.id} h={h} />
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {missing.length > 0 && (
        <Card className="mt-6 gap-0 pb-0">
          <CardHeader className="border-b pb-4">
            <CardTitle>{t("today.needsNextDate")}</CardTitle>
            <CardDescription>{t("today.needsNextDateHint")}</CardDescription>
          </CardHeader>
          <CardContent className="divide-y px-0">
            {missing.map((c) => (
              <Item key={c.id} asChild size="sm" className="rounded-none px-4">
                <Link to="/cases/$caseId" params={{ caseId: c.id }}>
                  <ItemContent className="min-w-0">
                    <ItemTitle className="line-clamp-2 text-[15px]">{c.title}</ItemTitle>
                    {c.lastHearing && (
                      <ItemDescription className="line-clamp-1">
                        {t("today.lastHearing")}: {fmtDate(c.lastHearing.date, locale)}
                        {c.lastHearing.purpose ? ` · ${c.lastHearing.purpose}` : ""}
                      </ItemDescription>
                    )}
                  </ItemContent>
                  <ItemActions>
                    <span className="text-sm font-medium">{t("today.addDate")}</span>
                    <HugeiconsIcon icon={ArrowRight01Icon} className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Stat({ to, label, value, warn }: { to: string; label: string; value: string; warn?: boolean }) {
  return (
    <Link to={to} className="block min-w-0 rounded-xl">
      <Card size="sm" className="gap-1 transition-colors hover:bg-muted/40">
        <CardHeader className="gap-1">
          <CardDescription className="truncate text-xs">{label}</CardDescription>
          <CardTitle className={cn("truncate text-xl font-semibold tabular-nums", warn && "text-amber-700")}>{value}</CardTitle>
        </CardHeader>
      </Card>
    </Link>
  );
}
