import { PAID_PLANS, PLANS } from "@vakilmitra/shared";
import { type MessageKey, translate } from "@vakilmitra/shared/i18n";
import { describe, expect, it } from "vitest";
import { escapeHtml, fileFor, headTags, PUBLIC_PAGES, robotsTxt, sitemapXml, siteOrigin, structuredData } from "../src/seo";

const SITE = "https://vakilmitra.example/";
const page = (path: string) => PUBLIC_PAGES.find((p) => p.path === path)!;
const count = (s: string, sub: string) => s.split(sub).length - 1;
/** The JSON inside each structured-data tag. */
const ldJson = (head: string) => [...head.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => m[1]);

describe("public pages", () => {
  it("are each built once, the home page in both languages", () => {
    const paths = PUBLIC_PAGES.map((p) => p.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(page("/").locale).toBe("mr");
    expect(page("/en").locale).toBe("en");
    expect(page("/").alternates).toEqual({ mr: "/", en: "/en" });
  });

  it("map to the files Caddy tries ({path}.html)", () => {
    expect(fileFor("/")).toBe("index.html");
    expect(fileFor("/en")).toBe("en.html");
    expect(fileFor("/pricing")).toBe("pricing.html");
    expect(new Set(PUBLIC_PAGES.map((p) => fileFor(p.path))).has("app.html")).toBe(false);
  });
});

describe("head tags", () => {
  it("give the Marathi home page its title, description, address and language alternates", () => {
    const head = headTags(page("/"), SITE);
    expect(count(head, "<title>")).toBe(1);
    expect(head).toContain(`<title>${escapeHtml(translate("mr", "home.metaTitle"))}</title>`);
    expect(head).toContain(`<meta name="description" content="${escapeHtml(translate("mr", "home.metaDescription"))}" />`);
    expect(head).toContain('<link rel="canonical" href="https://vakilmitra.example/" />');
    expect(head).toContain('<link rel="alternate" hreflang="mr" href="https://vakilmitra.example/" />');
    expect(head).toContain('<link rel="alternate" hreflang="en" href="https://vakilmitra.example/en" />');
    expect(head).toContain('<link rel="alternate" hreflang="x-default" href="https://vakilmitra.example/" />');
    expect(head).toContain('<meta property="og:locale" content="mr_IN" />');
    expect(head).toContain('<meta property="og:locale:alternate" content="en_IN" />');
  });

  it("give the English home page English text and its own canonical address", () => {
    const head = headTags(page("/en"), SITE);
    expect(head).toContain(`<title>${escapeHtml(translate("en", "home.metaTitle"))}</title>`);
    expect(head).toContain('<link rel="canonical" href="https://vakilmitra.example/en" />');
    expect(head).toContain('<meta property="og:locale" content="en_IN" />');
  });

  it("give link previews a full-size share image", () => {
    const head = headTags(page("/"), SITE);
    expect(head).toContain('<meta property="og:image" content="https://vakilmitra.example/og-image.png" />');
    expect(head).toContain('<meta property="og:image:width" content="1200" />');
    expect(head).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });

  it("name the product on the other pages, without language alternates", () => {
    const head = headTags(page("/pricing"), SITE);
    expect(head).toContain(`<title>${translate("mr", "legal.pricing")} | ${translate("mr", "app.name")}</title>`);
    expect(head).toContain('<link rel="canonical" href="https://vakilmitra.example/pricing" />');
    expect(head).not.toContain("hreflang");
    expect(head).not.toContain("ld+json");
    // The trial length is filled in, in the page's own digits.
    expect(head).not.toContain("{days}");
    expect(head).toMatch(/[०-९]+ दिवसांची/);
  });

  it("leave out every full address when the site's address is not known", () => {
    for (const p of PUBLIC_PAGES) {
      const head = headTags(p, undefined);
      expect(head).toContain("<title>");
      expect(head).not.toMatch(/canonical|hreflang|og:url|og:image"|https?:\/\/(?!schema\.org)/);
    }
  });

  it("escape text placed in attributes", () => {
    expect(escapeHtml(`A "B" & <C> 'D'`)).toBe("A &quot;B&quot; &amp; &lt;C&gt; &#39;D&#39;");
  });

  it("accept the site's address with or without a trailing slash", () => {
    expect(siteOrigin(" https://a.in/ ")).toBe("https://a.in");
    expect(siteOrigin("https://a.in")).toBe("https://a.in");
    expect(siteOrigin(undefined)).toBe("");
    expect(headTags(page("/en"), "https://a.in")).toContain('href="https://a.in/en"');
  });
});

describe("structured data", () => {
  for (const locale of ["mr", "en"] as const) {
    it(`carries the home page's questions word for word (${locale})`, () => {
      const faq = structuredData(locale, "https://a.in")[1] as { mainEntity: { name: string; acceptedAnswer: { text: string } }[] };
      expect(faq.mainEntity).toHaveLength(6);
      faq.mainEntity.forEach((q, i) => {
        expect(q.name).toBe(translate(locale, `home.q${i + 1}` as MessageKey));
        expect(q.acceptedAnswer.text).toBe(translate(locale, `home.a${i + 1}` as MessageKey));
      });
    });
  }

  it("lists each paid plan at its monthly price in rupees", () => {
    const app = structuredData("en", "https://a.in")[0] as { offers: { price: string; priceCurrency: string }[]; url: string };
    expect(app.url).toBe("https://a.in/en");
    expect(app.offers.map((o) => o.price)).toEqual(PAID_PLANS.map((id) => (PLANS[id].price!.MONTHLY / 100).toFixed(2)));
    expect(app.offers.every((o) => o.priceCurrency === "INR")).toBe(true);
  });

  it("is valid JSON that cannot close its script tag early", () => {
    const head = headTags(page("/"), SITE);
    const blocks = ldJson(head);
    expect(blocks).toHaveLength(2);
    for (const b of blocks) {
      expect(b).not.toContain("<");
      expect(() => JSON.parse(b)).not.toThrow();
    }
    expect(JSON.parse(blocks[0])["@type"]).toBe("SoftwareApplication");
    expect(JSON.parse(blocks[1])["@type"]).toBe("FAQPage");
  });
});

describe("robots.txt and sitemap", () => {
  it("keeps crawlers off the API and points them to the sitemap", () => {
    const robots = robotsTxt(SITE);
    expect(robots).toContain("User-agent: *\nDisallow: /api/\nAllow: /");
    expect(robots).toContain("Sitemap: https://vakilmitra.example/sitemap.xml");
    expect(robotsTxt(undefined)).not.toContain("Sitemap");
  });

  it("lists every public page once, with full addresses and the home page's languages", () => {
    const xml = sitemapXml(SITE);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(count(xml, "<url>")).toBe(PUBLIC_PAGES.length);
    expect(count(xml, "<url>")).toBe(count(xml, "</url>"));
    for (const p of PUBLIC_PAGES) expect(xml).toContain(`<loc>https://vakilmitra.example${p.path}</loc>`);
    expect(count(xml, 'hreflang="en" href="https://vakilmitra.example/en"')).toBe(2);
    expect(xml).not.toContain("//vakilmitra.example//");
  });
});
