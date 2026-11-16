# VakilMitra (वकीलमित्र)

A Marathi-first, mobile-first practice platform for Maharashtra advocates. The core idea: read messy Marathi land and court records and turn them into verified facts and drafts.

Built to the **Tech Stack Standard**. Hosting tier: **Prototype / MVP** (pilot, under 1k users). Project type: **web SPA**. An Expo mobile app (`apps/mobile`) is planned for the scanner milestone.

## Layout

```
apps/web         Vite + React SPA: TanStack Router/Query, Tailwind + shadcn/ui, React Hook Form + Zod, Zustand, lucide
apps/api         Fastify API: Zod type provider + OpenAPI docs, Better Auth, pino logging
packages/db      Drizzle schema + migrations (PostgreSQL)
packages/shared  Zod schemas, enums, response types, IST date helpers, Marathi/English strings
scripts/         license gate
```

Tooling: pnpm workspaces + Turborepo, Biome (lint + format), Vitest, GitHub Actions (license check, lint, build, typecheck, test on every PR).

## Getting started

```bash
pnpm install
cp apps/api/.env.example apps/api/.env        # DATABASE_URL, BETTER_AUTH_SECRET
cp packages/db/.env.example packages/db/.env
pnpm db:migrate                               # apply Drizzle migrations
pnpm build                                    # build shared packages
pnpm db:seed                                  # demo: demo@vakilmitra.in / demo1234
pnpm dev                                      # API :4000, web :5173 (proxies /api)
```

- API docs (development only): http://localhost:4000/api/docs
- Tests: `pnpm test`. This needs a Postgres test database at `TEST_DATABASE_URL`, by default `postgresql://vakilmitra:vakilmitra@localhost:5432/vakilmitra_test`. Migrations are applied to it automatically.
- Schema change: edit `packages/db/src/schema.ts`, then run `pnpm db:generate` and `pnpm db:migrate`.
- Before a release: `pnpm check:licenses` (CI runs it too).

## What's built (milestone 1)

| Spec feature | Status |
|---|---|
| 2. Case files and clients | ✅ Clients, case files, parties, search, status filters. Per-advocate access; a senior can share one case with a junior as viewer or editor. |
| 3. Land-file analyzer: **rule checks** | ✅ Deterministic red-flag engine (`apps/api/src/land/rules.ts`). Ownership timeline per property. Each flag links to its source records. Resolved flags stay resolved when the check is run again. |
| 6. Case diary | ✅ Daily board grouped by court. Today/tomorrow. 14-day diary. Record what happened and set the next date in one step. A "next date not recorded" list. |
| 7. Fees and invoices | ✅ Fee agreements, installments, payments. Outstanding and overdue per client on one screen. Printable invoice. |
| Security / DPDP | ✅ Better Auth sessions in our own Postgres, with rate limiting. Access log on case views, shares and deletes. One-tap delete of a case, or of the whole account (always needs the password; anonymised audit entry). |
| 1. Scanner + OCR | ⏳ Next milestone, along with Expo, R2 storage and BullMQ/Valkey workers |
| 3. Classify / extract / link | ⏳ Next milestone (AI SDK + eval set). Records are entered by hand for now. |
| 4. Drafting, 5. Translation | ⏳ The `draft` table exists; the feature does not yet |
| 8. WhatsApp | ⏳ MSG91 adapter. The client opt-in flag exists; sending does not yet. |

### Red-flag rules

Every rule is a pure function over structured events: no LLM, no clock, no I/O. Each flag carries the event and fact ids that triggered it.

- `DEED_WITHOUT_MUTATION` / `MUTATION_WITHOUT_DEED`: matched by cited deed number, or by type, time window and transferee name. Heirship mutations are exempt.
- `AREA_CHANGE`: area differs between 7/12 extracts. Lowered to LOW only when a partition or acquisition lies in between and no correction does.
- `LAND_CLASS_CHANGE`, `SECTION_155_CORRECTION`.
- `OTHER_RIGHTS_ENTRY`: इतर हक्क entries, sorted into bank charge, heir or encumbrance.
- `CHAIN_START_GAP` / `CHAIN_BREAK`: the chain doesn't reach back 30 years, or a transferor isn't the recorded owner.

## Deployment notes

- The web app calls the API at `VITE_API_URL`. Put both on the same site, e.g. `app.` and `api.` subdomains of one domain, so the session cookie works. Add the web origin to `WEB_ORIGIN` on the API.
- Prototype tier: Neon/Supabase Postgres, API on Railway/Render/Coolify, SPA on Cloudflare Pages. Files must stay in India: when documents arrive, use an India-region S3-compatible bucket.

## Kickoff checklist

- [x] Hosting tier and project type picked (Prototype, web SPA; Expo next)
- [x] Monorepo: pnpm, Turborepo, Biome, Vitest, GitHub Actions
- [ ] Cloud, domain, app store and API accounts in the client's name
- [ ] Staging and production with separate databases and keys
- [x] Env vars validated with Zod at boot; no secrets in git
- [ ] Sentry, PostHog; Langfuse when AI work starts
- [x] CI license check passes (no banned licenses)
- [ ] AI eval set (at least 20 real cases) before the extraction feature launches
- [ ] Daily backups running and a restore tested

## Exceptions to the standard

None. (`@fastify/swagger-ui` pulls in BlueOak-1.0.0 packages, so it is a dev-only dependency. It is not loaded in production and is not part of the shipped dependency tree.)
