import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ErrorBox, Loading, PageHeader } from "@/components/common";
import { InvoiceTable } from "@/components/Invoices";
import { Button } from "@/components/ui/button";
import { invoicesQuery, meQuery } from "@/lib/queries";

export const Route = createFileRoute("/_admin/invoices")({ component: InvoicesPage });

function InvoicesPage() {
  const [page, setPage] = useState(1);
  const q = useQuery(invoicesQuery(page));
  const me = useQuery(meQuery);
  return (
    <>
      <PageHeader title="Payments" description="Every Razorpay payment and its GST invoice, newest first." />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <>
          <InvoiceTable invoices={q.data.invoices} owner={me.data?.role === "OWNER"} showCustomer />
          <div className="mt-4 flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page}</span>
            <Button variant="outline" size="sm" disabled={!q.data.hasMore} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </div>
        </>
      )}
    </>
  );
}
