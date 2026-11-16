import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Empty, ErrorBox, Loading, PageHeader } from "@/components/common";
import { ClientForm } from "@/components/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { rupees } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { clientsQuery } from "@/lib/queries";
import { useDebounced } from "@/lib/useDebounced";

export const Route = createFileRoute("/_app/clients/")({ component: ClientsPage });

function ClientsPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const { data, error, isPending, refetch } = useQuery(clientsQuery(useDebounced(q)));

  return (
    <>
      <PageHeader
        title={t("nav.clients")}
        action={
          <Button onClick={() => setAdding(true)}>
            <Plus /> {t("client.new")}
          </Button>
        }
      />
      <Input
        className="mb-3"
        type="search"
        placeholder={t("client.searchHint")}
        aria-label={t("common.search")}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <ErrorBox error={error} onRetry={() => refetch()} />
      {isPending ? (
        <Loading />
      ) : data?.length === 0 ? (
        <Empty />
      ) : (
        <ul className="panel divide-y overflow-hidden">
          {data?.map((c) => (
            <li key={c.id}>
              <Link
                to="/clients/$clientId"
                params={{ clientId: c.id }}
                className="flex min-h-14 items-center justify-between gap-2 p-3 hover:bg-muted"
              >
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[c.phone, `${t("client.cases")}: ${c.caseCount}`].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {c.outstandingPaise > 0 && <span className="text-sm font-semibold">{rupees(c.outstandingPaise, locale)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={adding} onOpenChange={setAdding} title={t("client.new")}>
        <ClientForm
          onSaved={(clientId) => navigate({ to: "/clients/$clientId", params: { clientId } })}
          onCancel={() => setAdding(false)}
        />
      </Sheet>
    </>
  );
}
