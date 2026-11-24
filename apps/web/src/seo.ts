/**
 * What search engines and link previews read: each public page's title, description, canonical
 * address, language alternates, share card and structured data, plus robots.txt and the sitemap.
 * Used at build time by the prerender step (src/prerender.tsx); nothing here runs in the browser.
 */
import { GST_REGISTERED, type Locale, PAID_PLANS, PLANS, TRIAL_DAYS } from "@vakilmitra/shared";
import { interpolate, type MessageKey, translate } from "@vakilmitra/shared/i18n";
import { fmtNumber } from "./lib/format";
import { LEGAL } from "./lib/legal";

export interface PublicPage {
  path: string;
  locale: Locale;
  /** The page's title; the home page has its own, the others add the product's name. */
  title: MessageKey;
  description: MessageKey;
  /** The same page in each language, when it has more than one address. */
  alternates?: Record<Locale, string>;
  /** The home page carries the product and its questions as structured data. */
  home?: boolean;
}

const HOME_ALTERNATES = { mr: "/", en: "/en" } as const;

/** Every page built ahead of time. The rest of the app needs sign-in and stays out of search. */
export const PUBLIC_PAGES: PublicPage[] = [
  { path: "/", locale: "mr", title: "home.metaTitle", description: "home.metaDescription", alternates: HOME_ALTERNATES, home: true },
  { path: "/en", locale: "en", title: "home.metaTitle", description: "home.metaDescription", alternates: HOME_ALTERNATES, home: true },
  { path: "/pricing", locale: "mr", title: "legal.pricing", description: "legal.pricingIntro" },
  { path: "/terms", locale: "mr", title: "legal.terms", description: "home.metaDescription" },
  { path: "/privacy", locale: "mr", title: "legal.privacy", description: "home.metaDescription" },
  { path: "/refunds", locale: "mr", title: "legal.refunds", description: "home.metaDescription" },
  { path: "/delivery", locale: "mr", title: "legal.delivery", description: "home.metaDescription" },
  { path: "/contact", locale: "mr", title: "legal.contact", description: "home.metaDescription" },
];

/** The built file for a page: / is index.html, /en is en.html (Caddy tries {path}.html). */
export const fileFor = (path: string) => (path === "/" ? "index.html" : `${path.slice(1)}.html`);

const OG_LOCALE: Record<Locale, string> = { mr: "mr_IN", en: "en_IN" };
export const OG_IMAGE = { path: "/og-image.png", width: 1200, height: 630 };

const text = (locale: Locale, key: MessageKey) => interpolate(translate(locale, key), { days: fmtNumber(TRIAL_DAYS, locale) });

export const pageTitle = (p: PublicPage) =>
  p.home ? text(p.locale, p.title) : `${text(p.locale, p.title)} | ${text(p.locale, "app.name")}`;

/** Safe inside an HTML attribute or text. */
export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** JSON for a <script> tag: no "</script>" or "<!--" can end it early. */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/** "https://example.in/" → "https://example.in". Empty when no address is set. */
export const siteOrigin = (siteUrl: string | undefined) => (siteUrl ?? "").trim().replace(/\/+$/, "");

/** Structured data for the home page: the product, its prices, who runs it, and its questions. */
export function structuredData(locale: Locale, origin: string) {
  const url = origin ? `${origin}${HOME_ALTERNATES[locale]}` : undefined;
  const name = text(locale, "app.name");
  const faq = ([1, 2, 3, 4, 5, 6] as const).map((n) => ({
    "@type": "Question",
    name: text(locale, `home.q${n}` as MessageKey),
    acceptedAnswer: { "@type": "Answer", text: text(locale, `home.a${n}` as MessageKey) },
  }));
  const app = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    ...(url && { url }),
    description: text(locale, "home.metaDescription"),
    inLanguage: ["mr", "en"],
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    ...(LEGAL.operator && { publisher: { "@type": "Organization", name: LEGAL.operator } }),
    offers: PAID_PLANS.map((id) => ({
      "@type": "Offer",
      name: id,
      // Prices are kept in paise.
      price: (PLANS[id].price!.MONTHLY / 100).toFixed(2),
      priceCurrency: "INR",
      // Prices are final while we are not registered for GST; after that they exclude it.
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: (PLANS[id].price!.MONTHLY / 100).toFixed(2),
        priceCurrency: "INR",
        unitCode: "MON",
        valueAddedTaxIncluded: !GST_REGISTERED,
      },
    })),
  };
  return [app, { "@context": "https://schema.org", "@type": "FAQPage", inLanguage: locale, mainEntity: faq }];
}

/**
 * The <head> tags for a page. Tags that need a full address (canonical, language alternates,
 * share card URL and image) are left out when the site's address is not known at build time.
 */
export function headTags(p: PublicPage, siteUrl: string | undefined): string {
  const origin = siteOrigin(siteUrl);
  const title = escapeHtml(pageTitle(p));
  const description = escapeHtml(text(p.locale, p.description));
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escapeHtml(text(p.locale, "app.name"))}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[p.locale]}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
  if (p.alternates) {
    for (const l of Object.keys(p.alternates) as Locale[])
      if (l !== p.locale) tags.push(`<meta property="og:locale:alternate" content="${OG_LOCALE[l]}" />`);
  }
  if (origin) {
    tags.push(
      `<link rel="canonical" href="${origin}${p.path}" />`,
      `<meta property="og:url" content="${origin}${p.path}" />`,
      `<meta property="og:image" content="${origin}${OG_IMAGE.path}" />`,
      `<meta property="og:image:width" content="${OG_IMAGE.width}" />`,
      `<meta property="og:image:height" content="${OG_IMAGE.height}" />`,
      `<meta property="og:image:alt" content="${escapeHtml(text(p.locale, "home.metaTitle"))}" />`,
    );
    if (p.alternates) {
      for (const [l, path] of Object.entries(p.alternates)) tags.push(`<link rel="alternate" hreflang="${l}" href="${origin}${path}" />`);
      tags.push(`<link rel="alternate" hreflang="x-default" href="${origin}${p.alternates.mr}" />`);
    }
  }
  if (p.home) for (const d of structuredData(p.locale, origin)) tags.push(`<script type="application/ld+json">${scriptJson(d)}</script>`);
  return tags.join("\n    ");
}

/** robots.txt: the public pages are open; the API and signed-in screens have nothing to index. */
export function robotsTxt(siteUrl: string | undefined): string {
  const origin = siteOrigin(siteUrl);
  return ["User-agent: *", "Disallow: /api/", "Allow: /", ...(origin ? ["", `Sitemap: ${origin}/sitemap.xml`] : []), ""].join("\n");
}

/** sitemap.xml with each page and its language alternates. Needs the site's address. */
export function sitemapXml(siteUrl: string): string {
  const origin = siteOrigin(siteUrl);
  const urls = PUBLIC_PAGES.map((p) => {
    const alts = p.alternates
      ? Object.entries(p.alternates).map(([l, path]) => `\n    <xhtml:link rel="alternate" hreflang="${l}" href="${origin}${path}"/>`)
      : [];
    return `  <url>\n    <loc>${origin}${p.path}</loc>${alts.join("")}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join("\n")}
</urlset>
`;
}
