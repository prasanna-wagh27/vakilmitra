import {
  Agreement01Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  DocumentValidationIcon,
  FolderLibraryIcon,
  LanguageSquareIcon,
  Location01Icon,
  MapsLocation01Icon,
  Search01Icon,
  ShieldKeyIcon,
  SquareLock02Icon,
  TaskDone01Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { type BillingInterval, TRIAL_DAYS } from "@vakilmitra/shared";
import { useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { LanguageToggle } from "@/components/LanguageToggle";
import { PolicyFooter } from "@/components/legal/LegalPage";
import { PlanCards } from "@/components/PlanCards";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtNumber } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { meQuery } from "@/lib/queries";

/** The public home page. A signed-in advocate goes straight to their day. */
export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    let signedIn = false;
    try {
      await context.queryClient.ensureQueryData(meQuery);
      signedIn = true;
    } catch {
      // Not signed in (or the API is unreachable): show the home page.
    }
    if (signedIn) throw redirect({ to: "/today" });
  },
  component: HomePage,
});

const FEATURES: { icon: IconSvgElement; key: string }[] = [
  { icon: Calendar03Icon, key: "diary" },
  { icon: FolderLibraryIcon, key: "cases" },
  { icon: Search01Icon, key: "scan" },
  { icon: MapsLocation01Icon, key: "land" },
  { icon: DocumentValidationIcon, key: "report" },
  { icon: Agreement01Icon, key: "fees" },
];

const TRUST: { icon: IconSvgElement; key: string }[] = [
  { icon: SquareLock02Icon, key: "encrypted" },
  { icon: Location01Icon, key: "india" },
  { icon: UserMultipleIcon, key: "log" },
  { icon: TaskDone01Icon, key: "approve" },
];

const FAQ = [1, 2, 3, 4, 5] as const;

function HomePage() {
  const { t, tf, locale } = useI18n();
  const days = fmtNumber(TRIAL_DAYS, locale);
  const k = (key: string) => t(key as MessageKey);

  // The tab title and description follow the language on screen.
  useEffect(() => {
    document.title = t("home.metaTitle");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("home.metaDescription"));
  }, [t]);

  return (
    <div className="min-h-dvh">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 md:grid-cols-[1.1fr_1fr] md:pt-16 md:pb-24">
          <div>
            <p className="text-sm font-medium text-primary">{t("home.eyebrow")}</p>
            <h1 className="font-display mt-3 text-4xl leading-[1.15] text-balance md:text-5xl">{t("auth.hero")}</h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground text-pretty">{t("home.heroSub")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link to="/register">{t("legal.startTrial")}</Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#pricing">{t("home.seePricing")}</a>
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{tf("home.trialNote", { days })}</p>
          </div>
          <DemoBoard />
        </section>

        {/* Features */}
        <section id="features" className="scroll-mt-20 border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <h2 className="font-display max-w-2xl text-3xl text-balance">{t("home.features.title")}</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <Card key={f.key} className="gap-3 px-(--card-spacing)">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <HugeiconsIcon icon={f.icon} className="size-5" aria-hidden />
                  </span>
                  <h3 className="font-heading text-lg font-semibold">{k(`home.f.${f.key}`)}</h3>
                  <p className="text-muted-foreground">{k(`home.f.${f.key}Text`)}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Language */}
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-16 md:grid-cols-[auto_1fr] md:py-20">
          <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <HugeiconsIcon icon={LanguageSquareIcon} className="size-8" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-3xl text-balance">{t("home.lang.title")}</h2>
            <p className="mt-3 max-w-3xl text-lg text-muted-foreground text-pretty">{t("home.lang.text")}</p>
          </div>
        </section>

        {/* Privacy and trust */}
        <section className="border-t bg-muted/40">
          <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
            <div className="flex items-center gap-3">
              <HugeiconsIcon icon={ShieldKeyIcon} className="size-7 text-primary" aria-hidden />
              <h2 className="font-display text-3xl text-balance">{t("home.trust.title")}</h2>
            </div>
            <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST.map((x) => (
                <li key={x.key}>
                  <HugeiconsIcon icon={x.icon} className="size-6 text-primary" aria-hidden />
                  <h3 className="mt-3 font-heading font-semibold">{k(`home.t.${x.key}`)}</h3>
                  <p className="mt-1 text-muted-foreground">{k(`home.t.${x.key}Text`)}</p>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm">
              <Link to="/privacy" className="text-primary underline underline-offset-4">
                {t("legal.privacy")}
              </Link>
            </p>
          </div>
        </section>

        {/* How to start */}
        <section className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <h2 className="font-display text-3xl">{t("home.steps.title")}</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {([1, 2, 3] as const).map((n) => (
              <li key={n} className="flex gap-4">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground tabular-nums">
                  {fmtNumber(n, locale)}
                </span>
                <div>
                  <h3 className="font-heading text-lg font-semibold">{k(`home.s${n}`)}</h3>
                  <p className="mt-1 text-muted-foreground">{n === 1 ? tf("home.s1Text", { days }) : k(`home.s${n}Text`)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <PricingSection />

        {/* Questions */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-16 md:py-20">
          <h2 className="font-display text-3xl">{t("home.faq.title")}</h2>
          <div className="mt-8 divide-y border-y">
            {FAQ.map((n) => (
              <details key={n} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                  {k(`home.q${n}`)}
                  <span aria-hidden className="text-xl text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-muted-foreground">{k(`home.a${n}`)}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Last call */}
        <section className="border-t bg-primary text-primary-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-3xl text-balance">{t("home.final.title")}</h2>
              <p className="mt-2 opacity-90">{tf("home.trialNote", { days })}</p>
            </div>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/register">{t("legal.startTrial")}</Link>
            </Button>
          </div>
        </section>
      </main>

      <PolicyFooter />
    </div>
  );
}

function SiteHeader() {
  const { t } = useI18n();
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" aria-label={t("app.name")}>
          <Brand />
        </Link>
        <nav aria-label={t("nav.main")} className="ms-6 hidden items-center gap-5 text-sm md:flex">
          <a href="#features" className="text-muted-foreground hover:text-foreground">
            {t("home.nav.features")}
          </a>
          <a href="#pricing" className="text-muted-foreground hover:text-foreground">
            {t("home.nav.pricing")}
          </a>
          <a href="#faq" className="text-muted-foreground hover:text-foreground">
            {t("home.nav.faq")}
          </a>
        </nav>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <LanguageToggle compact />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">{t("auth.signIn")}</Link>
          </Button>
          <Button size="sm" className="hidden sm:inline-flex" asChild>
            <Link to="/register">{t("legal.startTrial")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

/** A still picture of the Today screen, drawn with the app's own pieces, in the reader's language. */
function DemoBoard() {
  const { t, tf, locale } = useI18n();
  const rows = [
    { court: "home.demo.court1", items: [1, 2] },
    { court: "home.demo.court2", items: [3] },
  ] as const;
  return (
    <figure aria-label={t("home.demo.label")} className="relative">
      <div aria-hidden className="absolute -inset-4 -z-10 rounded-3xl bg-primary/10 blur-2xl" />
      <Card className="gap-0 py-0 shadow-lg" aria-hidden>
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <p className="font-heading text-lg font-semibold">{t("nav.today")}</p>
            <p className="text-sm text-muted-foreground">{tf("home.demo.count", { n: fmtNumber(3, locale) })}</p>
          </div>
          <Brand compact />
        </div>
        {rows.map((r) => (
          <div key={r.court} className="border-b px-5 py-3 last:border-b-0">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t(r.court)}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {r.items.map((n) => (
                <li key={n} className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-2">
                  <span className="font-medium">{t(`home.demo.case${n}` as MessageKey)}</span>
                  <span className="text-sm text-muted-foreground">{t(`home.demo.stage${n}` as MessageKey)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="flex items-center gap-3 bg-muted/40 px-5 py-4">
          <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-5 shrink-0 text-success" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{t("home.demo.report")}</p>
            <p className="text-xs text-muted-foreground">{t("home.demo.reportStatus")}</p>
          </div>
        </div>
      </Card>
      <figcaption className="sr-only">{t("home.demo.label")}</figcaption>
    </figure>
  );
}

function PricingSection() {
  const { t } = useI18n();
  const [interval, setInterval] = useState<BillingInterval>("YEARLY");
  return (
    <section id="pricing" className="scroll-mt-20 border-t bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
        <h2 className="font-display text-3xl">{t("home.pricing.title")}</h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">{t("billing.everyPlan")}</p>
        <Tabs className="my-6" value={interval} onValueChange={(v) => setInterval(v as BillingInterval)}>
          <TabsList>
            <TabsTrigger value="MONTHLY">{t("billing.monthly")}</TabsTrigger>
            <TabsTrigger value="YEARLY">
              {t("billing.yearly")} <span className="ml-1 text-xs text-success">{t("billing.yearlySave")}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <PlanCards
          interval={interval}
          action={(p) => (
            <Button className="w-full" variant={p === "PRO" ? "default" : "outline"} asChild>
              <Link to="/register">{t("legal.startTrial")}</Link>
            </Button>
          )}
        />
        <p className="mt-6 text-sm text-muted-foreground">
          {t("legal.pricingNote")}{" "}
          <Link to="/pricing" className="text-primary underline underline-offset-4">
            {t("home.pricing.more")}
          </Link>
        </p>
      </div>
    </section>
  );
}
