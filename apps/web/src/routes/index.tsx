import {
  ArrowRight01Icon,
  BadgeIndianRupeeIcon,
  Calendar03Icon,
  CourtHouseIcon,
  FileScanIcon,
  Folder01Icon,
  Search01Icon,
  SquareLock02Icon,
  Tick02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { type BillingInterval, PAID_PLANS, PLANS, TRIAL_DAYS } from "@vakilmitra/shared";
import { type ReactNode, useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { LanguageToggle } from "@/components/LanguageToggle";
import { POLICY_LINKS } from "@/components/legal/LegalPage";
import { CasesMock, Phone, ReportMock, StepsMock, TodayMock } from "@/components/marketing/mocks";
import { Button } from "@/components/ui/button";
import { fmtNumber, rupees } from "@/lib/format";
import { type MessageKey, useI18n } from "@/lib/i18n";
import { meQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

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

function HomePage() {
  const { t } = useI18n();
  // The tab title and description follow the language on screen.
  useEffect(() => {
    document.title = t("home.metaTitle");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("home.metaDescription"));
  }, [t]);

  return (
    <div className="min-h-dvh overflow-x-clip bg-paper text-graphite">
      <SiteHeader />
      <main>
        <Hero />
        <MadeFor />
        <Features />
        <Showcase id="how" bg="bg-mist-dusk" title={t("home.land.title")} text={t("home.land.text")}>
          <StepsMock />
        </Showcase>
        <Showcase id="report" bg="bg-mist" title={t("home.reportH.title")} text={t("home.rules.sub")}>
          <ReportMock />
        </Showcase>
        <Showcase id="today" bg="bg-mist-sage" title={t("home.today.title")} text={t("home.today.text")}>
          <Phone className="w-64 translate-y-10 md:w-72 md:translate-y-16">
            <TodayMock />
          </Phone>
        </Showcase>
        <Pricing />
        <Trust />
        <Faq />
        <FinalCall />
      </main>
      <SiteFooter />
    </div>
  );
}

// ---------- Pieces ----------

const H2 = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 className={cn("text-4xl leading-[1.2] font-medium tracking-tight text-balance md:text-5xl", className)}>{children}</h2>
);

/** The main call to action: graphite on light ground, white on dark. */
function TrialButton({ className, light = false }: { className?: string; light?: boolean }) {
  const { t } = useI18n();
  return (
    <Button
      size="lg"
      className={cn(
        "h-12 rounded-lg px-6 text-base",
        light ? "bg-white text-graphite hover:bg-white/90" : "bg-graphite text-white hover:bg-graphite/90",
        className,
      )}
      asChild
    >
      <Link to="/register">{t("legal.startTrial")}</Link>
    </Button>
  );
}

function SiteHeader() {
  const { t } = useI18n();
  const links = [
    ["#features", "home.nav.features"],
    ["#how", "home.nav.how"],
    ["#pricing", "home.nav.pricing"],
    ["#faq", "home.nav.faq"],
  ] as const;
  return (
    <header className="fixed inset-x-3 top-3 z-30 mx-auto max-w-6xl rounded-2xl bg-graphite/75 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-md">
      <div className="flex items-center gap-2 px-3 py-2">
        <Link to="/" aria-label={t("app.name")} className="flex items-center gap-2">
          <Brand compact onDark />
          <span className="hidden font-heading text-[15px] font-semibold tracking-tight sm:inline">{t("app.name")}</span>
        </Link>
        <nav aria-label={t("nav.main")} className="ms-8 hidden items-center gap-6 text-sm lg:flex">
          {links.map(([href, key]) => (
            <a key={href} href={href} className="text-white/70 transition-colors hover:text-white">
              {t(key)}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <LanguageToggle compact onDark />
          <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white" asChild>
            <Link to="/login">{t("auth.signIn")}</Link>
          </Button>
          <Button size="sm" className="rounded-lg bg-white text-graphite hover:bg-white/90" asChild>
            <Link to="/register">{t("legal.startTrial")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

// ---------- Hero ----------

function Hero() {
  const { t, tf, locale } = useI18n();
  return (
    <section className="relative">
      {/* The mist stops part-way down the product picture, so the picture sits across the edge. */}
      <div aria-hidden className="absolute inset-x-0 top-0 bottom-32 bg-mist md:bottom-48">
        <div className="absolute inset-0 bg-gradient-to-b from-graphite/45 via-graphite/10 to-transparent" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pt-28 md:pt-40">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm text-white ring-1 ring-white/25 backdrop-blur">
          <span className="size-1.5 rounded-full bg-white" />
          {tf("home.pill", { days: fmtNumber(TRIAL_DAYS, locale) })}
        </p>
        <h1 className="mt-6 max-w-4xl text-5xl leading-[1.15] font-semibold tracking-tight text-balance text-white md:text-7xl">
          {t("home.hero1")} <span className="text-white/70">{t("home.hero2")}</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/90 text-pretty">{t("home.heroSub")}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <TrialButton />
          <Button size="lg" className="h-12 rounded-lg bg-white px-6 text-base text-graphite hover:bg-white/90" asChild>
            <a href="#how">{t("home.seeHow")}</a>
          </Button>
        </div>
      </div>
      <div className="relative mx-auto mt-14 max-w-6xl px-4 md:mt-20">
        <CasesMock />
      </div>
    </section>
  );
}

function MadeFor() {
  const { t, locale } = useI18n();
  const docs: MessageKey[] = ["home.doc.712", "home.doc.ferfar", "home.doc.index2", "home.doc.orders"];
  return (
    <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 md:pt-16">
      <p className={cn("text-sm text-neutral-500", locale === "en" && "font-mono")}>{t("home.madeFor")}</p>
      <ul className="mt-6 flex flex-wrap gap-x-10 gap-y-3 text-xl font-semibold tracking-tight text-neutral-400 md:text-2xl">
        {docs.map((d) => (
          <li key={d}>{t(d)}</li>
        ))}
      </ul>
    </section>
  );
}

// ---------- Features ----------

function IconRow({ icons }: { icons: IconSvgElement[] }) {
  return (
    <div aria-hidden className="mt-6 flex gap-2">
      {icons.map((icon, i) => (
        <span
          key={i}
          className="flex size-11 items-center justify-center rounded-xl bg-white text-neutral-600 shadow-xs ring-1 ring-neutral-200"
        >
          <HugeiconsIcon icon={icon} className="size-5" />
        </span>
      ))}
    </div>
  );
}

function Features() {
  const { t } = useI18n();
  const items: { n: 1 | 2 | 3; icons: IconSvgElement[]; href: string }[] = [
    { n: 1, icons: [Folder01Icon, Calendar03Icon, BadgeIndianRupeeIcon, CourtHouseIcon], href: "#today" },
    { n: 2, icons: [FileScanIcon, Search01Icon], href: "#how" },
    { n: 3, icons: [SquareLock02Icon, UserMultipleIcon], href: "#trust" },
  ];
  return (
    <section id="features" className="mx-auto grid max-w-6xl scroll-mt-24 gap-x-10 px-4 pb-10 md:grid-cols-3">
      {items.map((x) => (
        <div key={x.n} className="border-t border-neutral-200 py-10">
          <h3 className="text-2xl leading-snug font-medium tracking-tight">{t(`home.f${x.n}.title` as MessageKey)}</h3>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">{t(`home.f${x.n}.text` as MessageKey)}</p>
          <IconRow icons={x.icons} />
          <a href={x.href} className="mt-8 inline-flex items-center gap-1 font-medium text-link hover:underline">
            {t("home.learnMore")}
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </a>
        </div>
      ))}
    </section>
  );
}

/** A product picture on a misty panel, then a big name and a few lines about it. */
function Showcase({ id, bg, title, text, children }: { id: string; bg: string; title: string; text: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 md:py-16">
      <div className={cn("flex min-h-80 items-center justify-center overflow-hidden rounded-2xl px-5 py-10 md:min-h-[30rem] md:p-14", bg)}>
        {children}
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-2 md:gap-12">
        <H2 className="text-5xl md:text-6xl">{title}</H2>
        <p className="text-lg leading-relaxed text-neutral-600 md:pt-3 md:text-xl">{text}</p>
      </div>
    </section>
  );
}

// ---------- Pricing ----------

const GB = 1024 ** 3;

function Pricing() {
  const { t, tf, locale } = useI18n();
  const [interval, setInterval] = useState<BillingInterval>("YEARLY");
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:py-24">
      <H2>
        {tf("home.pricing.title", { price: rupees(PLANS.SOLO.price!.MONTHLY, locale) })}{" "}
        <span className="text-neutral-400">{tf("home.pricing.free", { days: fmtNumber(TRIAL_DAYS, locale) })}</span>
      </H2>
      <p className="mt-4 max-w-2xl text-lg text-neutral-600">{t("billing.everyPlan")}</p>
      <div className="mt-8 flex gap-2">
        {(["MONTHLY", "YEARLY"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={interval === v}
            onClick={() => setInterval(v)}
            className={cn(
              "rounded-lg px-4 py-2 text-base transition-colors",
              interval === v ? "bg-white font-medium shadow-sm ring-1 ring-neutral-200" : "text-neutral-500 hover:text-graphite",
            )}
          >
            {t(v === "MONTHLY" ? "billing.monthly" : "billing.yearly")}
            {v === "YEARLY" && <span className="ms-2 text-sm text-link">{t("billing.yearlySave")}</span>}
          </button>
        ))}
      </div>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PAID_PLANS.map((p) => {
          const { limits, price } = PLANS[p];
          const dark = p === "PRO";
          const feats = [
            limits.juniors === 0
              ? t("billing.featJuniors0")
              : limits.juniors === 1
                ? t("billing.featJuniors1")
                : tf("billing.featJuniors", { n: fmtNumber(limits.juniors, locale) }),
            tf("billing.featPages", { n: fmtNumber(limits.pagesPerMonth, locale) }),
            tf("billing.featStorage", { n: fmtNumber(limits.storageBytes / GB, locale) }),
          ];
          return (
            <div
              key={p}
              className={cn("flex flex-col rounded-2xl p-6", dark ? "bg-graphite text-white" : "bg-neutral-100/70 ring-1 ring-neutral-200")}
            >
              <h3 className="text-2xl font-medium">{t(`billing.plan.${p}` as MessageKey)}</h3>
              <p className={cn("mt-2", dark ? "text-white/70" : "text-neutral-600")}>{t(`billing.planHint.${p}` as MessageKey)}</p>
              <p className="mt-10 text-4xl font-semibold tabular-nums">{rupees(price![interval], locale)}</p>
              <p className={cn("mt-2 text-sm", dark ? "text-white/60" : "text-neutral-500")}>
                {t(interval === "MONTHLY" ? "billing.perMonth" : "billing.perYear")} · {t("billing.plusGst")}
              </p>
              <TrialButton light={dark} className="mt-6 w-full" />
              <div className={cn("mt-6 border-t pt-6", dark ? "border-white/15" : "border-neutral-200")}>
                <p className="font-medium">{t("home.pricing.included")}</p>
                <ul className="mt-3 flex flex-col gap-2.5">
                  {feats.map((f) => (
                    <li key={f} className={cn("flex items-start gap-2", dark ? "text-white/85" : "text-neutral-700")}>
                      <HugeiconsIcon icon={Tick02Icon} className="mt-1 size-4 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-sm text-neutral-500">
        {t("legal.pricingNote")}{" "}
        <Link to="/pricing" className="text-link underline underline-offset-4">
          {t("home.pricing.more")}
        </Link>
      </p>
    </section>
  );
}

// ---------- Trust and records ----------

function Trust() {
  const { t } = useI18n();
  const items = ["encrypted", "india", "log", "share"] as const;
  const docs: MessageKey[] = ["home.doc.712", "home.doc.ferfar", "home.doc.index2", "home.doc.orders"];
  return (
    <section id="trust" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-16 md:py-24">
      <div className="grid gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <H2>{t("home.trust.title")}</H2>
          <TrialButton className="mt-8" />
          <p className="mt-6">
            <Link to="/privacy" className="text-link underline underline-offset-4">
              {t("legal.privacy")}
            </Link>
          </p>
        </div>
        <ul className="flex flex-col gap-7 border-s border-neutral-300 ps-6">
          {items.map((k) => (
            <li key={k}>
              <h3 className="font-semibold">{t(`home.t.${k}` as MessageKey)}</h3>
              <p className="mt-1 text-neutral-600">{t(`home.t.${k}Text` as MessageKey)}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-20">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-4">
          <h3 className="text-2xl font-medium tracking-tight">{t("home.records.title")}</h3>
          <HugeiconsIcon icon={FileScanIcon} className="size-6 text-neutral-500" />
        </div>
        <p className="mt-4 text-neutral-600">{t("home.reads")}</p>
        <ul className="mt-2">
          {docs.map((d) => (
            <li key={d} className="flex items-center gap-4 border-b border-neutral-200 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                <HugeiconsIcon icon={FileScanIcon} className="size-5" />
              </span>
              <span className="flex-1 text-lg">{t(d)}</span>
              <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-sm text-neutral-600">{t("home.included")}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faq() {
  const { t } = useI18n();
  return (
    <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-24 gap-8 px-4 py-16 md:grid-cols-[1fr_2fr] md:py-24">
      <H2>{t("home.faq.title")}</H2>
      <div className="border-t border-neutral-200">
        {([1, 2, 3, 4, 5, 6] as const).map((n) => (
          <details key={n} className="group border-b border-neutral-200 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
              {t(`home.q${n}` as MessageKey)}
              <span aria-hidden className="text-2xl leading-none text-neutral-400 transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-neutral-600">{t(`home.a${n}` as MessageKey)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCall() {
  const { t } = useI18n();
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20">
      <div className="relative overflow-hidden rounded-2xl bg-mist px-6 py-16 text-white md:px-14 md:py-24">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-graphite/50 to-transparent" />
        <div className="relative max-w-2xl">
          <h2 className="text-4xl leading-[1.2] font-semibold tracking-tight text-balance md:text-6xl">{t("home.final.title")}</h2>
          <p className="mt-4 text-lg text-white/90">{t("home.final.sub")}</p>
          <TrialButton light className="mt-8" />
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const { t } = useI18n();
  const cols: { title: MessageKey; links: { label: string; to?: string; href?: string }[] }[] = [
    {
      title: "home.footer.product",
      links: [
        { label: t("home.nav.features"), href: "#features" },
        { label: t("home.nav.how"), href: "#how" },
        { label: t("home.nav.pricing"), href: "#pricing" },
        { label: t("home.nav.faq"), href: "#faq" },
      ],
    },
    { title: "home.footer.legal", links: POLICY_LINKS.map((l) => ({ label: t(l.key), to: l.to })) },
    {
      title: "home.footer.account",
      links: [
        { label: t("auth.signIn"), to: "/login" },
        { label: t("legal.startTrial"), to: "/register" },
      ],
    },
  ];
  return (
    <footer className="relative overflow-hidden bg-graphite text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-4 pt-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 md:col-span-1">
          <Brand compact onDark />
          <p className="mt-5 text-2xl leading-snug font-medium tracking-tight">
            {t("home.footer.tag1")}
            <br />
            <span className="text-white/50">{t("home.footer.tag2")}</span>
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm text-white/50">{t(c.title)}</p>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {c.links.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <Link to={l.to} className="text-white/80 hover:text-white">
                      {l.label}
                    </Link>
                  ) : (
                    <a href={l.href} className="text-white/80 hover:text-white">
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {/* The name, big and faint, over a little of the mist. */}
      <div aria-hidden className="relative mt-16 select-none">
        <div className="absolute bottom-0 left-1/2 h-40 w-[70%] -translate-x-1/2 rounded-full bg-[#6f86b3]/35 blur-3xl" />
        <p className="relative -mb-[0.12em] bg-gradient-to-b from-white/70 to-white/5 bg-clip-text pt-[0.25em] text-center text-[20vw] leading-[1.25] font-semibold tracking-tight text-transparent lg:text-[13rem]">
          {t("app.name")}
        </p>
      </div>
    </footer>
  );
}
