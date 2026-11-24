import { Link } from "@tanstack/react-router";
import { api } from "@/lib/api";
import { fmtDate, rupees } from "@/lib/format";
import { type AdminInvoice, useAdminMutation } from "@/lib/queries";
import { ErrorBox, PLAN_LABEL, td, th } from "./common";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";

export function InvoiceTable({ invoices, owner, showCustomer }: { invoices: AdminInvoice[]; owner: boolean; showCustomer?: boolean }) {
  const refund = useAdminMutation((v: { id: string; note: string }) => api(`/invoices/${v.id}/refund`, { body: { note: v.note } }));
  if (!invoices.length)
    return <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">No payments yet.</p>;
  return (
    <>
      <Card className="overflow-x-auto py-0">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className={th}>Invoice</th>
              {showCustomer && <th className={th}>Customer</th>}
              <th className={th}>Plan</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={`${th} text-right`}>Total paid</th>
              <th className={th}>Status</th>
              <th className={th}>Date</th>
              {owner && <th className={th} />}
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoices.map((i) => (
              <tr key={i.id}>
                <td className={td}>
                  {i.number}
                  <p className="text-xs text-muted-foreground">{i.razorpayPaymentId}</p>
                </td>
                {showCustomer && (
                  <td className={td}>
                    {i.advocateId ? (
                      <Link to="/accounts/$id" params={{ id: i.advocateId }} className="hover:underline">
                        {i.billingName}
                      </Link>
                    ) : (
                      i.billingName
                    )}
                    <p className="text-xs text-muted-foreground">{i.billingEmail}</p>
                  </td>
                )}
                <td className={td}>
                  {PLAN_LABEL[i.plan]} · {i.interval === "MONTHLY" ? "monthly" : "yearly"}
                </td>
                <td className={`${td} text-right tabular-nums`}>{rupees(i.amountPaise)}</td>
                <td className={`${td} text-right tabular-nums`}>{rupees(i.totalPaise)}</td>
                <td className={td}>{i.status === "PAID" ? <Badge tone="green">Paid</Badge> : <Badge variant="outline">Refunded</Badge>}</td>
                <td className={td}>{fmtDate(i.createdAt)}</td>
                {owner && (
                  <td className={`${td} text-right`}>
                    {i.status === "PAID" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={refund.isPending}
                        onClick={() => {
                          const note = prompt(`Refund ${rupees(i.totalPaise)} for ${i.number}? Reason:`);
                          if (note && note.trim().length >= 3) refund.mutate({ id: i.id, note: note.trim() });
                        }}
                      >
                        Refund
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <ErrorBox error={refund.error} />
    </>
  );
}

export function describe(d: Record<string, unknown>) {
  return Object.entries(d)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([k, v]) => `${k}: ${typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? fmtDate(v) : String(v)}`)
    .join(" · ");
}
