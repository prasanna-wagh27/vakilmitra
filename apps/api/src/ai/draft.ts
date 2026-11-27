/**
 * Drafting legal documents for an advocate in Maharashtra: public notices, legal notices and
 * replies, plaints and written statements, affidavits and applications. The model writes a first draft from the advocate's
 * instructions and (if asked) the case's own details; the advocate edits and signs it.
 */
import type { DraftKind, Locale } from "@vakilmitra/shared";

const LANGUAGE: Record<Locale, string> = {
  mr: "Marathi (Devanagari script), in the formal register used in Maharashtra courts and revenue offices",
  en: "English, in the formal register used in Indian courts",
};

const KIND: Record<DraftKind, string> = {
  PUBLIC_NOTICE: [
    "A public notice (जाहीर नोटीस) for a newspaper, issued by the advocate before a client buys, takes a mortgage on, or develops land.",
    "Describe the property fully (village, taluka, district, survey / gat / hissa numbers, area) and name the present owner(s).",
    "Invite anyone with a right, title, interest, claim or encumbrance (sale, gift, mortgage, lease, lien, inheritance, agreement, court order) to object in writing with documentary proof to the advocate's office within [14] days.",
    "State that after that period the transaction will be completed as if there were no claims, and any claim made later will be treated as waived.",
  ].join(" "),
  LEGAL_NOTICE: [
    "A legal notice sent by the advocate on behalf of the client to the other party.",
    "Begin 'Under instructions from and on behalf of my client ...'. Set out the facts in numbered paragraphs, then the demand, the time given to comply (15 days unless the instructions say otherwise), and that the client will take legal proceedings at the addressee's risk as to costs if they do not.",
    "Include the addressee's name and address, the mode of sending (e.g. by RPAD / email), and a line that a copy is kept for further action.",
  ].join(" "),
  NOTICE_REPLY: [
    "A reply, sent by the advocate on behalf of the client, to a notice the client received.",
    "Refer to the notice by date. State that every allegation not specifically admitted is denied. Reply paragraph-wise in numbered paragraphs, set out the client's true version, and call on the sender to withdraw the notice.",
    "Reserve the client's rights to take any action, and say a copy is kept for record.",
  ].join(" "),
  PLAINT: [
    "A plaint to institute a civil suit in a court in Maharashtra, with every part Order VII of the Code of Civil Procedure asks for, in this order.",
    "The cause title: the court (such as the Civil Judge, Junior Division, at [place]), 'Regular Civil Suit No. [ ] of [year]', and each plaintiff and defendant with name, age, occupation and residence.",
    "The nature of the suit in one line. Then numbered paragraphs: the facts constituting the cause of action, in the order they happened; when and where the cause of action arose; why the court has territorial and pecuniary jurisdiction; that the suit is within limitation and why; the valuation of the suit for jurisdiction and court fee and the court fee paid; that no other suit on the same cause between the parties is pending or decided (as a placeholder to confirm if the instructions do not say); the address for service of the plaintiff.",
    "The prayer: each relief claimed set out separately, then costs of the suit and any other relief the court thinks fit.",
    "Place and date, the plaintiff's signature and the advocate's signature for the plaintiff. Then the verification by the plaintiff: which paragraphs are true to own knowledge and which on information and belief, with place and date.",
    "End with a line that an affidavit in support of the plaint is filed, and a numbered list of documents relied on (placeholders for what the instructions do not name).",
    "In Marathi use the terms of Maharashtra courts: वादपत्र, नियमित दिवाणी दावा क्र., वादी, प्रतिवादी, दाव्यास कारण, अधिकारक्षेत्र, मुदत, मूल्यांकन व कोर्ट फी, विनंती, सत्यापन, कागदपत्रांची यादी.",
  ].join(" "),
  WRITTEN_STATEMENT: [
    "A written statement of a defendant in a pending civil suit in Maharashtra, as Order VIII of the Code of Civil Procedure asks for it.",
    "The cause title as in the plaint, with the suit number, then 'Written statement on behalf of defendant no. [ ]'.",
    "Preliminary objections first (such as maintainability, jurisdiction, limitation, non-joinder of parties, valuation and court fee), only those the instructions support.",
    "Then a reply to each paragraph of the plaint by its number, admitting or denying each allegation specifically; never an evasive or general denial. Add that whatever is not specifically admitted is denied.",
    "Then the defendant's own version of the facts in numbered paragraphs, and that the plaintiff has no cause of action. A set-off or counter-claim only if the instructions ask for one, with its own valuation and court fee.",
    "The prayer that the suit be dismissed with costs, and any other relief the instructions ask for. Place and date, the defendant's and the advocate's signatures, the verification by the defendant (own knowledge and information and belief, by paragraph), a line that an affidavit in support is filed, and a numbered list of documents relied on.",
    "In Marathi use the terms of Maharashtra courts: लेखी कैफियत, नियमित दिवाणी दावा क्र., वादी, प्रतिवादी, प्राथमिक आक्षेप, परिच्छेदनिहाय उत्तर, नाकबूल, खरी वस्तुस्थिती, विनंती, सत्यापन, कागदपत्रांची यादी.",
  ].join(" "),
  AFFIDAVIT: [
    "An affidavit (प्रतिज्ञापत्र) to be sworn by the deponent and filed.",
    "Give the cause title (court and case number) if known, the deponent's name, age, occupation and address, then numbered statements made on solemn affirmation, the verification clause (true to the deponent's own knowledge / information and belief), place and date, the deponent's signature, and identification by the advocate.",
  ].join(" "),
  APPLICATION: [
    "An application (अर्ज) to a court or authority, such as for adjournment, exemption from appearance, condonation of delay, production of documents or a certified copy.",
    "Give the cause title, the provision it is made under if the instructions name one, the grounds in numbered paragraphs, the prayer clause, place and date, and the signature of the advocate for the applicant.",
  ].join(" "),
  OTHER: "The document the advocate's instructions describe.",
};

export function draftPrompt(kind: DraftKind, language: Locale) {
  return [
    "You draft legal documents for an advocate practising in Maharashtra, India.",
    `Write in ${LANGUAGE[language]}.`,
    `What to draft: ${KIND[kind]}`,
    "Rules:",
    "- Use only the facts in the instructions and case details. Where a fact the document needs is missing, leave a placeholder in square brackets, such as [address] or [दिनांक]. Never invent names, dates, amounts, survey numbers, sections of law or case citations.",
    "- Do not cite judgments. Name a statute or section only if the instructions name it.",
    "- Write the complete document, ready for the advocate to review and sign: no explanations before or after, no notes to the advocate, no alternatives.",
    "- Plain text only: no Markdown, no asterisks or # headings. Put headings on their own lines and number the paragraphs.",
    "- Sign it off with the advocate's name and details as given.",
  ].join("\n");
}

export interface CaseContext {
  title: string;
  kind: string;
  court: string | null;
  caseNumber: string | null;
  filedOn: Date | null;
  client: { name: string; address: string | null } | null;
  parties: { name: string; role: string; isOurClient: boolean; address: string | null; opposingCounsel: string | null }[];
  properties: {
    surveyNo: string | null;
    gatNo: string | null;
    hissaNo: string | null;
    village: string | null;
    taluka: string | null;
    district: string | null;
  }[];
}

export interface Advocate {
  name: string;
  barCouncilNo: string | null;
  phone: string | null;
}

const line = (label: string, value: string | null | undefined) => (value ? `${label}: ${value}` : null);

/** The user message: the advocate's details, the case's details (if asked), then the instructions. */
export function draftMessage(instructions: string, advocate: Advocate, ctx: CaseContext | null) {
  const out = [
    "Advocate (for the signature block):",
    line("Name", advocate.name),
    line("Bar Council enrolment no.", advocate.barCouncilNo),
    line("Phone", advocate.phone),
  ];
  if (ctx) {
    out.push(
      "",
      "Case details:",
      line("Title", ctx.title),
      line("Type", ctx.kind),
      line("Court", ctx.court),
      line("Case no.", ctx.caseNumber),
      line("Filed on", ctx.filedOn?.toISOString().slice(0, 10)),
      line("Client", ctx.client && [ctx.client.name, ctx.client.address].filter(Boolean).join(", ")),
    );
    for (const p of ctx.parties) {
      out.push(
        `Party: ${p.name} (${p.role.toLowerCase()}${p.isOurClient ? ", our client" : ""})${p.address ? `, ${p.address}` : ""}${p.opposingCounsel ? `; their advocate: ${p.opposingCounsel}` : ""}`,
      );
    }
    for (const p of ctx.properties) {
      const ids = [p.surveyNo && `survey no. ${p.surveyNo}`, p.gatNo && `gat no. ${p.gatNo}`, p.hissaNo && `hissa no. ${p.hissaNo}`];
      const place = [p.village && `village ${p.village}`, p.taluka && `taluka ${p.taluka}`, p.district && `district ${p.district}`];
      out.push(`Property: ${[...ids, ...place].filter(Boolean).join(", ")}`);
    }
  }
  out.push("", "Instructions from the advocate:", instructions);
  return out.filter((l) => l !== null).join("\n");
}

/** Models sometimes wrap their answer in Markdown despite the rules; the draft is plain text. */
export function plainText(s: string) {
  return s
    .replace(/^```[a-z]*\n?|\n?```$/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}
