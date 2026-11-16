"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useApi } from "@/lib/useApi";
import { rupees } from "@/lib/format";
import type { Client } from "@/lib/types";
import { Button, Empty, ErrorBox, Loading, PageHeader, Sheet } from "@/components/ui";
import { ClientForm } from "@/components/ClientForm";

export default function ClientsPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [adding, setAdding] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(id);
  }, [q]);
  const { data, error, loading, reload } = useApi<{ clients: Client[] }>("/clients", { q: debounced });

  return (
    <>
      <PageHeader title={t("nav.clients")} action={<Button onClick={() => setAdding(true)}>+ {t("client.new")}</Button>} />
      <input className="input mb-3" type="search" placeholder={t("client.searchHint")} value={q} onChange={(e) => setQ(e.target.value)} />
      <ErrorBox error={error} onRetry={reload} />
      {loading && !data ? (
        <Loading />
      ) : data?.clients.length === 0 ? (
        <Empty />
      ) : (
        <ul className="surface divide-y rounded-2xl border hairline">
          {data?.clients.map((c) => (
            <li key={c.id}>
              <Link href={`/clients/${c.id}`} className="flex min-h-14 items-center justify-between gap-2 p-3 hover:brightness-95">
                <div>
                  <p className="font-medium">{c.name}</p>
                  <p className="muted text-sm">{[c.phone, `${t("client.cases")}: ${c._count?.cases ?? 0}`].filter(Boolean).join(" · ")}</p>
                </div>
                {(c.outstandingPaise ?? 0) > 0 && <span className="text-sm font-semibold">{rupees(c.outstandingPaise!, locale)}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={adding} title={t("client.new")} onClose={() => setAdding(false)}>
        <ClientForm onSaved={(c) => router.push(`/clients/${c.id}`)} onCancel={() => setAdding(false)} />
      </Sheet>
    </>
  );
}
