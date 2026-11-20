import "@fontsource/tiro-devanagari-marathi/devanagari-400.css";
import "@fontsource/tiro-devanagari-marathi/latin-400.css";
import {
  Alert02Icon,
  ArrowRight01Icon,
  BadgeIndianRupeeIcon,
  Calendar03Icon,
  Camera01Icon,
  Cancel01Icon,
  CheckmarkCircle02Icon,
  CourtHouseIcon,
  FileScanIcon,
  Folder01Icon,
  GavelIcon,
  JusticeScale01Icon,
  Link04Icon,
  Location01Icon,
  RepeatIcon,
  Search01Icon,
  SquareLock02Icon,
  Tick02Icon,
  UserMultipleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { type BillingInterval, PLANS, TRIAL_DAYS } from "@vakilmitra/shared";
import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { Brand } from "@/components/Brand";
import { LanguageToggle } from "@/components/LanguageToggle";
import { POLICY_LINKS } from "@/components/legal/LegalPage";
import { ApproveStep, CasesMock, CheckStep, Phone, ReadStep, ReportMock, ScanStep, TodayMock } from "@/components/marketing/mocks";
import { PlanCards } from "@/components/PlanCards";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    <div className="min-h-dvh overflow-x-clip bg-background">
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <Compare />
        <Morning />
        <HowItWorks />
        <Rules />
        <Trust />
        <Pricing />
        <Faq />
        <FinalCall />
      </main>
      <SiteFooter />
    </div>
  );
}

// ---------- Pieces ----------

const H2 = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 className={cn("font-serif text-4xl leading-[1.15] text-balance md:text-5xl", className)}>{children}</h2>
);

function TrialButton({ className, variant = "default" }: { className?: string; variant?: "default" | "secondary" }) {
  const { t } = useI18n();
  return (
    <Button size="lg" variant={variant} className={cn("h-12 rounded-full px-6 text-base", className)} asChild>
      <Link to="/register">
        {t("legal.startTrial")}
        <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
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
    <header className="sticky top-0 z-30 border-b border-transparent bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link to="/" aria-label={t("app.name")}>
          <Brand />
        </Link>
        <nav aria-label={t("nav.main")} className="ms-8 hidden items-center gap-6 text-sm lg:flex">
          {links.map(([href, key]) => (
            <a key={href} href={href} className="text-muted-foreground transition-colors hover:text-foreground">
              {t(key)}
            </a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1 sm:gap-2">
          <LanguageToggle compact />
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">{t("auth.signIn")}</Link>
          </Button>
          <Button size="sm" className="hidden rounded-full sm:inline-flex" asChild>
            <Link to="/register">{t("legal.startTrial")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

// ---------- Hero ----------

/** Tiles of the trade floating round the headline: where, colour, tilt, and from which width up. */
const TILES: { icon: IconSvgElement; pos: string; tone: string; tilt: number; delay: number; phone?: boolean }[] = [
  {
    icon: JusticeScale01Icon,
    pos: "left-3 top-3 md:left-[6%] md:top-[14%]",
    tone: "bg-violet-500 text-white",
    tilt: -8,
    delay: 0,
    phone: true,
  },
  { icon: Calendar03Icon, pos: "left-[16%] top-[44%]", tone: "bg-white text-sky-600", tilt: 6, delay: 1.2 },
  { icon: FileScanIcon, pos: "left-[4%] top-[70%]", tone: "bg-amber-300 text-amber-950", tilt: -5, delay: 2.1 },
  { icon: GavelIcon, pos: "left-[24%] top-[6%]", tone: "bg-neutral-900 text-white", tilt: 10, delay: 0.6 },
  {
    icon: BadgeIndianRupeeIcon,
    pos: "right-3 top-3 md:right-[7%] md:top-[12%]",
    tone: "bg-emerald-500 text-white",
    tilt: 8,
    delay: 0.3,
    phone: true,
  },
  { icon: Folder01Icon, pos: "right-[18%] top-[40%]", tone: "bg-white text-orange-500", tilt: -6, delay: 1.6 },
  { icon: CourtHouseIcon, pos: "right-[4%] top-[66%]", tone: "bg-rose-500 text-white", tilt: 5, delay: 2.4 },
  { icon: Search01Icon, pos: "right-[26%] top-[4%]", tone: "bg-sky-500 text-white", tilt: -10, delay: 0.9 },
];

function Hero() {
  const { t, tf, locale } = useI18n();
  const days = fmtNumber(TRIAL_DAYS, locale);
  const stats = [
    { value: days, label: t("home.stat1"), icon: Calendar03Icon, tone: "text-sky-600 bg-sky-50" },
    {
      value: rupees(PLANS.SOLO.price!.MONTHLY, locale),
      label: t("home.stat2"),
      icon: BadgeIndianRupeeIcon,
      tone: "text-emerald-600 bg-emerald-50",
    },
    { value: `${fmtNumber(100, locale)}%`, label: t("home.stat3"), icon: CheckmarkCircle02Icon, tone: "text-violet-600 bg-violet-50" },
  ];
  const docs: MessageKey[] = ["home.doc.712", "home.doc.ferfar", "home.doc.index2", "home.doc.orders"];
  return (
    <section className="relative">
      {/* Soft colour and a dot grid behind the headline. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-violet-100),transparent_60%)] opacity-70"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [background-image:radial-gradient(var(--color-neutral-300)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)] opacity-60"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {TILES.map((x) => (
          <span
            key={x.pos}
            style={{ "--tilt": `${x.tilt}deg`, animationDelay: `${x.delay}s`, rotate: `${x.tilt}deg` } as CSSProperties}
            className={cn(
              "absolute flex size-10 items-center justify-center rounded-2xl shadow-lg ring-1 ring-foreground/5 motion-safe:animate-float md:size-14",
              x.pos,
              x.tone,
              !x.phone && "hidden md:flex",
            )}
          >
            <HugeiconsIcon icon={x.icon} className="size-5 md:size-6" />
          </span>
        ))}
      </div>

      <div className="relative mx-auto max-w-3xl px-4 pt-16 pb-10 text-center md:pt-24">
        <p className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-sm shadow-sm ring-1 ring-foreground/10">
          <span className="size-2 rounded-full bg-emerald-500" />
          {tf("home.pill", { days })}
        </p>
        <h1 className="mt-6 font-serif text-5xl leading-[1.1] tracking-tight text-balance md:text-7xl">
          {t("home.hero1")}
          <br />
          <span className="text-muted-foreground">{t("home.hero2")}</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground text-pretty">{t("home.heroSub")}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <TrialButton />
          <Button size="lg" variant="outline" className="h-12 rounded-full bg-card px-6 text-base" asChild>
            <a href="#how">{t("home.seeHow")}</a>
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pb-14 text-center">
        <p className="font-serif text-2xl">{t("home.statsLead")}</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-2 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10">
              <span className={cn("flex size-9 items-center justify-center rounded-xl", s.tone)}>
                <HugeiconsIcon icon={s.icon} className="size-5" />
              </span>
              <span className="font-serif text-4xl tabular-nums">{s.value}</span>
              <span className="text-sm text-muted-foreground">{s.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-10 text-sm text-muted-foreground">{t("home.reads")}</p>
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {docs.map((d) => (
            <li
              key={d}
              className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium shadow-sm ring-1 ring-foreground/10"
            >
              <HugeiconsIcon icon={FileScanIcon} className="size-4 text-orange-500" />
              {t(d)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------- Sections ----------

function Problem() {
  const { t } = useI18n();
  return (
    <section id="features" className="scroll-mt-16 bg-gradient-to-b from-muted/60 to-background">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <H2>{t("home.problem.title")}</H2>
          <p className="mt-4 text-lg text-muted-foreground">{t("home.problem.sub")}</p>
        </div>
        <div className="mt-12">
          <CasesMock />
        </div>
      </div>
    </section>
  );
}

function Compare() {
  const { t } = useI18n();
  const cols: { title: string; items: MessageKey[]; icon: IconSvgElement[]; us?: boolean }[] = [
    {
      title: t("home.compare.diary"),
      items: ["home.compare.diary1", "home.compare.diary2", "home.compare.diary3"],
      icon: [Calendar03Icon],
    },
    { title: t("home.compare.chat"), items: ["home.compare.chat1", "home.compare.chat2", "home.compare.chat3"], icon: [Folder01Icon] },
    {
      title: t("app.name"),
      items: ["home.compare.us1", "home.compare.us2", "home.compare.us3", "home.compare.us4"],
      icon: [JusticeScale01Icon],
      us: true,
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:py-24">
      <H2 className="text-center">{t("home.compare.title")}</H2>
      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {cols.map((c) => (
          <div
            key={c.title}
            className={cn(
              "rounded-3xl p-6",
              c.us ? "bg-neutral-900 text-white shadow-xl md:-my-3 md:py-9" : "bg-card shadow-sm ring-1 ring-foreground/10",
            )}
          >
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-xl",
                  c.us ? "bg-white text-neutral-900" : "bg-muted text-muted-foreground",
                )}
              >
                <HugeiconsIcon icon={c.icon[0]} className="size-5" />
              </span>
              <h3 className="font-heading text-lg font-semibold">{c.title}</h3>
            </div>
            <ul className="mt-5 flex flex-col gap-3">
              {c.items.map((k) => (
                <li key={k} className="flex gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full",
                      c.us ? "bg-emerald-400 text-neutral-900" : "bg-red-50 text-red-600",
                    )}
                  >
                    <HugeiconsIcon icon={c.us ? Tick02Icon : Cancel01Icon} className="size-3" strokeWidth={2.5} />
                  </span>
                  <span className={c.us ? "text-white/90" : "text-muted-foreground"}>{t(k)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-10 flex justify-center">
        <TrialButton />
      </div>
    </section>
  );
}

function Chip({ icon, tone, children }: { icon: IconSvgElement; tone: string; children: ReactNode }) {
  return (
    <span className="mx-1 inline-flex translate-y-[-0.1em] items-center gap-2 align-middle">
      <span className={cn("inline-flex size-9 items-center justify-center rounded-xl md:size-11", tone)}>
        <HugeiconsIcon icon={icon} className="size-5" />
      </span>
      <span>{children}</span>
    </span>
  );
}

function Morning() {
  const { t } = useI18n();
  return (
    <section className="border-y bg-muted/40">
      <p className="mx-auto max-w-4xl px-4 py-20 text-center font-serif text-3xl leading-[1.6] text-balance md:text-[2.6rem]">
        <span className="text-muted-foreground">{t("home.morning.lead")}</span>{" "}
        <Chip icon={CourtHouseIcon} tone="bg-sky-100 text-sky-700">
          {t("home.morning.a")}
        </Chip>{" "}
        <Chip icon={Alert02Icon} tone="bg-red-100 text-red-700">
          {t("home.morning.b")}
        </Chip>{" "}
        <span className="text-muted-foreground">{t("home.morning.and")}</span>{" "}
        <Chip icon={BadgeIndianRupeeIcon} tone="bg-emerald-100 text-emerald-700">
          {t("home.morning.c")}
        </Chip>
      </p>
    </section>
  );
}

function HowItWorks() {
  const { t, locale } = useI18n();
  const steps = [
    { n: 1, art: <ScanStep />, tone: "from-orange-100 to-orange-50 ring-orange-200", dot: "bg-orange-500" },
    { n: 2, art: <ReadStep />, tone: "from-emerald-100 to-emerald-50 ring-emerald-200", dot: "bg-emerald-500" },
    { n: 3, art: <CheckStep />, tone: "from-sky-100 to-sky-50 ring-sky-200", dot: "bg-sky-500" },
    { n: 4, art: <ApproveStep />, tone: "from-violet-100 to-violet-50 ring-violet-200", dot: "bg-violet-500" },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 md:py-28">
      <div className="text-center">
        <H2>{t("home.how.title")}</H2>
        <p className="mt-4 text-lg text-muted-foreground">{t("home.how.sub")}</p>
      </div>
      <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <li key={s.n} className="flex flex-col">
            <div aria-hidden className={cn("flex h-56 items-center justify-center rounded-3xl bg-gradient-to-b ring-1", s.tone)}>
              {s.art}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span
                className={cn("flex size-6 items-center justify-center rounded-full text-xs font-semibold text-white tabular-nums", s.dot)}
              >
                {fmtNumber(s.n, locale)}
              </span>
              <h3 className="font-heading text-lg font-semibold">{t(`home.how${s.n}` as MessageKey)}</h3>
            </div>
            <p className="mt-1.5 text-muted-foreground">{t(`home.how${s.n}Text` as MessageKey)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** "Not [guesswork]." with the bracketed word struck through. */
function Struck({ text }: { text: string }) {
  const parts = text.split(/\[|\]/);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <span key={p} className="relative text-white/50">
            {p}
            <span aria-hidden className="absolute inset-x-0 top-1/2 h-[3px] -rotate-3 rounded-full bg-red-500" />
          </span>
        ) : (
          <span key={p}>{p}</span>
        ),
      )}
    </>
  );
}

function Rules() {
  const { t } = useI18n();
  const points: { icon: IconSvgElement; k: MessageKey }[] = [
    { icon: Link04Icon, k: "home.rules.p1" },
    { icon: RepeatIcon, k: "home.rules.p2" },
    { icon: CheckmarkCircle02Icon, k: "home.rules.p3" },
  ];
  return (
    <section className="relative overflow-hidden bg-neutral-950 text-white">
      <div aria-hidden className="absolute -top-40 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-violet-600/25 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-serif text-4xl leading-[1.15] text-balance md:text-6xl">
            {t("home.rules.title")}{" "}
            <span className="text-white/60">
              <Struck text={t("home.rules.second")} />
            </span>
          </h2>
          <p className="mt-5 text-lg text-white/70">{t("home.rules.sub")}</p>
        </div>
        <div className="mt-12">
          <ReportMock />
        </div>
        <ul className="mt-12 grid gap-4 text-sm text-white/80 sm:grid-cols-3">
          {points.map((p) => (
            <li key={p.k} className="flex items-center justify-center gap-2 text-center">
              <HugeiconsIcon icon={p.icon} className="size-4 shrink-0 text-violet-300" />
              {t(p.k)}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Trust() {
  const { t } = useI18n();
  const items: { icon: IconSvgElement; k: string; tone: string }[] = [
    { icon: SquareLock02Icon, k: "encrypted", tone: "bg-violet-100 text-violet-700" },
    { icon: Location01Icon, k: "india", tone: "bg-orange-100 text-orange-700" },
    { icon: Search01Icon, k: "log", tone: "bg-sky-100 text-sky-700" },
    { icon: UserMultipleIcon, k: "share", tone: "bg-emerald-100 text-emerald-700" },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:py-28">
      <H2 className="max-w-2xl">{t("home.trust.title")}</H2>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((x) => (
          <li key={x.k} className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-foreground/10">
            <span className={cn("flex size-11 items-center justify-center rounded-2xl", x.tone)}>
              <HugeiconsIcon icon={x.icon} className="size-5" />
            </span>
            <h3 className="mt-5 font-heading text-lg font-semibold">{t(`home.t.${x.k}` as MessageKey)}</h3>
            <p className="mt-1.5 text-muted-foreground">{t(`home.t.${x.k}Text` as MessageKey)}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6">
        <Link to="/privacy" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
          {t("legal.privacy")}
        </Link>
      </p>
    </section>
  );
}

function Pricing() {
  const { t, tf, locale } = useI18n();
  const [interval, setInterval] = useState<BillingInterval>("YEARLY");
  return (
    <section id="pricing" className="scroll-mt-16 bg-gradient-to-b from-muted/60 to-background">
      <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
        <div className="text-center">
          <H2>
            {tf("home.pricing.title", { price: rupees(PLANS.SOLO.price!.MONTHLY, locale) })}
            <br />
            <span className="text-muted-foreground">{tf("home.pricing.free", { days: fmtNumber(TRIAL_DAYS, locale) })}</span>
          </H2>
          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">{t("billing.everyPlan")}</p>
          <Tabs className="mt-8 items-center" value={interval} onValueChange={(v) => setInterval(v as BillingInterval)}>
            <TabsList>
              <TabsTrigger value="MONTHLY">{t("billing.monthly")}</TabsTrigger>
              <TabsTrigger value="YEARLY">
                {t("billing.yearly")} <span className="ml-1 text-xs text-success">{t("billing.yearlySave")}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="mt-8">
          <PlanCards
            interval={interval}
            action={(p) => (
              <Button className="w-full rounded-full" variant={p === "PRO" ? "default" : "outline"} asChild>
                <Link to="/register">{t("legal.startTrial")}</Link>
              </Button>
            )}
          />
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("legal.pricingNote")}{" "}
          <Link to="/pricing" className="text-foreground underline underline-offset-4">
            {t("home.pricing.more")}
          </Link>
        </p>
      </div>
    </section>
  );
}

function Faq() {
  const { t } = useI18n();
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-16 px-4 py-20 md:py-28">
      <H2 className="text-center">{t("home.faq.title")}</H2>
      <div className="mt-10 flex flex-col gap-3">
        {([1, 2, 3, 4, 5, 6] as const).map((n) => (
          <details key={n} className="group rounded-2xl bg-card px-5 py-4 shadow-sm ring-1 ring-foreground/10 open:shadow-md">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
              {t(`home.q${n}` as MessageKey)}
              <span
                aria-hidden
                className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-lg leading-none transition-transform group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-muted-foreground">{t(`home.a${n}` as MessageKey)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function FinalCall() {
  const { t, tf, locale } = useI18n();
  return (
    <section className="mx-auto max-w-6xl px-4 pb-20">
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-orange-100 via-rose-100 to-violet-200 px-6 pt-12 md:px-14 md:pt-0">
        <div className="grid items-center gap-10 md:grid-cols-[1.2fr_1fr]">
          <div className="md:py-16">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-sm">
              <HugeiconsIcon icon={Camera01Icon} className="size-4 text-orange-600" />
              {tf("home.pill", { days: fmtNumber(TRIAL_DAYS, locale) })}
            </p>
            <h2 className="mt-5 font-serif text-4xl leading-[1.15] text-balance md:text-6xl">{t("home.final.title")}</h2>
            <p className="mt-4 text-lg text-neutral-700">{t("home.final.sub")}</p>
            <TrialButton className="mt-8" />
          </div>
          <div className="mx-auto w-64 translate-y-6 md:mt-12 md:w-72">
            <Phone>
              <TodayMock />
            </Phone>
          </div>
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
    <footer className="relative overflow-hidden bg-neutral-950 text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-10 px-4 pt-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="col-span-2 md:col-span-1">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white text-neutral-900">
            <HugeiconsIcon icon={JusticeScale01Icon} className="size-5" />
          </span>
          <p className="mt-5 font-serif text-3xl leading-tight">
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
      {/* The name, big, rising out of a warm glow. */}
      <div aria-hidden className="relative mt-16 select-none">
        <div className="absolute bottom-0 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-orange-600/40 blur-3xl" />
        <p className="relative -mb-[0.12em] bg-gradient-to-b from-white/90 to-white/10 bg-clip-text pt-[0.25em] text-center font-serif text-[22vw] leading-[1.25] text-transparent lg:text-[15rem]">
          {t("app.name")}
        </p>
      </div>
    </footer>
  );
}
