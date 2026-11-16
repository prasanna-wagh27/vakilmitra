# VakilMitra (वकीलमित्र)

A Marathi-first, mobile-first practice platform for Maharashtra advocates. The core idea: read messy Marathi land and court records and turn them into verified facts and drafts.

## Stack

| Part | Tech |
|---|---|
| `apps/web` | Next.js 16 (App Router), React 19, Tailwind 4. Marathi and English. Phone-first layout with bottom nav. |
| `apps/api` | Express 5, TypeScript, Prisma 6, PostgreSQL, Zod validation, JWT in an httpOnly cookie |

The web app proxies `/api/*` to the API (`next.config.ts`), so the browser only ever talks to one origin.

## Getting started

```bash
npm install
cp apps/api/.env.example apps/api/.env      # set DATABASE_URL and JWT_SECRET
npm run db:migrate                          # create tables
npm run db:seed                             # demo data: demo@vakilmitra.in / demo1234
npm run dev:api                             # http://localhost:4000
npm run dev:web                             # http://localhost:3000
npm test                                    # rules engine + API tests (needs a vakilmitra_test DB)
```

The API tests run against `TEST_DATABASE_URL` (default `postgresql://vakilmitra:vakilmitra@localhost:5432/vakilmitra_test`). Migrations are applied to it automatically.

## What's built (milestone 1)

| Spec feature | Status |
|---|---|
| 2. Case files and clients | ✅ Clients, case files, parties, search, status filters. Per-advocate access; a senior can share one case with a junior as viewer or editor. |
| 3. Land-file analyzer: **rule checks** | ✅ Deterministic red-flag engine (`apps/api/src/land/rules.ts`). Ownership timeline per property. Flags link to their source records. Resolved flags stay resolved when the check is run again. |
| 6. Case diary | ✅ Daily board grouped by court. Today/tomorrow. 14-day diary. Record what happened and set the next date in one step. A "next date not recorded" list so no date gets missed. |
| 7. Fees and invoices | ✅ Fee agreements, installments, payments. Outstanding and overdue per client on one screen. Printable invoice. |
| Security / DPDP | ✅ Access log on case views, shares and deletes. One-tap delete of a case, or of the whole account (needs password). bcrypt passwords. Helmet. |
| 1. Scanner + OCR | ⏳ Next |
| 3. Land-file analyzer: classify / extract / link | ⏳ Next. Records are entered by hand for now. |
| 4. Marathi drafting, 5. Verified translation | ⏳ The `Draft` model exists; the feature does not yet |
| 8. WhatsApp | ⏳ The client opt-in flag exists; sending does not yet |

### Red-flag rules

Every rule is a pure function over structured events: no LLM, no clock, no I/O. Each flag carries the event and fact ids that triggered it.

- `DEED_WITHOUT_MUTATION`: a registered sale, gift, partition, release or exchange deed with no matching Ferfar within 24 months. A match is by cited deed number, or by type, time window and transferee name.
- `MUTATION_WITHOUT_DEED`: a transfer mutation with no registered deed. Heirship is exempt.
- `AREA_CHANGE`: area differs between 7/12 extracts. Lowered to LOW only when a partition or acquisition lies in between and no correction does.
- `LAND_CLASS_CHANGE`: for example, Class-II to Class-I.
- `SECTION_155_CORRECTION`: any correction entry.
- `OTHER_RIGHTS_ENTRY`: इतर हक्क entries, sorted by keyword into bank charge, heir or encumbrance.
- `CHAIN_START_GAP` / `CHAIN_BREAK`: the chain doesn't reach back 30 years, or a transferor isn't the recorded owner.

## Layout

```
apps/api/prisma/schema.prisma   core data model (case file, document, page, fact+crop, property chain, flag, draft, hearing, fees, access log)
apps/api/src/land/rules.ts      deterministic rules engine
apps/api/src/routes/            auth, clients, cases, diary/hearings, fees, land
apps/api/test/                  rules unit tests + API integration tests
apps/web/app/(app)/             today, cases, case detail, property chain, diary, clients, fees, invoice, settings
apps/web/lib/i18n.tsx           Marathi/English dictionary
```

## Not yet production-ready

- Encryption at rest and India-region object storage: they come with document upload in the scanner milestone.
- There is no rate limiting on login, no password reset and no email verification yet.
- Times are handled in IST (`lib/time.ts`). Court dates entered as a calendar day are stored as 11:00 IST.
