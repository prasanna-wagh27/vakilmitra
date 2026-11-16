"use client";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { CaseForm } from "@/components/CaseForm";
import { PageHeader } from "@/components/ui";

export default function NewCasePage() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <>
      <PageHeader title={t("case.new")} back="/cases" />
      <CaseForm onSaved={(id) => router.push(`/cases/${id}`)} onCancel={() => router.back()} />
    </>
  );
}
