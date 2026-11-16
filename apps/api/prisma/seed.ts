/** Demo data for local development: one advocate, a few clients, cases, hearings, fees and a land chain. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const DAY = 86400000;
const inDays = (n: number, hour = 11) => {
  const d = new Date(Date.now() + n * DAY);
  d.setUTCHours(hour - 5, 30, 0, 0); // hour in IST
  return d;
};

async function main() {
  const email = "demo@vakilmitra.in";
  await prisma.advocate.deleteMany({ where: { email } });
  const adv = await prisma.advocate.create({
    data: { name: "अ‍ॅड. प्रसन्न देशमुख", email, phone: "9800000001", barCouncilNo: "MAH/1234/2015", passwordHash: await bcrypt.hash("demo1234", 12) },
  });

  const jadhav = await prisma.client.create({ data: { advocateId: adv.id, name: "सुनील जाधव", phone: "9822000001", whatsappOptIn: true } });
  const kulkarni = await prisma.client.create({ data: { advocateId: adv.id, name: "मीना कुलकर्णी", phone: "9822000002" } });
  const bank = await prisma.client.create({ data: { advocateId: adv.id, name: "Baramati Sahakari Bank", phone: "02112-220000" } });

  const suit = await prisma.caseFile.create({
    data: {
      advocateId: adv.id, clientId: jadhav.id, title: "जाधव वि. पाटील (मनाई हुकूम)", kind: "LAND_PROPERTY",
      caseNumber: "RCS 123/2025", court: "दिवाणी न्यायाधीश क.स्तर, बारामती",
      parties: { create: [{ name: "सुनील जाधव", role: "PLAINTIFF", isOurClient: true }, { name: "महेश पाटील", role: "DEFENDANT", opposingCounsel: "अ‍ॅड. शिंदे" }] },
      hearings: { create: [{ date: inDays(-14), purpose: "Written statement", outcome: "WS filed" }, { date: inDays(0), purpose: "पुरावा (Evidence)" }] },
    },
  });
  await prisma.caseFile.create({
    data: {
      advocateId: adv.id, clientId: kulkarni.id, title: "कुलकर्णी - घटस्फोट याचिका", kind: "FAMILY",
      caseNumber: "PA 45/2026", court: "Family Court, Pune",
      hearings: { create: [{ date: inDays(1), purpose: "Mediation" }] },
    },
  });
  const tsr = await prisma.caseFile.create({
    data: { advocateId: adv.id, clientId: bank.id, title: "Title search — Gat 112, Malegaon", kind: "TITLE_SEARCH" },
  });
  const prop = await prisma.property.create({ data: { caseId: tsr.id, gatNo: "112", village: "माळेगाव", taluka: "बारामती", district: "पुणे" } });
  const y = (s: string) => new Date(`${s}T00:00:00Z`);
  await prisma.ownershipEvent.createMany({
    data: [
      { propertyId: prop.id, kind: "RECORD_SNAPSHOT", date: y("1995-06-01"), owners: ["रामचंद्र पाटील"], areaSqm: 8100, landClass: "Class-II" },
      { propertyId: prop.id, kind: "DEED", subtype: "SALE", date: y("2001-03-10"), deedRegNo: "1234/2001", fromParties: ["रामचंद्र पाटील"], toParties: ["सुरेश जाधव"] },
      { propertyId: prop.id, kind: "MUTATION", subtype: "SALE", date: y("2001-08-20"), ferfarNo: "456", refDeedRegNo: "1234/2001", fromParties: ["रामचंद्र पाटील"], toParties: ["सुरेश जाधव"] },
      { propertyId: prop.id, kind: "MUTATION", subtype: "CORRECTION", date: y("2019-04-02"), ferfarNo: "1290", section155: true, notes: "Area corrected" },
      { propertyId: prop.id, kind: "RECORD_SNAPSHOT", date: y("2025-06-01"), owners: ["सुरेश जाधव"], areaSqm: 9300, landClass: "Class-I", otherRights: ["बँक ऑफ महाराष्ट्र बोजा रु. ५,००,०००"] },
    ],
  });

  await prisma.feeAgreement.create({
    data: {
      clientId: jadhav.id, caseId: suit.id, description: "दावा फी", totalPaise: 2500000,
      installments: { create: [{ dueDate: inDays(-30), amountPaise: 1000000 }, { dueDate: inDays(30), amountPaise: 1500000 }] },
      payments: { create: [{ amountPaise: 500000, paidOn: inDays(-25), mode: "upi" }] },
    },
  });
  await prisma.feeAgreement.create({
    data: { clientId: bank.id, caseId: tsr.id, description: "Title search report", totalPaise: 400000 },
  });
  console.log(`Seeded. Sign in as ${email} / demo1234`);
}

main().finally(() => prisma.$disconnect());
