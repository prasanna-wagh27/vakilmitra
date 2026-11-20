import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";
import { Fill, PublicPage } from "./LegalPage";

export function ContactContent() {
  const { t } = useI18n();
  const rows: [string, string | null][] = [
    [t("legal.operator"), LEGAL.operator],
    [t("legal.address"), LEGAL.address],
    [t("auth.email"), LEGAL.supportEmail],
    [t("common.phone"), LEGAL.supportPhone],
  ];
  return (
    <PublicPage title={t("legal.contact")}>
      <p className="mt-3 max-w-2xl text-muted-foreground">{t("legal.contactIntro")}</p>
      <dl className="mt-6 grid max-w-2xl grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>
              <Fill v={v} />
            </dd>
          </div>
        ))}
      </dl>
      <h2 className="mt-10 font-heading text-lg font-semibold">{t("legal.grievance")}</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("legal.grievanceIntro")}</p>
      <dl className="mt-4 grid max-w-2xl grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className="text-muted-foreground">{t("legal.officer")}</dt>
        <dd>
          <Fill v={LEGAL.grievanceOfficer} />
        </dd>
        <dt className="text-muted-foreground">{t("auth.email")}</dt>
        <dd>
          <Fill v={LEGAL.grievanceEmail} />
        </dd>
      </dl>
      <p className="mt-8 text-sm">
        <Link to="/privacy" className="text-primary underline underline-offset-4">
          {t("legal.privacy")}
        </Link>
      </p>
    </PublicPage>
  );
}
