# VakilMitra (वकीलमित्र)

A Marathi-first, mobile-first practice platform for Maharashtra advocates. The core idea: read messy Marathi land and court records and turn them into verified facts and drafts.

Built to the **Tech Stack Standard**. Hosting tier: **Prototype / MVP** (pilot, under 1k users). Project type: **web SPA**, mobile-first. The web app comes first; an Expo app (`apps/mobile`) follows only after the web app is done.

## Layout

```
apps/web          Vite + React SPA: TanStack Router/Query, Tailwind + shadcn/ui, React Hook Form + Zod, Zustand, lucide
apps/api          Fastify API: Zod type provider + OpenAPI docs, Better Auth, pino logging
apps/worker       BullMQ worker: OCR of uploaded pages
packages/db       Drizzle schema + migrations (PostgreSQL, pg_trgm)
packages/shared   Zod schemas, enums, response types, IST date helpers, Marathi/English strings
packages/storage  Encrypted file storage (envelope AES-256-GCM) over local disk or any S3-compatible bucket
packages/ocr      OCR adapter: Tesseract Marathi + English, on our own servers
packages/jobs     Queue definitions shared by API and worker (BullMQ on Valkey)
scripts/          license gate
```

Tooling: pnpm workspaces + Turborepo, Biome (lint + format), Vitest, GitHub Actions (license check, lint, build, typecheck, test on every PR).

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env        # DATABASE_URL, BETTER_AUTH_SECRET, storage, Valkey
cp apps/worker/.env.example apps/worker/.env  # same DATABASE_URL, storage dir and master keys as the API
cp packages/db/.env.example packages/db/.env
pnpm db:migrate                               # apply Drizzle migrations
pnpm build                                    # build shared packages
pnpm db:seed                                  # demo: demo@vakilmitra.in / demo1234
pnpm dev                                      # API :4000, worker, web :5173 (proxies /api)
```

You also need Valkey running locally (`valkey-server`, or any Redis-protocol server before 7.4 for development).
Generate a storage master key with `node -e "console.log('k1:'+require('crypto').randomBytes(32).toString('base64'))"` and use the same value in the API and worker `.env`.

- API docs (development only): http://localhost:4000/api/docs
- Tests: `pnpm test`. This needs a Postgres test database at `TEST_DATABASE_URL`, by default `postgresql://vakilmitra:vakilmitra@localhost:5432/vakilmitra_test`. Migrations are applied to it automatically.
- Schema change: edit `packages/db/src/schema.ts`, then run `pnpm db:generate` and `pnpm db:migrate`.
- Before a release: `pnpm check:licenses` (CI runs it too).

## What's built (milestone 1)

| Spec feature                           | Status                                                                                                                                                                                                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2. Case files and clients              | ✅ Clients, case files, parties, search, status filters. Per-advocate access; a senior can share one case with a junior as viewer or editor.                                                                                                                                                           |
| 3. Land-file analyzer: **rule checks** | ✅ Deterministic red-flag engine (`apps/api/src/land/rules.ts`). Ownership timeline per property. Each flag links to its source records. Resolved flags stay resolved when the check is run again.                                                                                                     |
| 6. Case diary                          | ✅ Daily board grouped by court. Today/tomorrow. 14-day diary. Record what happened and set the next date in one step. A "next date not recorded" list.                                                                                                                                                |
| 7. Fees and invoices                   | ✅ Fee agreements, installments, payments. Outstanding and overdue per client on one screen. Printable invoice.                                                                                                                                                                                        |
| Security / DPDP                        | ✅ Better Auth sessions in our own Postgres, with rate limiting. Access log on case views, shares and deletes. One-tap delete of a case, or of the whole account (always needs the password; anonymised audit entry).                                                                                  |
| 1. Scanner + OCR                       | ✅ In-app camera (nothing saved to the gallery), automatic page-edge detection with adjustable corners, perspective flattening, background upload with retries, PDF/image import. Encrypted at rest. Marathi + English OCR in a worker; text is searchable; unclear words can be outlined on the scan. |
| 3. Classify / extract / link           | ⏳ Next milestone (AI SDK + eval set). Records are entered by hand for now.                                                                                                                                                                                                                            |
| 4. Drafting, 5. Translation            | ⏳ The `draft` table exists; the feature does not yet                                                                                                                                                                                                                                                  |
| 8. WhatsApp                            | ⏳ MSG91 adapter. The client opt-in flag exists; sending does not yet.                                                                                                                                                                                                                                 |

### Red-flag rules

Every rule is a pure function over structured events: no LLM, no clock, no I/O. Each flag carries the event and fact ids that triggered it.

- `DEED_WITHOUT_MUTATION` / `MUTATION_WITHOUT_DEED`: matched by cited deed number, or by type, time window and transferee name. Heirship mutations are exempt.
- `AREA_CHANGE`: area differs between 7/12 extracts. Lowered to LOW only when a partition or acquisition lies in between and no correction does.
- `LAND_CLASS_CHANGE`, `SECTION_155_CORRECTION`.
- `OTHER_RIGHTS_ENTRY`: इतर हक्क entries, sorted into bank charge, heir or encumbrance.
- `CHAIN_START_GAP` / `CHAIN_BREAK`: the chain doesn't reach back 30 years, or a transferor isn't the recorded owner.

### Scanner and OCR

- **Capture:** the scanner screen uses the camera inside the page (`getUserMedia`), so no photo lands in the phone's gallery. OpenCV.js finds the page edges, the advocate can drag the corners, and the page is flattened before upload. OpenCV (~3.5 MB gzipped) loads only on the scanner screen, as a static script.
- **Upload:** one page per request, idempotent per page number, retried with backoff on poor connections. The API re-encodes every image, which strips EXIF (including GPS), then encrypts it before storing.
- **Encryption:** every file gets its own random key (AES-256-GCM, bound to its storage path). Those keys are wrapped with a master key from `STORAGE_MASTER_KEYS`, which never goes in the bucket. List several keys to rotate: the first encrypts, all decrypt.
- **OCR:** Tesseract (Marathi + English) always reads first in `apps/worker`, on our servers. Two cloud engines can take over hard pages: **Sarvam Vision** (built for Indian languages, called over its REST API) and **Gemini** (Vercel AI SDK; Vertex AI in Mumbai by default). The worker stores text, confidence, word or line boxes, and which engine and route read each page.
- **Cloud OCR needs consent:** a page goes to a cloud engine only if the case's advocate turned on "Read hard pages with cloud OCR" in Settings (off by default; the change is logged). Then `OCR_CLOUD_MODE=fallback` sends only pages Tesseract reads below `OCR_CLOUD_BELOW` (default 0.85), and `always` sends every page. Every page sent is recorded in the access log. If the cloud call fails, the local reading is kept.
- **Choosing the engine:** decided by the eval harness on real labelled pages, scored against the spec's field targets. See [`packages/ocr/eval/README.md`](packages/ocr/eval/README.md).
- **Search:** trigram (`pg_trgm`) substring search over OCR text, which works for Devanagari where word tokenisers struggle.
- **Deletes:** deleting a page, document, case or account removes its encrypted files as well as its rows.

## Deployment notes

- The web app calls the API at `VITE_API_URL`. Put both on the same site, e.g. `app.` and `api.` subdomains of one domain, so the session cookie works. Add the web origin to `WEB_ORIGIN` on the API.
- Prototype tier: Neon/Supabase Postgres, API + worker on Railway/Render/Coolify, Valkey container, SPA on Cloudflare Pages.
- Files must stay in India: set `STORAGE_DRIVER=s3` with an India-region S3-compatible bucket (for example AWS S3 `ap-south-1`). Keep `STORAGE_MASTER_KEYS` in the host's secret store, never in the bucket's account.
- The worker is CPU-bound (about 1 s per page per core); set `OCR_CONCURRENCY` to the number of cores.
- Cloud reads run on their own queue (`ocr-cloud`, limit `OCR_CLOUD_CONCURRENCY`, default 4), so a slow cloud call (Sarvam polls for up to 2 minutes) never holds a Tesseract slot. The local job saves Tesseract's reading first (route `local:cloud-queued`), so the advocate sees text at once; the cloud job then replaces it. Just before sending, the cloud job re-checks that the page is still the version it was queued for (version and image size, read again after fetching the image) and that the owner still consents, and it writes the audit row before sending. After its last retry, the local reading stays (route `local:cloud-failed`).

## Kickoff checklist

- [x] Hosting tier and project type picked (Prototype, web SPA; mobile app after the web app)
- [x] Monorepo: pnpm, Turborepo, Biome, Vitest, GitHub Actions
- [ ] Cloud, domain, app store and API accounts in the client's name
- [ ] Staging and production with separate databases and keys
- [x] Env vars validated with Zod at boot; no secrets in git
- [ ] Sentry, PostHog; Langfuse when AI work starts
- [x] CI license check passes (no banned licenses)
- [ ] AI eval set (at least 20 real cases) before the extraction feature launches. The harness is ready (`packages/ocr/eval`); it needs real labelled pages.
- [ ] Daily backups running and a restore tested

## Exceptions to the standard

### sharp / libvips (LGPL-3.0), Review tier

1. **What and why:** `sharp` (Apache-2.0) is the image library that re-encodes uploads (stripping EXIF/GPS) and prepares pages for OCR. It ships prebuilt **libvips** binaries (`@img/sharp-libvips-*`), which are LGPL-3.0. The permissive alternatives are slower or less proven for this job.
2. **License, pricing, exit path:** free. Used unmodified, dynamically linked, only on our servers; nothing is distributed to browsers or phones, and LGPL has no network clause. If this changes, image handling sits in two places (`apps/api/src/routes/documents.ts`, `packages/ocr`) and can move to an MIT/Apache library such as `@napi-rs/image`.
3. **Approved by:** Prasanna Wagh, 2026-11-16. The license gate (`scripts/check-licenses.mjs`) allowlists only `@img/sharp-libvips-*`.
4. **New default for future projects?** No: decide per project.

### Dev-only note

`@fastify/swagger-ui` pulls in BlueOak-1.0.0 packages, so it is a dev-only dependency. It is not loaded in production and is not part of the shipped dependency tree, so no exception is needed.
