/**
 * Build-time rendering of the public pages to plain HTML, so search engines and link previews
 * (WhatsApp and others, which never run JavaScript) see the whole page. Built by
 * `vite build --ssr src/prerender.tsx` and run by scripts/prerender.mjs after the client build.
 * In the browser, main.tsx waits for the app to be ready, then replaces this HTML with the app.
 */
import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import type { Locale } from "@vakilmitra/shared";
import { renderToString } from "react-dom/server";
import { PrerenderLocale, useLocaleStore } from "./lib/i18n";
import { routeTree } from "./routeTree.gen";
import { fileFor, headTags, PUBLIC_PAGES, robotsTxt, sitemapXml } from "./seo";

/** The markup of one page, as it first appears to a visitor who is not signed in. */
export async function renderPage(path: string, locale: Locale): Promise<string> {
  useLocaleStore.setState({ locale, chosen: false });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createRouter({ routeTree, context: { queryClient }, history: createMemoryHistory({ initialEntries: [path] }) });
  // Nobody is signed in while the site is built, and no page may depend on the API.
  const realFetch = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error("prerender: no API at build time"));
  try {
    await router.load();
  } finally {
    globalThis.fetch = realFetch;
  }
  if (router.state.location.pathname !== path) throw new Error(`prerender: ${path} redirected to ${router.state.location.pathname}`);
  const leaf = router.state.matches.at(-1);
  if (leaf?.routeId !== path || leaf.status !== "success")
    throw new Error(`prerender: ${path} did not load (${leaf?.routeId}: ${leaf?.status})`);
  return renderToString(
    <PrerenderLocale value={locale}>
      <RouterProvider router={router} />
    </PrerenderLocale>,
  );
}

/**
 * Every file to write next to the client build. `template` is the built index.html. The empty
 * app shell is kept as app.html for every other address (see deploy/Caddyfile).
 */
export async function prerenderSite(template: string, siteUrl: string | undefined): Promise<Record<string, string>> {
  if (!template.includes('<div id="root"></div>')) throw new Error("prerender: index.html has no empty #root");
  if (!/<title>[^<]*<\/title>/.test(template)) throw new Error("prerender: index.html has no <title>");
  const files: Record<string, string> = { "app.html": template, "robots.txt": robotsTxt(siteUrl) };
  if (siteUrl) files["sitemap.xml"] = sitemapXml(siteUrl);
  for (const page of PUBLIC_PAGES) {
    const body = await renderPage(page.path, page.locale);
    files[fileFor(page.path)] = template
      .replace(/<html lang="[^"]*"/, `<html lang="${page.locale}"`)
      // The template's own title and description are replaced by the page's.
      .replace(/\s*<meta name="description"[^>]*>/, "")
      .replace(/<title>[^<]*<\/title>/, headTags(page, siteUrl))
      .replace('<div id="root"></div>', `<div id="root" data-prerendered="${page.path}">${body}</div>`);
  }
  return files;
}
