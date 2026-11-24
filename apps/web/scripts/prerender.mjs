// After `vite build`: write the public pages as ready-made HTML, plus robots.txt and the sitemap.
// SITE_URL (e.g. https://vakilmitra.in) gives the full addresses search engines and link previews
// need; without it those tags and the sitemap are left out.
import { readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url));
const ssr = fileURLToPath(new URL("../dist-ssr/", import.meta.url));
// The language store remembers the choice in localStorage; at build time a throwaway one will do.
const mem = new Map();
globalThis.localStorage = {
  getItem: (k) => mem.get(k) ?? null,
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
};
const { prerenderSite } = await import(new URL("prerender.js", `file://${ssr}`).href);

const siteUrl = process.env.SITE_URL?.trim() || undefined;
const template = await readFile(`${dist}index.html`, "utf8");
const files = await prerenderSite(template, siteUrl);
for (const [name, content] of Object.entries(files)) await writeFile(`${dist}${name}`, content);
await rm(ssr, { recursive: true, force: true });
console.log(`prerendered ${Object.keys(files).join(", ")}${siteUrl ? ` for ${siteUrl}` : " (no SITE_URL: no full addresses or sitemap)"}`);
