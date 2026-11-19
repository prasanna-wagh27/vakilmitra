import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ErrorBox, Loading, PageHeader, td, th } from "@/components/common";
import { describe } from "@/components/Invoices";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { fmtDateTime } from "@/lib/format";
import { auditQuery } from "@/lib/queries";

export const Route = createFileRoute("/_admin/audit")({ component: AuditPage });

function AuditPage() {
  const q = useQuery(auditQuery);
  return (
    <>
      <PageHeader title="Audit log" description="Staff sign-ins and every change staff made, newest first (last 200)." />
      {q.isPending ? (
        <Loading />
      ) : q.error ? (
        <ErrorBox error={q.error} onRetry={() => q.refetch()} />
      ) : (
        <Card className="overflow-x-auto py-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className={th}>When</th>
                <th className={th}>Staff</th>
                <th className={th}>Action</th>
                <th className={th}>Account</th>
                <th className={th}>Details</th>
                <th className={th}>IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {q.data.map((e) => (
                <tr key={e.id}>
                  <td className={td}>{fmtDateTime(e.at)}</td>
                  <td className={td}>{e.staffName ?? "—"}</td>
                  <td className={td}>{e.action === "login.failed" ? <Badge tone="red">Failed sign-in</Badge> : e.action}</td>
                  <td className={td}>
                    {e.targetType === "advocate" && e.targetId ? (
                      <Link to="/accounts/$id" params={{ id: e.targetId }} className="hover:underline">
                        Open
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={`${td} max-w-md truncate text-muted-foreground`}>{e.details ? describe(e.details) : ""}</td>
                  <td className={`${td} text-muted-foreground`}>{e.ip ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
