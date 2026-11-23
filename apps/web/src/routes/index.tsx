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
    <div className="min-h-dvh overflow-x-clip bg-white font-home text-ink">
      <SiteHeader />
      <main>
        <Hero />
        <MadeFor />
        <Features />
        <Showcase id="how" dark title={t("home.land.title")} text={t("home.land.text")} icons={[FileScanIcon, Search01Icon, Folder01Icon]}>
          <StepsMock />
        </Showcase>
        <Showcase id="report" title={t("home.reportH.title")} text={t("home.rules.sub")}>
          <ReportMock />
        </Showcase>
        <Showcase
          id="today"
          dark
          title={t("home.today.title")}
          text={t("home.today.text")}
          icons={[Calendar03Icon, CourtHouseIcon, BadgeIndianRupeeIcon]}
        >
          <Phone className="w-64 translate-y-12 md:w-72 md:translate-y-16">
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

const Wrap = ({ children, className, id }: { children: ReactNode; className?: string; id?: string }) => (
  <section id={id} className={cn("mx-auto max-w-6xl scroll-mt-28 px-4", className)}>
    {children}
  </section>
);

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
        light ? "bg-white text-ink hover:bg-white/90" : "bg-ink text-white hover:bg-ink/90",
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
    <header className="fixed inset-x-4 top-4 z-30 mx-auto max-w-6xl rounded-full bg-white/85 shadow-[0_8px_30px_rgb(20_13_53/0.08)] ring-1 ring-black/5 backdrop-blur-md">
      <div className="flex h-15 items-center gap-2 ps-5 pe-2.5">
        <Link to="/" aria-label={t("app.name")} className="flex items-center gap-2">
          <Brand compact accent />
          <span className="hidden text-lg font-bold tracking-tight sm:inline">{t("app.name")}</span>
        </Link>
        <nav aria-label={t("nav.main")} className="ms-8 hidden items-center gap-7 text-[15px] lg:flex">
          {links.map(([href, key]) => (
            <a key={href} href={href} className="text-ink/65 transition-colors hover:text-ink">
              {t(key)}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1">
          <LanguageToggle compact className="h-10 rounded-xl px-3 text-[15px] hover:bg-sand" />
          <Button variant="ghost" size="sm" className="h-10 rounded-xl px-3 text-[15px] hover:bg-sand" asChild>
            <Link to="/login">{t("auth.signIn")}</Link>
          </Button>
          <Button size="sm" className="h-10 rounded-xl bg-ink px-4 text-[15px] text-white hover:bg-ink/90" asChild>
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
      <div aria-hidden className="absolute inset-x-0 top-0 bottom-40 bg-lilac-sky md:bottom-56" />
      <div className="relative mx-auto max-w-6xl px-4 pt-32 md:pt-44">
        <p className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3.5 py-1.5 text-sm font-medium text-white ring-1 ring-white/30 backdrop-blur">
          <span className="size-1.5 rounded-full bg-white" />
          {tf("home.pill", { days: fmtNumber(TRIAL_DAYS, locale) })}
        </p>
        <h1 className="tight mt-6 max-w-4xl text-[2.75rem] font-semibold text-balance text-white md:text-7xl">
          {t("home.hero1")} {t("home.hero2")}
        </h1>
        <p className="mt-6 max-w-xl text-lg text-white/90 text-pretty md:text-xl">{t("home.heroSub")}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <TrialButton className="w-full sm:w-auto" />
          <Button
            size="lg"
            className="h-12 w-full rounded-xl bg-white/20 px-6 text-base font-medium text-white ring-1 ring-white/40 hover:bg-white/30 sm:w-auto md:h-13"
            asChild
          >
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
  const { t } = useI18n();
  const docs: MessageKey[] = ["home.doc.712", "home.doc.ferfar", "home.doc.index2", "home.doc.orders"];
  return (
    <Wrap className="py-20 md:py-28">
      <p className="mx-auto max-w-2xl text-center text-2xl leading-snug text-balance md:text-3xl">{t("home.madeFor")}</p>
      <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        {docs.map((d) => (
          <li
            key={d}
            className="flex min-h-28 flex-col items-center justify-center gap-2 rounded-3xl px-4 py-5 text-center text-lg leading-snug font-semibold tracking-tight text-balance ring-1 ring-black/8 md:min-h-32 md:text-xl"
          >
            <HugeiconsIcon icon={FileScanIcon} className="size-6 shrink-0 text-iris" />
            {t(d)}
          </li>
        ))}
      </ul>
    </Wrap>
  );
}

// ---------- Features ----------

/** Overlapping icon tiles, like a small stack of cards. */
function IconStack({ icons, dark = false }: { icons: IconSvgElement[]; dark?: boolean }) {
  return (
    <div aria-hidden className="flex">
      {icons.map((icon, i) => (
        <span
          key={i}
          className={cn(
            "-ms-3 flex size-14 items-center justify-center rounded-2xl first:ms-0",
            dark ? "bg-night-2 text-white ring-4 ring-night" : "bg-white text-iris ring-4 ring-sand",
          )}
        >
          <HugeiconsIcon icon={icon} className="size-6" />
        </span>
      ))}
    </div>
  );
}

function Features() {
  const { t } = useI18n();
  const items: { n: 1 | 2 | 3; icons: IconSvgElement[]; href: string }[] = [
    { n: 1, icons: [Folder01Icon, Calendar03Icon, BadgeIndianRupeeIcon], href: "#today" },
    { n: 2, icons: [FileScanIcon, Search01Icon], href: "#how" },
    { n: 3, icons: [SquareLock02Icon, UserMultipleIcon], href: "#trust" },
  ];
  return (
    <Wrap id="features" className="grid gap-4 pb-8 md:grid-cols-3">
      {items.map((x) => (
        <div key={x.n} className="flex flex-col rounded-[2rem] bg-sand p-7 md:p-8">
          <IconStack icons={x.icons} />
          <h3 className="mt-8 text-2xl leading-snug font-semibold tracking-tight">{t(`home.f${x.n}.title` as MessageKey)}</h3>
          <p className="mt-3 text-lg leading-relaxed text-ink/65">{t(`home.f${x.n}.text` as MessageKey)}</p>
          <a href={x.href} className="mt-auto inline-flex items-center gap-1 pt-8 font-semibold text-iris hover:underline">
            {t("home.learnMore")}
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
          </a>
        </div>
      ))}
    </Wrap>
  );
}

/** A big card: the name and a few lines, then a product picture on a soft glow. */
function Showcase({
  id,
  dark = false,
  title,
  text,
  icons,
  children,
}: {
  id: string;
  dark?: boolean;
  title: string;
  text: string;
  icons?: IconSvgElement[];
  children: ReactNode;
}) {
  return (
    <Wrap id={id} className="py-4">
      <div className={cn("rounded-[2rem] p-6 md:p-14", dark ? "bg-night text-white" : "bg-sand")}>
        <div className="grid gap-6 md:grid-cols-2 md:gap-14">
          <H2 className={cn(dark && "text-white")}>{title}</H2>
          <div className="flex flex-col gap-8 md:pt-2">
            <p className={cn("text-lg leading-relaxed md:text-xl", dark ? "text-lilac" : "text-ink/65")}>{text}</p>
            {icons && <IconStack icons={icons} dark={dark} />}
          </div>
        </div>
        <div className="mt-10 flex min-h-80 items-center justify-center overflow-hidden rounded-3xl bg-lilac-glow px-4 py-10 text-ink md:mt-14 md:min-h-[28rem] md:p-14">
          {children}
        </div>
      </div>
    </Wrap>
  );
}

// ---------- Pricing ----------

const GB = 1024 ** 3;

function Pricing() {
  const { t, tf, locale } = useI18n();
  const [interval, setInterval] = useState<BillingInterval>("YEARLY");
  return (
    <Wrap id="pricing" className="py-20 md:py-28">
      <div className="text-center">
        <H2>
          {tf("home.pricing.title", { price: rupees(PLANS.SOLO.price!.MONTHLY, locale) })}{" "}
          <span className="text-iris">{tf("home.pricing.free", { days: fmtNumber(TRIAL_DAYS, locale) })}</span>
        </H2>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-ink/65 md:text-xl">{t("billing.everyPlan")}</p>
        <div className="mt-8 inline-flex flex-wrap justify-center gap-2">
          {(["MONTHLY", "YEARLY"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={interval === v}
              onClick={() => setInterval(v)}
              className={cn(
                "h-12 rounded-xl px-5 text-base font-medium transition-colors",
                interval === v ? "bg-iris text-white" : "bg-sand text-ink hover:bg-sand/70",
              )}
            >
              {t(v === "MONTHLY" ? "billing.monthly" : "billing.yearly")}
              {v === "YEARLY" && (
                <span className={cn("ms-2 text-sm", interval === v ? "text-white/80" : "text-iris")}>{t("billing.yearlySave")}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
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
            <div key={p} className={cn("flex flex-col rounded-[2rem] p-7", dark ? "bg-night text-white" : "bg-sand")}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-2xl font-semibold tracking-tight">{t(`billing.plan.${p}` as MessageKey)}</h3>
                {dark && (
                  <span className="rounded-full bg-iris px-3 py-1 text-xs font-semibold tracking-[0.12em] text-white uppercase">
                    {t("home.pricing.popular")}
                  </span>
                )}
              </div>
              <p className={cn("mt-3 text-lg", dark ? "text-lilac" : "text-ink/65")}>{t(`billing.planHint.${p}` as MessageKey)}</p>
              <p className="mt-8 flex flex-wrap items-baseline gap-x-2">
                <span className="tight text-5xl font-semibold tabular-nums md:text-6xl">{rupees(price![interval], locale)}</span>
                <span className={cn("text-lg", dark ? "text-white/70" : "text-ink/60")}>
                  {t(interval === "MONTHLY" ? "billing.perMonth" : "billing.perYear")}
                </span>
              </p>
              <p className={cn("mt-4 rounded-2xl px-5 py-3.5 text-base", dark ? "bg-night-2" : "bg-white")}>{t("billing.plusGst")}</p>
              <TrialButton light className={cn("mt-4 w-full", !dark && "ring-1 ring-black/5")} arrow={dark} />
              <div className={cn("mt-7 border-t pt-7", dark ? "border-white/15" : "border-black/10")}>
                <p className="font-semibold">{t("home.pricing.included")}</p>
                <ul className="mt-4 flex flex-col gap-3">
                  {feats.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-lg">
                      <HugeiconsIcon
                        icon={CheckmarkCircle01Icon}
                        className={cn("mt-0.5 size-6 shrink-0", dark ? "text-lilac" : "text-ink")}
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
      <p className="mt-6 text-center text-ink/60">
        {t("legal.pricingNote")}{" "}
        <Link to="/pricing" className="font-medium text-iris underline underline-offset-4">
          {t("home.pricing.more")}
        </Link>
      </p>
    </Wrap>
  );
}

// ---------- Trust and records ----------

function Trust() {
  const { t } = useI18n();
  const items = ["encrypted", "india", "log", "share"] as const;
  const docs: MessageKey[] = ["home.doc.712", "home.doc.ferfar", "home.doc.index2", "home.doc.orders"];
  return (
    <Wrap id="trust" className="pb-20 md:pb-28">
      <div className="grid gap-10 md:grid-cols-2 md:gap-16">
        <div>
          <H2>{t("home.trust.title")}</H2>
          <TrialButton className="mt-8 w-full sm:w-auto" />
          <p className="mt-6">
            <Link to="/privacy" className="font-medium text-iris underline underline-offset-4">
              {t("legal.privacy")}
            </Link>
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((k) => (
            <li key={k} className="rounded-3xl bg-sand p-6">
              <h3 className="text-lg font-semibold">{t(`home.t.${k}` as MessageKey)}</h3>
              <p className="mt-2 text-ink/65">{t(`home.t.${k}Text` as MessageKey)}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* The records it reads, as a table that fades into lilac at the bottom. */}
      <div className="mt-16 overflow-hidden rounded-[2rem] ring-1 ring-black/8">
        <div className="flex items-center gap-6 bg-sand px-6 py-4 text-sm font-semibold tracking-[0.1em] text-ink/70 uppercase">
          <span className="w-6">#</span>
          <span>{t("home.records.title")}</span>
        </div>
        <ul>
          {docs.map((d, i) => (
            <li
              key={d}
              className={cn(
                "flex items-center gap-6 border-t border-black/6 px-6 py-5 text-lg",
                i === 2 && "bg-[#f6f4fe]",
                i === 3 && "bg-[#e6e1fd]",
              )}
            >
              <span className="w-6 text-ink/50 tabular-nums">{i + 1}</span>
              <span className="flex-1">{t(d)}</span>
              <span className="hidden text-ink/60 sm:inline">{t("home.included")}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-5 text-ink/60">{t("home.reads")}</p>
    </Wrap>
  );
}

function Faq() {
  const { t } = useI18n();
  return (
    <Wrap id="faq" className="pb-20 md:pb-28">
      <H2 className="text-center">{t("home.faq.title")}</H2>
      <div className="mx-auto mt-12 flex max-w-3xl flex-col gap-3">
        {([1, 2, 3, 4, 5, 6] as const).map((n) => (
          <details key={n} className="group rounded-3xl bg-sand px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold [&::-webkit-details-marker]:hidden">
              {t(`home.q${n}` as MessageKey)}
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-xl leading-none transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-lg text-ink/65">{t(`home.a${n}` as MessageKey)}</p>
          </details>
        ))}
      </div>
    </Wrap>
  );
}

function FinalCall() {
  const { t } = useI18n();
  return (
    <Wrap className="pb-16">
      <div className="relative overflow-hidden rounded-[2rem] bg-night px-6 py-16 text-white md:px-14 md:py-24">
        <div aria-hidden className="absolute -top-24 -right-24 size-80 rounded-full bg-iris/50 blur-3xl" />
        <div className="relative max-w-2xl">
          <h2 className="tight text-[2.5rem] font-semibold text-balance md:text-6xl">{t("home.final.title")}</h2>
          <p className="mt-5 text-lg text-lilac md:text-xl">{t("home.final.sub")}</p>
          <TrialButton light className="mt-8 w-full sm:w-auto" />
        </div>
      </div>
    </Wrap>
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
    <footer className="relative overflow-hidden bg-night text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-4 pt-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 md:col-span-1">
          <Brand compact accent />
          <p className="mt-5 text-2xl leading-snug font-semibold tracking-tight">
            {t("home.footer.tag1")}
            <br />
            <span className="text-lilac">{t("home.footer.tag2")}</span>
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm text-white/50">{t(c.title)}</p>
            <ul className="mt-3 flex flex-col gap-2.5">
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
      {/* The name, big and faint, over a little violet glow. */}
      <div aria-hidden className="relative mt-16 select-none">
        <div className="absolute bottom-0 left-1/2 h-40 w-[70%] -translate-x-1/2 rounded-full bg-iris/40 blur-3xl" />
        <p className="relative -mb-[0.12em] bg-gradient-to-b from-lilac/80 to-white/5 bg-clip-text pt-[0.25em] text-center text-[20vw] leading-[1.25] font-semibold tracking-tight text-transparent lg:text-[13rem]">
          {t("app.name")}
        </p>
      </div>
    </footer>
  );
}
