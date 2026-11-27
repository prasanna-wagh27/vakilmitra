/**
 * Read one case from the configured court-data service and print what VakilMitra makes of it,
 * without saving anything. Use it once with the real key before turning tracking on, and
 * compare with the case on services.ecourts.gov.in:
 *   COURTS_PROVIDER=ecourtsindia COURTS_API_KEY=... pnpm --filter @vakilmitra/worker courts:check MHPU010012342024
 * Each run is one paid lookup.
 */
import { courtsConfigFromEnv, createCourtProvider, normalizeCnr } from "@vakilmitra/courts";

const cnr = normalizeCnr(process.argv[2]);
if (!cnr) {
  console.error("Give a CNR: 16 characters, like MHPU010012342024");
  process.exit(2);
}
const provider = createCourtProvider(courtsConfigFromEnv(process.env));
if (!provider) {
  console.error("COURTS_PROVIDER is not set");
  process.exit(2);
}
const c = await provider.fetchCase(cnr);
if (!c) {
  console.log(`${provider.name}: no case with CNR ${cnr}`);
  process.exit(1);
}
console.log(JSON.stringify(c, null, 2));
const missing = (["caseNumber", "court", "statusText", "nextHearingDate"] as const).filter(
  (k) => !c[k] && !(k === "nextHearingDate" && c.disposed),
);
if (missing.length)
  console.warn(`\nNot found in the answer: ${missing.join(", ")}. Check the service's field names (packages/courts/src/ecourtsindia.ts).`);
