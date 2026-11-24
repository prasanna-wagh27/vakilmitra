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
packages/ai       AI models per task (drafting, translation) behind one interface; the provider is a setting
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

| Spec feature                           | Status                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2. Case files and clients              | ✅ Clients, case files, parties, search, status filters. Per-advocate access; a senior can share one case with a junior as viewer or editor.                                                                                                                                                                                                                                              |
| 3. Land-file analyzer: **rule checks** | ✅ Deterministic red-flag engine (`apps/api/src/land/rules.ts`). Ownership timeline per property. Each flag links to its source records. Resolved flags stay resolved when the check is run again.                                                                                                                                                                                        |
| 6. Case diary                          | ✅ Daily board grouped by court. Today/tomorrow. 14-day diary. Record what happened and set the next date in one step. A "next date not recorded" list.                                                                                                                                                                                                                                   |
| 7. Fees and invoices                   | ✅ Fee agreements, installments, payments. Outstanding and overdue per client on one screen. Printable invoice.                                                                                                                                                                                                                                                                           |
| Security / DPDP                        | ✅ Better Auth sessions in our own Postgres, with rate limiting. Access log on case views, shares and deletes. One-tap delete of a case, or of the whole account (always needs the password; anonymised audit entry).                                                                                                                                                                     |
| 1. Scanner + OCR                       | ✅ In-app camera (nothing saved to the gallery), automatic page-edge detection with adjustable corners, perspective flattening, background upload with retries, PDF/image import. Encrypted at rest. Marathi + English OCR in a worker; text is searchable; unclear words can be outlined on the scan.                                                                                    |
| 3. Classify / extract / link           | ✅ Rule-based, no LLM (`apps/api/src/land/extract.ts`). It identifies a 7/12, Ferfar or Index-II from its text and reads labelled fields from the OCR word boxes. Each fact keeps its page, its source crop and its OCR confidence. The advocate checks or corrects every fact before it becomes an ownership event; red flags then run on the chain. See "Land-record extraction" below. |
| 4. Drafting, 5. Translation            | ⏳ The `draft` table exists; the feature does not yet                                                                                                                                                                                                                                                                                                                                     |
| 8. WhatsApp                            | ⏳ MSG91 adapter. The client opt-in flag exists; sending does not yet.                                                                                                                                                                                                                                                                                                                    |

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

## Deployment

Everything runs on one server in Mumbai with Docker Compose (`deploy/compose.yml`): Postgres 16, Valkey, a one-off `migrate` step, the API, the worker, and Caddy, which serves the web app and admin panel over HTTPS and passes `/api` to the API. Client files and backups go to S3 buckets in Mumbai.

- **Addresses:** `https://DOMAIN` is the site and web app, with the API at `/api` on the same origin, so the sign-in cookie needs no cross-site settings. `https://admin.DOMAIN` is the admin panel, and `www.DOMAIN` redirects. Caddy gets and renews the HTTPS certificates itself.
- **Images:** the `Dockerfile` builds two images from one build:
  - `server`: the API, the worker and the migrations. It is built on the official Postgres 16 image, so the backups' `pg_dump` always matches the database.
  - `web`: Caddy, with both static sites built in.
- **Pipeline** (`.github/workflows/deploy.yml`): after CI passes on `main`, it builds both images and pushes them to GitHub Container Registry, tagged with the commit. When the server settings are present, it then runs these steps on the server over SSH:
  1. copies the compose file
  2. pulls the new images
  3. runs migrations
  4. restarts the services and waits until they are healthy
  5. checks `https://DOMAIN/api/health`

  Without the server settings it only builds and pushes. It can also be started by hand from the Actions tab. CI builds both images on every pull request too, without pushing them.
- **Rolling back:** on the server, run `IMAGE_TAG=<older commit> docker compose up -d`. Migrations only ever add, so an older image runs against a newer database.
- **One-time server setup** (Ubuntu 24.04 with 2 vCPU and 8 GB RAM is enough to start):
  1. Install Docker and add a deploy user to the `docker` group.
  2. Create `/opt/vakilmitra`, copy `deploy/.env.example` there as `.env` with `chmod 600`, and fill it in.
  3. Point `DOMAIN`, `www.DOMAIN` and `admin.DOMAIN` at the server, and open ports 80 and 443.
  4. In the repository's Actions settings, add the variables `DEPLOY_HOST`, `DEPLOY_USER` and `DEPLOY_DOMAIN`, the secrets `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS`, and optionally the variable `VITE_SENTRY_DSN`.
  5. Run the Deploy workflow.
- **Keys:** keep an offline copy of `STORAGE_MASTER_KEYS`. Without it, client files and backups cannot be read. The keys live only in the server's `.env`, never in a bucket's account.
- **Files must stay in India:** use `STORAGE_DRIVER=s3` with a bucket in `ap-south-1` (or another India-region, S3-compatible store), and a second bucket in another account for backups. `STORAGE_DRIVER=fs` keeps files in a Docker volume on the server, which is fine for a trial but is not backed up off the machine beyond the nightly backup.
- **Error reports (Sentry):**
  - They are off until `SENTRY_DSN` is set on the server and the `VITE_SENTRY_DSN` variable is set in the pipeline.
  - They contain only what is needed to find a bug: the API and worker report unexpected failures (5xx, and jobs that fail after their last retry), and the browsers report crashes.
  - Before sending, `scrubEvent` in `packages/shared/src/sentry.ts` removes request bodies, cookies, query strings, names, emails, IP addresses and console output; only the account id stays.
  - Use Sentry's EU region (`de.sentry.io`), and keep `SENTRY_TRACES_SAMPLE_RATE=0` (errors only) unless performance traces are needed.
- The worker is CPU-bound (about 1 s per page per core); set `OCR_CONCURRENCY` to the number of cores.
- Cloud reads run on their own queue (`ocr-cloud`, limit `OCR_CLOUD_CONCURRENCY`, default 4), so a slow cloud call (Sarvam polls for up to 2 minutes) never holds a Tesseract slot. The local job saves Tesseract's reading first (route `local:cloud-queued`), so the advocate sees text at once; the cloud job then replaces it. Just before sending, the cloud job re-checks that the page is still the version it was queued for (version and image size, read again after fetching the image) and that the owner still consents, and it writes the audit row before sending. After its last retry, the local reading stays (route `local:cloud-failed`).

## AI models

AI features never import a provider's SDK. They ask `packages/ai` for their task's model and use the Vercel AI SDK (`generateText`, `streamText`, structured output) with it, so which company's model does which job is a setting, changed without touching code.

- **One setting per task:** `AI_MODEL_DRAFTING`, `AI_MODEL_TRANSLATION`, and `AI_MODEL_DEFAULT` for any task not set. A model is written `<provider>:<model id>`, e.g. `anthropic:claude-sonnet-5-5`, `vertex:gemini-3.5-flash` or `sarvam:<model id>`. A task with no model is off.
- **Fallbacks:** several models, comma-separated, are tried in order. If one fails (outage, rate limit), `ai.run(task, fn)` moves to the next and reports which model answered, for the audit log. Streaming uses the first model only.
- **Providers:**
  - `anthropic` (Claude)
  - `openai` (GPT)
  - `google` (Gemini API)
  - `vertex` (Gemini on Google Cloud)
  - `vertex-anthropic` (Claude on Google Cloud)
  - `sarvam` (Sarvam's OpenAI-format chat API)
  - `compatible`: any OpenAI-compatible endpoint, such as Azure OpenAI's v1 API, a self-hosted model or another Indian provider

  Another provider is one case in `packages/ai/src/providers.ts`.
- **Where data goes:** each model reports where it processes data:
  - `india`: Sarvam, and Vertex in `asia-south1`/`asia-south2`
  - `abroad`: the direct Anthropic, OpenAI and Gemini APIs
  - `unknown`: a compatible endpoint, unless `AI_COMPATIBLE_IN_INDIA=true`

  `AI_INDIA_ONLY=true` refuses any other model at start-up. Client documents are confidential, so features that send client text to a model must ask the advocate's consent and record each call in the audit log, as cloud OCR already does.
- **Checked at start-up:** an unknown provider, a malformed model or a missing key stops the API with a plain message, and the API logs which model serves each task.
- Tests use the AI SDK's mock models, so no feature test needs a key or the network.
- **Every AI feature** goes through `apps/api/src/lib/ai.ts`: the case owner must have turned on "Use AI for translation and drafting" in Settings (off by default, every change logged), the owner's plan must have AI requests left this month (`aiPerMonth`, juniors use the senior's), and each call is counted in `ai_usage` (model and tokens, never text) and named in the audit log with its model and data location.
- **Translation:** each scanned page can be translated between Marathi and English (`POST /api/documents/:id/pages/:pageId/translate`). The answer is saved per page and language and shown again for free until the page is read again; the screen marks it as a machine translation to check against the scan.
- **Drafting:** on a case, "New draft" writes a public notice, legal notice, reply to a notice, affidavit, application or anything else, in Marathi or English, from the advocate's instructions and (if ticked) the case's court, parties and properties (`POST /api/cases/:caseId/drafts/generate`). The text streams onto the screen as it is written and is saved as it goes, so a dropped connection or a model failing partway keeps what was written. A model that fails before writing anything is skipped for the next one (`ai.stream`). The advocate then edits it, copies it or downloads it as Word. The prompt forbids invented names, dates, numbers, sections and citations, and leaves `[placeholders]` for missing facts.

## Plans and billing

- Plans live in `packages/shared/src/billing.ts`: a 14-day free trial, then Solo, Pro and Chamber, monthly or yearly (yearly = 10 months' price). Every plan has every feature; plans differ in junior seats, pages scanned per month, storage and AI requests per month.
- Payments use Razorpay. Monthly plans are Razorpay Subscriptions (UPI Autopay, cards); yearly plans are one-off orders, because RBI rules need extra authentication for each auto-debit above ₹15,000.
- Setup: put the keys in `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`, run `pnpm --filter @vakilmitra/api billing:plans` once to create the monthly plans and copy the printed ids into env, and add a webhook to `<API_URL>/api/webhooks/razorpay` with secret `RAZORPAY_WEBHOOK_SECRET` (events listed in `apps/api/.env.example`). Use `rzp_test_` keys until going live.
- After a trial or paid period ends there are 7 days of grace, then the account turns read-only: everything stays readable and exportable, and nothing is ever deleted for non-payment. Juniors on a senior's paid plan are covered by it.
- GST: we are not registered, so `GST_REGISTERED` in `packages/shared/src/billing.ts` is `false`. Prices are final, nothing is added, and every payment gets a plain receipt numbered `VM/<financial year>/<serial>`. The seller name on receipts is `BILLING_SUPPLIER_NAME` (Outgrid Labs).
- After registering for GST (compulsory once a year's turnover passes ₹20 lakh): set `GST_REGISTERED = true`, set `BILLING_SUPPLIER_GSTIN`, `BILLING_SUPPLIER_ADDRESS` and `BILLING_SAC`, and run `billing:plans` again to get monthly plans that include GST. From then on every payment gets a GST tax invoice (CGST + SGST inside Maharashtra, IGST outside) and customers can add their GSTIN. Each invoice stores our GSTIN as issued, so older receipts stay receipts.
- Each payment emails a receipt with a link to it, in the advocate's language.
- Not done yet: proration when switching plans mid-period (a switch starts a fresh period today).

## Policy pages

- Public pages, no sign-in: `/pricing`, `/terms`, `/privacy`, `/refunds`, `/delivery`, `/contact`. Razorpay checks for these before turning on live payments. They are linked from sign-in and sign-up, Settings and the billing page, and sign-up says that creating an account accepts the Terms and Privacy Policy.
- The home page (`/`, `apps/web/src/routes/index.tsx`) is public: what VakilMitra does, features, privacy, pricing and questions, in the reader's language. Signed-in advocates are sent to their day (`/today`). Its claims must stay true to what is built.
- Each policy is written in full in Marathi and in English, and readers see only their chosen language (if the two differ, the English text prevails). Source: `apps/web/src/components/legal/`.
- Language rule for the whole web app: no English on a Marathi screen and no Marathi on an English one (except the language switch). Server errors are translated in `apps/web/src/lib/errors.ts`; add a Marathi line there for every new API error message.
- Business details (legal name, address, support and grievance contacts, courts' city) live in `apps/web/src/lib/legal.ts`. Until every one is filled in, the pages show "to be added" and a draft notice.
- The text is a starting draft written to match how the app works today. Have a lawyer review it before launch.

## Email

- Sent over SMTP from `apps/api/src/mail.ts`: set `SMTP_URL` (e.g. Amazon SES in Mumbai, `smtps://USER:PASS@email-smtp.ap-south-1.amazonaws.com:465`) and `MAIL_FROM`. Without `SMTP_URL`, development prints each email, with its link, to the API log; production sends nothing and logs a warning.
- Forgot password: a one-hour, single-use link. Setting the new password signs out every device. The answer is the same whether or not the address has an account.
- Address check: a link is sent at sign-up; Settings shows whether it is confirmed and can send it again. Signing in does not wait for it.
- Both are limited to 3 requests per 15 minutes from one IP address, on top of the general auth rate limit.

## Audit trail

Everything is on record, without client content:

- **Every API request by a signed-in advocate** (owner or junior) writes one `access_log` row just
  before its answer is sent: views, lists, searches, adds, changes, exports, deletes, and refused
  attempts (another advocate's case, no access). Written centrally in `apps/api/src/lib/audit.ts`,
  so a new route is covered without extra code. The action is named from the route
  (`/api/cases/:id` GET → `case.view`); a route can name it more precisely with `logAccess()`.
- **Each row has** who, what, the item and its case, the HTTP status, IP address, device (user
  agent), and for changes the names of the fields sent. Never values, file content, or search
  words (only their length). Repeat views of the same thing by the same person within 10 minutes
  count once (screens refresh while pages are read).
- **Sign-in events:** sign-in, failed sign-in (against the account, or the address tried if there
  is none), sign-out, sign-up, password change, reset request and reset, email verification,
  signing out other devices.
- **System actions:** a page sent for cloud reading (written before it leaves our servers),
  account deletion, payments.
- **Staff:** every admin-panel request is in `staff_audit`, including lists and pages viewed.
- **Who sees it:** advocates under Settings, Activity log (`/activity`): their own actions
  everywhere, and everyone's actions on cases they own (juniors included), filterable by case
  and kind, downloadable as a spreadsheet in their language. A case's owner has a History link
  on the case. Staff see an account's activity on its admin page (ids only, never case names);
  opening it is itself recorded.
- **How long:** one year. The worker's daily clean-up (02:30 IST) deletes older rows, except the
  anonymous record that an account was deleted. Staff records (`staff_audit`) are not deleted.

## Backups

The worker takes a backup every night at 03:00 IST and then proves it restores. It is off until
`BACKUP_STORAGE_DRIVER` is set (see `apps/worker/.env.example`); in production the worker logs an
error at start while it is off, and the admin dashboard shows the last backup and restore check
(red when last night's backup is missing or the check failed).

- **What is saved:** the whole database (`pg_dump`, encrypted with `STORAGE_MASTER_KEYS`) and a copy
  of every client file (copied as they are: already encrypted). Only files new since the last night
  are copied.
- **Where:** a separate bucket from the live files, ideally in another cloud account, in India.
  The worker refuses to back up into the live bucket.
- **How long:** 30 days, as the privacy policy says. Each night's run lists the files it needs;
  a file is deleted once no run from the last 30 days lists it.
- **Restore check:** each night the newest backup is restored into a scratch database
  (`BACKUP_RESTORE_CHECK_URL`, name ending in `_restore_check`; it is dropped and recreated, so it
  needs CREATEDB), every table's row count is compared with the count taken at backup time, and a
  sample of files is decrypted. The scratch database is dropped afterwards.
- **The master keys are the only way to read a backup.** Keep a copy of `STORAGE_MASTER_KEYS`
  offline, away from both the servers and the backup bucket.
- The worker needs `pg_dump` and `pg_restore` of the server's major version: it uses
  `PG_BIN_DIR` if set, else `/usr/lib/postgresql/<version>/bin` when installed, else the path.

By hand (`node dist/backup-cli.js` in production, `pnpm --filter @vakilmitra/worker backup` in development):

```sh
backup list                                  # backups in the store
backup backup                                # take one now
backup check [--run <id>]                    # restore check now
backup restore --to <empty database url> [--run <id>] [--files]
```

**Disaster recovery:** create a new, empty database; run `restore --to <its url> --files` (the newest
backup by default; `--files` copies the client files back into the bucket named by `STORAGE_*`);
point `DATABASE_URL` at it; start the API, which applies any newer migrations.

## Admin panel (`apps/admin`)

- A separate site for VakilMitra staff (dev: http://localhost:5174, `pnpm --filter @vakilmitra/admin dev`), deployed apart from the advocates' app, e.g. on `admin.` next to `api.`. Set `ADMIN_ORIGIN` on the API to its address.
- Staff have their own login, separate from advocates: password plus a 6-digit authenticator code, a 12-hour session cookie (`__Host-vm_admin`, SameSite=Strict), lockout after 5 failed tries, and changes accepted only from `ADMIN_ORIGIN`.
- Staff are created only on the server: `pnpm --filter @vakilmitra/api admin:staff --email you@example.com --name "Name" --role OWNER` prints the password and authenticator key once. `--reset` reissues them; `--disable` removes access and signs out every session.
- **Dashboard:**
  - MRR, paid accounts by plan, trials, trial-to-paid conversion, money collected in the last 30 days, accounts in grace or read-only;
  - sign-ups per day, pages scanned by where they were read (cloud reads cost money), OCR failures, and system health.
- **Accounts:** search and filter; each account shows its plan, usage and counts. Support staff can extend a trial. Owners can also give a free plan and refund a payment through Razorpay.
- Every staff sign-in and change is in the audit log. Staff never see clients, cases or documents, only counts.

## Land-record extraction

- **How it reads.** Words from OCR are grouped into lines by their boxes. Known Marathi labels (गाव, गट क्रमांक, भोगवटादाराचे नाव, क्षेत्र, इतर हक्क, फेरफार नोंद क्रमांक, लिहून देणार …) are matched, and the words after each label become the value.
  - Labels that are also ordinary words need a ":" or "-" after them.
  - Owners and parties may continue on the following lines, one per line.
  - Heirship Ferfars are also read from prose ("मयत X यांचे वारस A, B").
- **Table-layout 7/12s.** Most 7/12 extracts are tables, not "label : value" forms. A row of column headings (खाते क्रमांक | भोगवटादाराचे नाव | क्षेत्र | आकार | फेरफार क्र., or भूमापन क्रमांक | भूधारणा पद्धती) starts a table, and each cell of the rows below goes to the heading it lies under.
  - Cells are split at gaps wider than a word space, or at ruled lines OCR reads as "|". Headings that wrap onto a second line ("भोगवटादाराचे" over "नाव") are allowed.
  - Each owner row gives one owner (an account number in the same cell is dropped; the "एकूण" total row is not an owner). The tenant column (कुळाचे नाव) and the इतर हक्क box become other rights.
  - The area is the total row, or the only area in the table; owners' shares alone are not taken as the land's area. The ferfar number is the highest in the column (the latest change).
  - A table ends at the next heading row, at a "label : value" line, or at a large gap.
  - An area whose digits OCR garbled ("0.3¢.00") is left blank rather than guessed.
- **Values are normalised.** Areas become square metres (hectares, H.R.Sqm triples, ares, acres, gunthas). Dates become ISO. Land class becomes Class-I/II. Devanagari digits become ASCII.
- **Nothing is final until reviewed.**
  - Each fact shows its source crop and its weakest word's OCR confidence; below 80% it is marked "unclear".
  - A corrected fact keeps what was read (`original_value`).
  - Reading a document again replaces only facts that have not been checked.
  - A document joins a property's timeline only once every fact is checked. Blank property details are filled from it; differing ones are reported, never overwritten.
- **Eval.** `apps/api/test/extract.eval.test.ts` scores 36 synthetic records (10 label-layout and 12 table-layout 7/12s, 8 Ferfars, 6 Index-IIs) read by real Tesseract, against the spec's field targets. The records vary in layout and digit script, and half are degraded like phone photos. The OCR output is stored as fixtures, so CI runs it without OCR; regenerate with `npx tsx apps/api/eval/make-extract-set.mts`.
  - A value the OCR lost entirely (not in the OCR text at all) is reported as an OCR miss and not charged to the extractor; the eval fails if more than 2% of values are lost that way. One is now: a total area whose Devanagari digits Tesseract misread.
  - Every group currently scores 100%. That shows the parser copes with OCR noise on these layouts. It is **not** a measure of accuracy on real government records, which are often handwritten or faded.
  - The real-record eval (20+ labelled real pages) is still on the checklist below.
- **Limits.** Prose Ferfars other than heirship (sale narratives, orders) yield their number, date and type, but not the parties; the advocate adds those with "Add a missing detail". Table-layout 7/12s, where values sit under column headings rather than after a label, are not read yet.

## Kickoff checklist

- [x] Hosting tier and project type picked (Prototype, web SPA; mobile app after the web app)
- [x] Monorepo: pnpm, Turborepo, Biome, Vitest, GitHub Actions
- [ ] Cloud, domain, app store and API accounts in the client's name
- [x] Production server packaged (Docker Compose) with a deploy pipeline; no staging copy for now (owner's decision)
- [x] Env vars validated with Zod at boot; no secrets in git
- [x] Sentry error reports (scrubbed; on once a DSN is set)
- [ ] PostHog usage analytics; Langfuse when AI work starts
- [x] CI license check passes (no banned licenses)
- [ ] Real-record eval set (at least 20 real, labelled 7/12, Ferfar and Index-II pages) before extraction is switched on for clients. Both harnesses are ready (`packages/ocr/eval` for OCR, `apps/api/test/extract.eval.test.ts` for extraction); today they run on synthetic pages only.
- [ ] Daily backups running and a restore tested

## Exceptions to the standard

### sharp / libvips (LGPL-3.0), Review tier

1. **What and why:** `sharp` (Apache-2.0) is the image library that re-encodes uploads (stripping EXIF/GPS) and prepares pages for OCR. It ships prebuilt **libvips** binaries (`@img/sharp-libvips-*`), which are LGPL-3.0. The permissive alternatives are slower or less proven for this job.
2. **License, pricing, exit path:** free. Used unmodified, dynamically linked, only on our servers; nothing is distributed to browsers or phones, and LGPL has no network clause. If this changes, image handling sits in two places (`apps/api/src/routes/documents.ts`, `packages/ocr`) and can move to an MIT/Apache library such as `@napi-rs/image`.
3. **Approved by:** Prasanna Wagh, 2026-11-16. The license gate (`scripts/check-licenses.mjs`) allowlists only `@img/sharp-libvips-*`.
4. **New default for future projects?** No: decide per project.

### Web fonts (OFL-1.1), pending owner confirmation

1. **What and why:** the typefaces of the web and admin apps, Inter for all English text and IBM Plex Sans Devanagari for Marathi letters, which Inter does not have, are bundled from `@fontsource/*` and served from our own origin. Loading them from Google Fonts would send every visitor's IP address to Google before any consent, which goes against "private by default" (DPDP).
2. **License, pricing, exit path:** SIL Open Font License 1.1, free. It allows bundling in commercial software; the only limits are not selling the fonts on their own and not shipping modified copies under the reserved names. We ship them unmodified. To exit, remove the font imports in `main.tsx` and `index.css` of `apps/web` and `apps/admin`: the CSS font stacks fall back to system fonts (Noto Sans Devanagari on Android).
3. **Approved by:** _pending._ Added during an unattended run on 2026-11-16; Prasanna Wagh to confirm or reject. The license gate lists the two packages by name.
4. **New default for future projects?** Suggested yes for fonts only: OFL is the standard license for open fonts.

### nodemailer (MIT-0), pending owner confirmation

1. **What and why:** `nodemailer` sends the API's emails (password resets, address checks, payment receipts) over SMTP, so any provider works (Amazon SES Mumbai, Zoho, Brevo) and switching is a change of `SMTP_URL`. It has no dependencies.
2. **License, pricing, exit path:** MIT-0 is MIT without the requirement to keep the copyright notice: more permissive than MIT, but not on the allowed list by name. Free. To exit, replace `SmtpMailer` in `apps/api/src/mail.ts` with a provider's HTTP API called through `fetch`.
3. **Approved by:** _pending._ Prasanna Wagh to confirm, or to add MIT-0 to the allowed licenses.
4. **New default for future projects?** Suggested yes: add MIT-0 to the allowed list.

### Dev-only note

`@fastify/swagger-ui` pulls in BlueOak-1.0.0 packages, so it is a dev-only dependency. It is not loaded in production and is not part of the shipped dependency tree, so no exception is needed.
