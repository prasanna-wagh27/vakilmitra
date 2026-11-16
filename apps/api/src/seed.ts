/** Demo data for local development: one advocate, clients, cases, hearings, fees and a land chain. */
import {
  advocates,
  cases,
  clients,
  eq,
  feeAgreements,
  hearings,
  installments,
  ownershipEvents,
  parties,
  payments,
  properties,
} from "@vakilmitra/db";
import { istDate } from "@vakilmitra/shared";
import { auth } from "./auth.js";
import { db, pool } from "./db.js";

const DAY = 86_400_000;
/** n days from today at the given IST hour. */
/** n IST calendar days from today, at the given IST hour. */
const inDays = (n: number, hour = 11) =>
  new Date(`${istDate(new Date(Date.now() + n * DAY))}T${String(hour).padStart(2, "0")}:00:00+05:30`);
const y = (s: string) => new Date(`${s}T00:00:00Z`);

const email = "demo@vakilmitra.in";
await db.delete(advocates).where(eq(advocates.email, email));
const { user } = await auth.api.signUpEmail({
  body: { name: "अ‍ॅड. प्रसन्न देशमुख", email, password: "demo1234", phone: "9800000001", barCouncilNo: "MAH/1234/2015" },
});
const advocateId = user.id;

const [jadhav, kulkarni, bank] = await db
  .insert(clients)
  .values([
    { advocateId, name: "सुनील जाधव", phone: "9822000001", whatsappOptIn: true },
    { advocateId, name: "मीना कुलकर्णी", phone: "9822000002" },
    { advocateId, name: "Baramati Sahakari Bank", phone: "02112-220000" },
  ])
  .returning();

const [suit, family, tsr] = await db
  .insert(cases)
  .values([
    {
      advocateId,
      clientId: jadhav.id,
      title: "जाधव वि. पाटील (मनाई हुकूम)",
      kind: "LAND_PROPERTY",
      caseNumber: "RCS 123/2025",
      court: "दिवाणी न्यायाधीश क.स्तर, बारामती",
    },
    {
      advocateId,
      clientId: kulkarni.id,
      title: "कुलकर्णी - घटस्फोट याचिका",
      kind: "FAMILY",
      caseNumber: "PA 45/2026",
      court: "Family Court, Pune",
    },
    { advocateId, clientId: bank.id, title: "Title search — Gat 112, Malegaon", kind: "TITLE_SEARCH" },
  ])
  .returning();

await db.insert(parties).values([
  { caseId: suit.id, name: "सुनील जाधव", role: "PLAINTIFF", isOurClient: true },
  { caseId: suit.id, name: "महेश पाटील", role: "DEFENDANT", opposingCounsel: "अ‍ॅड. शिंदे" },
]);
await db.insert(hearings).values([
  { caseId: suit.id, date: inDays(-14), court: suit.court, purpose: "Written statement", outcome: "WS filed" },
  { caseId: suit.id, date: inDays(0), court: suit.court, purpose: "पुरावा (Evidence)" },
  { caseId: family.id, date: inDays(1), court: family.court, purpose: "Mediation" },
]);

const [prop] = await db
  .insert(properties)
  .values({ caseId: tsr.id, gatNo: "112", village: "माळेगाव", taluka: "बारामती", district: "पुणे" })
  .returning();
await db.insert(ownershipEvents).values([
  { propertyId: prop.id, kind: "RECORD_SNAPSHOT", date: y("1995-06-01"), owners: ["रामचंद्र पाटील"], areaSqm: 8100, landClass: "Class-II" },
  {
    propertyId: prop.id,
    kind: "DEED",
    subtype: "SALE",
    date: y("2001-03-10"),
    deedRegNo: "1234/2001",
    fromParties: ["रामचंद्र पाटील"],
    toParties: ["सुरेश जाधव"],
  },
  {
    propertyId: prop.id,
    kind: "MUTATION",
    subtype: "SALE",
    date: y("2001-08-20"),
    ferfarNo: "456",
    refDeedRegNo: "1234/2001",
    fromParties: ["रामचंद्र पाटील"],
    toParties: ["सुरेश जाधव"],
  },
  {
    propertyId: prop.id,
    kind: "MUTATION",
    subtype: "CORRECTION",
    date: y("2019-04-02"),
    ferfarNo: "1290",
    section155: true,
    notes: "Area corrected",
  },
  {
    propertyId: prop.id,
    kind: "RECORD_SNAPSHOT",
    date: y("2025-06-01"),
    owners: ["सुरेश जाधव"],
    areaSqm: 9300,
    landClass: "Class-I",
    otherRights: ["बँक ऑफ महाराष्ट्र बोजा रु. ५,००,०००"],
  },
]);

const [fee] = await db
  .insert(feeAgreements)
  .values({ clientId: jadhav.id, caseId: suit.id, description: "दावा फी", totalPaise: 2_500_000 })
  .returning();
await db.insert(installments).values([
  { agreementId: fee.id, dueDate: inDays(-30), amountPaise: 1_000_000 },
  { agreementId: fee.id, dueDate: inDays(30), amountPaise: 1_500_000 },
]);
await db.insert(payments).values({ agreementId: fee.id, amountPaise: 500_000, paidOn: inDays(-25), mode: "upi" });
await db.insert(feeAgreements).values({ clientId: bank.id, caseId: tsr.id, description: "Title search report", totalPaise: 400_000 });

console.log(`Seeded. Sign in as ${email} / demo1234`);
await pool.end();
