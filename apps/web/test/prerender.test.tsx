import { type MessageKey, translate } from "@vakilmitra/shared/i18n";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { useLocaleStore } from "../src/lib/i18n";
import { prerenderSite, renderPage } from "../src/prerender";
import { fileFor, PUBLIC_PAGES } from "../src/seo";

// The language store remembers the choice in localStorage, which Node lacks (as at build time).
vi.hoisted(() => {
  const mem = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => mem.set(k, v),
    removeItem: (k: string) => mem.delete(k),
  } as unknown as Storage;
});

// The built index.html, reduced to what the prerender step relies on.
const TEMPLATE = `<!doctype html>
<html lang="mr">
  <head>
    <meta charset="UTF-8" />
    <meta name="description" content="template description" />
    <title>template title</title>
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

/** React escapes text; the page's words are compared as React writes them. */
const html = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#x27;").replace(/"/g, "&quot;");
const t = (locale: "mr" | "en", key: MessageKey) => html(translate(locale, key));
const FAQ = [1, 2, 3, 4, 5, 6] as const;

describe("rendering a public page ahead of time", () => {
  let mr: string;
  let en: string;
  beforeAll(async () => {
    mr = await renderPage("/", "mr");
    en = await renderPage("/en", "en");
  }, 30_000);

  it("writes the whole Marathi home page: heading, questions and calls to action", () => {
    expect(mr).toContain("<h1");
    expect(mr).toContain(t("mr", "home.hero1"));
    for (const n of FAQ) {
      expect(mr).toContain(t("mr", `home.q${n}` as MessageKey));
      expect(mr).toContain(t("mr", `home.a${n}` as MessageKey));
    }
    expect(mr).toContain('href="/register"');
    expect(mr).toContain('href="/login"');
    expect(mr).not.toContain(t("en", "home.hero1"));
  });

  it("writes the English home page in English, with a link to the Marathi one", () => {
    expect(en).toContain(t("en", "home.hero1"));
    for (const n of FAQ) expect(en).toContain(t("en", `home.q${n}` as MessageKey));
    expect(en).not.toContain(t("mr", "home.hero1"));
    const enLink = en.match(/<a ([^>]*)>मराठीत वाचा<\/a>/)?.[1];
    expect(enLink).toContain('href="/"');
    expect(enLink).toContain('lang="mr"');
    const mrLink = mr.match(/<a ([^>]*)>Read in English<\/a>/)?.[1];
    expect(mrLink).toContain('href="/en"');
    expect(mrLink).toContain('lang="en"');
  });

  it("links to every policy page from the home page", () => {
    for (const p of PUBLIC_PAGES.filter((x) => !x.home)) expect(mr).toContain(`href="${p.path}"`);
  });

  it("writes each policy page with its heading", async () => {
    for (const p of PUBLIC_PAGES.filter((x) => !x.home)) {
      const body = await renderPage(p.path, p.locale);
      expect(body).toMatch(new RegExp(`<h1[^>]*>${t(p.locale, p.title)}</h1>`));
    }
  }, 30_000);

  it("never calls the API, and puts fetch back afterwards", async () => {
    const before = globalThis.fetch;
    await renderPage("/", "mr");
    expect(globalThis.fetch).toBe(before);
  });

  it("refuses a page that needs sign-in instead of writing the wrong page", async () => {
    await expect(renderPage("/today", "mr")).rejects.toThrow(/prerender: \/today/);
  });

  it("refuses an address with no page", async () => {
    await expect(renderPage("/no-such-page", "mr")).rejects.toThrow(/did not load/);
  });

  it("sets the language for each page, whatever was chosen before", async () => {
    useLocaleStore.setState({ locale: "en" });
    expect(await renderPage("/pricing", "mr")).toContain(t("mr", "legal.pricing"));
  });
});

describe("the built site", () => {
  let files: Record<string, string>;
  beforeAll(async () => {
    files = await prerenderSite(TEMPLATE, "https://vakilmitra.example");
  }, 30_000);

  it("has a file for every public page, the app shell, robots.txt and the sitemap", () => {
    const expected = [...PUBLIC_PAGES.map((p) => fileFor(p.path)), "app.html", "robots.txt", "sitemap.xml"];
    expect(Object.keys(files).sort()).toEqual(expected.sort());
  });

  it("keeps the app shell empty, for every address that is not built ahead", () => {
    expect(files["app.html"]).toBe(TEMPLATE);
  });

  it("gives each page its language, one title, one description and its content", () => {
    for (const p of PUBLIC_PAGES) {
      const f = files[fileFor(p.path)];
      expect(f).toContain(`<html lang="${p.locale}"`);
      expect(f.match(/<title>/g)).toHaveLength(1);
      expect(f.match(/<meta name="description"/g)).toHaveLength(1);
      expect(f).not.toContain("template title");
      expect(f).not.toContain("template description");
      expect(f).toContain(`<div id="root" data-prerendered="${p.path}"><`);
      expect(f).toContain(`<link rel="canonical" href="https://vakilmitra.example${p.path}" />`);
      // The app's script is still there to take over.
      expect(f).toContain('<script type="module" crossorigin src="/assets/index-abc.js"></script>');
    }
  });

  it("leaves out the sitemap when the site's address is not known", async () => {
    const bare = await prerenderSite(TEMPLATE, undefined);
    expect(bare["sitemap.xml"]).toBeUndefined();
    expect(bare["robots.txt"]).not.toContain("Sitemap");
    expect(bare["index.html"]).not.toContain("canonical");
  }, 30_000);

  it("refuses a template it cannot fill", async () => {
    await expect(prerenderSite(TEMPLATE.replace('<div id="root"></div>', "<main></main>"), undefined)).rejects.toThrow(/#root/);
    await expect(prerenderSite(TEMPLATE.replace("<title>template title</title>", ""), undefined)).rejects.toThrow(/title/);
  });
});
