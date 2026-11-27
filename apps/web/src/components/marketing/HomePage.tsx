import {
  ArrowRight01Icon,
  ArrowRight02Icon,
  BadgeIndianRupeeIcon,
  Calendar03Icon,
  CheckmarkCircle01Icon,
  CourtHouseIcon,
  FileScanIcon,
  Folder01Icon,
  Search01Icon,
  SquareLock02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import type { QueryClient } from "@tanstack/react-query";
import { Link, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { type BillingInterval, GST_REGISTERED, PAID_PLANS, PLANS, TRIAL_DAYS } from "@vakilmitra/shared";
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

/** Paths of the home page in each language. Search engines get both (see src/seo.ts). */
export const HOME_PATH = { mr: "/", en: "/en" } as const;

/** Before the home page loads: a signed-in advocate goes straight to their day. */
export async function sendSignedInToToday({ context }: { context: { queryClient: QueryClient } }) {
  let signedIn = false;
  try {
    await context.queryClient.ensureQueryData(meQuery);
    signedIn = true;
  } catch {
    // Not signed in (or the API is unreachable): show the home page.
  }
  if (signedIn) throw redirect({ to: "/today" });
}

/** The public home page, in Marathi at / and in English at /en. */
export function HomePage() {
  const { t, locale } = useI18n();
  const { pathname, hash } = useLocation();
  const navigate = useNavigate();
  // The tab title and description follow the language on screen.
  useEffect(() => {
    document.title = t("home.metaTitle");
    document.querySelector('meta[name="description"]')?.setAttribute("content", t("home.metaDescription"));
  }, [t]);
  // The address follows the language too, so each language has its own page to link and index.
  useEffect(() => {
    if (pathname !== HOME_PATH[locale]) void navigate({ to: HOME_PATH[locale], hash: hash || undefined, replace: true });
  }, [locale, pathname, hash, navigate]);

  return (
    <div className="min-h-dvh overflow-x-clip bg-white text-graphite">
      <SiteHeader />
      <main>
        <Hero />
        <MadeFor />
        <Features />
        <Showcase id="how" bg="bg-lilac-deep" title={t("home.land.title")} text={t("home.land.text")}>
          <StepsMock />
        </Showcase>
        <Showcase id="report" bg="bg-lilac" title={t("home.reportH.title")} text={t("home.rules.sub")}>
          <ReportMock />
        </Showcase>
        <Showcase id="today" bg="bg-lilac-soft" title={t("home.today.title")} text={t("home.today.text")}>
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
  <h2 className={cn("tight text-[2.5rem] font-semibold text-balance md:text-6xl", className)}>{children}</h2>
);

/** The main call to action: near-black on light ground, white on dark. */
function TrialButton({ className, light = false, arrow = true }: { className?: string; light?: boolean; arrow?: boolean }) {
  const { t } = useI18n();
  return (
    <Button
      size="lg"
      className={cn(
        "h-12 gap-2 rounded-xl px-6 text-base font-medium md:h-13",
        light ? "bg-white text-graphite hover:bg-white/90" : "bg-graphite text-white hover:bg-graphite/90",
        className,
      )}
      asChild
    >
      <Link to="/register">
        {t("legal.startTrial")}
        {arrow && <HugeiconsIcon icon={ArrowRight02Icon} className="size-5" />}
      </Link>
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
    <header className="fixed inset-x-4 top-4 z-30 mx-auto max-w-6xl rounded-full bg-white/85 shadow-[0_8px_30px_rgb(20_13_53/0.1)] ring-1 ring-black/5 backdrop-blur-md">
      <div className="flex h-15 items-center gap-2 ps-5 pe-2.5">
        <Link to="/" aria-label={t("app.name")} className="flex items-center gap-2">
          <Brand compact />
          <span className="hidden text-lg font-bold tracking-tight sm:inline">{t("app.name")}</span>
        </Link>
        <nav aria-label={t("nav.main")} className="ms-8 hidden items-center gap-7 text-[15px] lg:flex">
          {links.map(([href, key]) => (
            <a key={href} href={href} className="text-graphite/65 transition-colors hover:text-graphite">
              {t(key)}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <LanguageToggle compact className="h-10 rounded-xl px-3 text-[15px] hover:bg-sand" />
          <Button variant="ghost" size="sm" className="h-10 rounded-xl px-3 text-[15px] hover:bg-sand" asChild>
            <Link to="/login">{t("auth.signIn")}</Link>
          </Button>
          <Button size="sm" className="h-10 rounded-xl bg-graphite px-4 text-[15px] text-white hover:bg-graphite/90" asChild>
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
      {/* The sky stops part-way down the product picture, so the picture sits across the edge. */}
      <div aria-hidden className="absolute inset-x-0 top-0 bottom-32 bg-lilac md:bottom-48">
        <div className="absolute inset-0 bg-gradient-to-b from-night/40 via-night/10 to-transparent" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 pt-32 md:pt-44">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/25 backdrop-blur">
          <span className="size-1.5 rounded-full bg-white" />
          {tf("home.pill", { days: fmtNumber(TRIAL_DAYS, locale) })}
        </p>
        <h1 className="tight mt-6 max-w-4xl text-[2.75rem] font-semibold text-balance text-white md:text-7xl">
          {t("home.hero1")} <span className="text-white/70">{t("home.hero2")}</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/90 text-pretty md:text-xl">{t("home.heroSub")}</p>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <TrialButton className="w-full sm:w-auto" />
          <Button
            size="lg"
            className="h-12 w-full rounded-xl bg-white px-6 text-base font-medium text-graphite hover:bg-white/90 sm:w-auto md:h-13"
            asChild
          >
            <a href="#how">{t("home.seeHow")}</a>
          </Button>
        </div>
      </div>
      <div className="relative mx-auto mt-16 max-w-6xl px-4 md:mt-24">
        <CasesMock />
      </div>
    </section>
  );
}

function MadeFor() {
  const { t } = useI18n();
  const docs: MessageKey[] = ["home.doc.712", "home.doc.ferfar", "home.doc.index2", "home.doc.orders"];
  return (
    <section className="mx-auto max-w-6xl px-4 pt-16 pb-20 md:pt-24 md:pb-28">
      <p className="text-lg text-graphite/55">{t("home.madeFor")}</p>
      <ul className="mt-8 flex flex-wrap gap-x-12 gap-y-4 text-2xl font-semibold tracking-tight text-graphite/35 md:text-3xl">
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
    <div aria-hidden className="mt-8 flex gap-2.5">
      {icons.map((icon, i) => (
        <span key={i} className="flex size-12 items-center justify-center rounded-2xl bg-sand text-link">
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
    <section id="features" className="mx-auto grid max-w-6xl scroll-mt-28 gap-x-12 px-4 pb-16 md:grid-cols-3">
      {items.map((x) => (
        <div key={x.n} className="border-t border-black/10 py-12">
          <h3 className="text-2xl leading-snug font-semibold tracking-tight">{t(`home.f${x.n}.title` as MessageKey)}</h3>
          <p className="mt-4 text-lg leading-relaxed text-graphite/65">{t(`home.f${x.n}.text` as MessageKey)}</p>
          <IconRow icons={x.icons} />
          <a href={x.href} className="mt-8 inline-flex items-center gap-1 font-semibold text-link hover:underline">
            {t("home.learnMore")}
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </a>
        </div>
      ))}
    </section>
  );
}

/** A product picture on a lilac panel, then a big name and a few lines about it. */
function Showcase({ id, bg, title, text, children }: { id: string; bg: string; title: string; text: string; children: ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-6xl scroll-mt-28 px-4 py-16 md:py-20">
      <div
        className={cn("flex min-h-96 items-center justify-center overflow-hidden rounded-[2rem] px-5 py-12 md:min-h-[32rem] md:p-16", bg)}
      >
        {children}
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2 md:gap-14">
        <H2>{title}</H2>
        <p className="text-lg leading-relaxed text-graphite/65 md:pt-2 md:text-xl">{text}</p>
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
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-20 md:py-28">
      <H2>
        {tf("home.pricing.title", { price: rupees(PLANS.SOLO.price!.MONTHLY, locale) })}{" "}
        <span className="text-link">{tf("home.pricing.free", { days: fmtNumber(TRIAL_DAYS, locale) })}</span>
      </H2>
      <p className="mt-5 max-w-2xl text-lg leading-relaxed text-graphite/65 md:text-xl">{t("billing.everyPlan")}</p>
      <div className="mt-10 flex flex-wrap gap-2">
        {(["MONTHLY", "YEARLY"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={interval === v}
            onClick={() => setInterval(v)}
            className={cn(
              "h-12 rounded-xl px-5 text-base font-medium transition-colors",
              interval === v ? "bg-link text-white" : "bg-sand text-graphite hover:bg-sand/70",
            )}
          >
            {t(v === "MONTHLY" ? "billing.monthly" : "billing.yearly")}
            {v === "YEARLY" && (
              <span className={cn("ms-2 text-sm", interval === v ? "text-white/80" : "text-link")}>{t("billing.yearlySave")}</span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
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
            tf("billing.featAi", { n: fmtNumber(limits.aiPerMonth, locale) }),
            tf("billing.featTracked", { n: fmtNumber(limits.trackedCases, locale) }),
          ];
          return (
            <div key={p} className={cn("flex flex-col rounded-[2rem] p-7 md:p-8", dark ? "bg-night text-white" : "bg-sand")}>
              <h3 className="text-2xl font-semibold tracking-tight">{t(`billing.plan.${p}` as MessageKey)}</h3>
              <p className={cn("mt-3 text-lg", dark ? "text-lilac-text" : "text-graphite/65")}>
                {t(`billing.planHint.${p}` as MessageKey)}
              </p>
              <p className="tight mt-10 text-5xl font-semibold tabular-nums md:text-6xl">{rupees(price![interval], locale)}</p>
              <p className={cn("mt-3 text-base", dark ? "text-white/65" : "text-graphite/55")}>
                {t(interval === "MONTHLY" ? "billing.perMonth" : "billing.perYear")}
                {GST_REGISTERED && ` · ${t("billing.plusGst")}`}
              </p>
              <TrialButton light={dark} arrow={dark} className="mt-7 w-full" />
              <div className={cn("mt-8 border-t pt-7", dark ? "border-white/15" : "border-black/10")}>
                <p className="font-semibold">{t("home.pricing.included")}</p>
                <ul className="mt-4 flex flex-col gap-3">
                  {feats.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-lg">
                      <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        className={cn("mt-0.5 size-6 shrink-0", dark ? "text-lilac-text" : "text-graphite")}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-graphite/55">
        {t(GST_REGISTERED ? "legal.pricingNote" : "legal.pricingNoteNoGst")}{" "}
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
    <section id="trust" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-20 md:py-28">
      <div className="grid gap-12 md:grid-cols-2 md:gap-16">
        <div>
          <H2>{t("home.trust.title")}</H2>
          <TrialButton className="mt-10 w-full sm:w-auto" />
          <p className="mt-6">
            <Link to="/privacy" className="font-medium text-link underline underline-offset-4">
              {t("legal.privacy")}
            </Link>
          </p>
        </div>
        <ul className="flex flex-col gap-8 border-s border-black/10 ps-7">
          {items.map((k) => (
            <li key={k}>
              <h3 className="text-lg font-semibold">{t(`home.t.${k}` as MessageKey)}</h3>
              <p className="mt-1.5 text-lg text-graphite/65">{t(`home.t.${k}Text` as MessageKey)}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-24">
        <div className="flex items-center justify-between gap-4 border-b border-black/10 pb-5">
          <h3 className="text-2xl font-semibold tracking-tight">{t("home.records.title")}</h3>
          <HugeiconsIcon icon={FileScanIcon} className="size-6 text-link" />
        </div>
        <p className="mt-5 text-lg text-graphite/65">{t("home.reads")}</p>
        <ul className="mt-2">
          {docs.map((d) => (
            <li key={d} className="flex items-center gap-4 border-b border-black/10 py-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-sand text-link">
                <HugeiconsIcon icon={FileScanIcon} className="size-5" />
              </span>
              <span className="flex-1 text-lg">{t(d)}</span>
              <span className="rounded-full bg-sand px-3 py-1 text-sm font-medium text-graphite/70">{t("home.included")}</span>
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
    <section id="faq" className="mx-auto grid max-w-6xl scroll-mt-28 gap-10 px-4 py-20 md:grid-cols-[1fr_2fr] md:py-28">
      <H2>{t("home.faq.title")}</H2>
      <div className="border-t border-black/10">
        {([1, 2, 3, 4, 5, 6] as const).map((n) => (
          <details key={n} className="group border-b border-black/10 py-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
              {t(`home.q${n}` as MessageKey)}
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sand text-xl leading-none transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-lg leading-relaxed text-graphite/65">{t(`home.a${n}` as MessageKey)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCall() {
  const { t } = useI18n();
  return (
    <section className="mx-auto max-w-6xl px-4 pb-24">
      <div className="relative overflow-hidden rounded-[2rem] bg-lilac px-6 py-16 text-white md:px-16 md:py-28">
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-night/50 to-transparent" />
        <div className="relative max-w-2xl">
          <h2 className="tight text-[2.5rem] font-semibold text-balance md:text-6xl">{t("home.final.title")}</h2>
          <p className="mt-5 text-lg leading-relaxed text-white/90 md:text-xl">{t("home.final.sub")}</p>
          <TrialButton light className="mt-10 w-full sm:w-auto" />
        </div>
      </div>
    </section>
  );
}

function SiteFooter() {
  const { t, locale, setLocale } = useI18n();
  const other = locale === "mr" ? "en" : "mr";
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
    <footer className="relative overflow-hidden bg-night text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-4 pt-20 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 md:col-span-1">
          <Brand compact />
          <p className="mt-6 text-2xl leading-snug font-semibold tracking-tight">
            {t("home.footer.tag1")}
            <br />
            <span className="text-lilac-text">{t("home.footer.tag2")}</span>
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm text-white/50">{t(c.title)}</p>
            <ul className="mt-4 flex flex-col gap-3">
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
      <div className="mx-auto mt-12 flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 text-sm text-white/50">
        <p>{t("legal.madeBy")}</p>
        {/* A real link to the page in the other language, for readers and for search engines. */}
        <Link to={HOME_PATH[other]} lang={other} onClick={() => setLocale(other)} className="text-white/80 hover:text-white">
          {other === "en" ? "Read in English" : "मराठीत वाचा"}
        </Link>
      </div>
      {/* The name, big and faint, over a little indigo glow. */}
      <div aria-hidden className="relative mt-16 select-none">
        <div className="absolute bottom-0 left-1/2 h-40 w-[70%] -translate-x-1/2 rounded-full bg-link/40 blur-3xl" />
        <p className="relative -mb-[0.12em] bg-gradient-to-b from-lilac-text/80 to-white/5 bg-clip-text pt-[0.25em] text-center text-[20vw] leading-[1.25] font-semibold tracking-tight text-transparent lg:text-[13rem]">
          {t("app.name")}
        </p>
      </div>
    </footer>
  );
}
