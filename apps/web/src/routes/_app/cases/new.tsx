import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { PageHeader } from "@/components/common";
import { CaseForm } from "@/components/forms";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_app/cases/new")({ component: NewCasePage });

function NewCasePage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const router = useRouter();
  return (
    <>
      <PageHeader title={t("case.new")} back="/cases" />
      <CaseForm onSaved={(caseId) => navigate({ to: "/cases/$caseId", params: { caseId } })} onCancel={() => router.history.back()} />
    </>
  );
}
