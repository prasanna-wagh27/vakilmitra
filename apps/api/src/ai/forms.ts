/**
 * Blank forms for a plaint and a written statement: every part the Code of Civil Procedure asks
 * for (Order VII, Order VIII, Order VI rules 14 to 15), in the order Maharashtra courts expect,
 * with the case's court, number, parties and properties filled in and [blanks] for the rest.
 * No AI: the advocate writes the facts. The same parts are checked by checkDraftParts (shared).
 */
import type { FormKind, Locale } from "@vakilmitra/shared";
import type { Advocate, CaseContext } from "./draft.js";

type Party = CaseContext["parties"][number];
type Property = CaseContext["properties"][number];

const W = {
  mr: {
    court: (c: string | null) => (c ? `मा. ${c} यांचे न्यायालयात` : "मा. [दिवाणी न्यायाधीश, कनिष्ठ स्तर], [ठिकाण] यांचे न्यायालयात"),
    suitNo: (n: string | null) => `नियमित दिवाणी दावा क्र. ${n ?? "[   ] / [वर्ष]"}`,
    party: (p: Party | null, i: number) => `${i}. ${p?.name ?? "[नाव]"}, वय [  ] वर्षे, धंदा [  ], रा. ${p?.address ?? "[पत्ता]"}`,
    plaintiffs: "... वादी",
    versus: "विरुद्ध",
    defendants: "... प्रतिवादी",
    property: (p: Property) =>
      `${[
        p.village && `मौजे ${p.village}`,
        p.taluka && `ता. ${p.taluka}`,
        p.district && `जि. ${p.district}`,
        p.surveyNo && `स.नं. ${p.surveyNo}`,
        p.gatNo && `गट नं. ${p.gatNo}`,
        p.hissaNo && `हिस्सा नं. ${p.hissaNo}`,
      ]
        .filter(Boolean)
        .join(", ")}, क्षेत्र [  ] हे. आर., आकार [  ] रु., चतुःसीमा: पूर्वेस [  ], पश्चिमेस [  ], दक्षिणेस [  ], उत्तरेस [  ]`,
    schedule: "दाव्याच्या मिळकतीचे वर्णन",
    placeDate: ["ठिकाण : [  ]", "दिनांक : [  ]"],
    documents: "कागदपत्रांची यादी",
    docLines: ["1. [  ]", "2. [  ]", "3. [  ]"],
  },
  en: {
    court: (c: string | null) =>
      c ? `IN THE COURT OF THE ${c.toUpperCase()}` : "IN THE COURT OF THE [CIVIL JUDGE, JUNIOR DIVISION], AT [PLACE]",
    suitNo: (n: string | null) => `REGULAR CIVIL SUIT NO. ${n ?? "[   ] OF [YEAR]"}`,
    party: (p: Party | null, i: number) =>
      `${i}. ${p?.name ?? "[Name]"}, aged about [  ] years, occupation [  ], residing at ${p?.address ?? "[address]"}`,
    plaintiffs: "... PLAINTIFF(S)",
    versus: "VERSUS",
    defendants: "... DEFENDANT(S)",
    property: (p: Property) =>
      `${[
        p.surveyNo && `Survey No. ${p.surveyNo}`,
        p.gatNo && `Gat No. ${p.gatNo}`,
        p.hissaNo && `Hissa No. ${p.hissaNo}`,
        p.village && `village ${p.village}`,
        p.taluka && `taluka ${p.taluka}`,
        p.district && `district ${p.district}`,
      ]
        .filter(Boolean)
        .join(", ")}, area [  ] H. R., assessment Rs. [  ], bounded: east [  ], west [  ], south [  ], north [  ]`,
    schedule: "SCHEDULE OF THE SUIT PROPERTY",
    placeDate: ["Place: [  ]", "Date: [  ]"],
    documents: "LIST OF DOCUMENTS",
    docLines: ["1. [  ]", "2. [  ]", "3. [  ]"],
  },
} as const;

function causeTitle(language: Locale, ctx: CaseContext | null) {
  const w = W[language];
  const of = (role: string) => ctx?.parties.filter((p) => p.role === role) ?? [];
  const list = (ps: Party[]) => (ps.length ? ps : [null]).map((p, i) => w.party(p, i + 1));
  return [
    w.court(ctx?.court ?? null),
    w.suitNo(ctx?.caseNumber ?? null),
    "",
    ...list(of("PLAINTIFF")),
    w.plaintiffs,
    "",
    w.versus,
    "",
    ...list(of("DEFENDANT")),
    w.defendants,
  ];
}

/** The suit property, from the case's properties; one blank entry for a property suit without any. */
function schedule(language: Locale, ctx: CaseContext | null) {
  const props = ctx?.properties ?? [];
  if (!props.length) return [];
  const w = W[language];
  return ["", w.schedule, ...props.map((p, i) => `${i + 1}. ${w.property(p)}`)];
}

function signature(language: Locale, advocate: Advocate, side: "plaintiff" | "defendant") {
  const name = [advocate.name, advocate.barCouncilNo && `(${advocate.barCouncilNo})`].filter(Boolean).join(" ");
  const who =
    language === "mr"
      ? side === "plaintiff"
        ? ["वादी", "", `वादीतर्फे वकील`]
        : ["प्रतिवादी", "", "प्रतिवादीतर्फे वकील"]
      : side === "plaintiff"
        ? ["Plaintiff", "", "Advocate for the plaintiff"]
        : ["Defendant", "", "Advocate for the defendant"];
  return ["", ...W[language].placeDate, "", ...who, name];
}

const PLAINT_MR = (ctx: CaseContext | null, advocate: Advocate) => [
  ...causeTitle("mr", ctx),
  "",
  "वादपत्र",
  "दावा : [दाव्याचे स्वरूप, उदा. कायम मनाई हुकुमासाठी / रकमेच्या वसुलीसाठी]",
  "",
  "वादी विनंतीपूर्वक खालीलप्रमाणे सादर करतात :",
  "",
  "1. वादी व प्रतिवादी यांची माहिती : [पक्षकारांचे नाते, व्यवसाय, दाव्याशी संबंध]",
  "2. [दाव्याची हकीकत, घटना घडल्याच्या क्रमाने, तारखा व रकमांसह]",
  "3. [पुढील हकीकत]",
  "4. दाव्यास कारण : दाव्यास कारण दिनांक [  ] रोजी, [ठिकाण] येथे घडले, जेव्हा [  ], आणि ते आजपर्यंत चालू आहे.",
  "5. अधिकारक्षेत्र : [दाव्याची मिळकत / प्रतिवादी राहतात / दाव्यास कारण घडले ते ठिकाण] या मा. न्यायालयाच्या स्थानिक अधिकारक्षेत्रात आहे, आणि दाव्याचे मूल्यांकन या मा. न्यायालयाच्या आर्थिक अधिकारक्षेत्रात आहे.",
  "6. मुदत : दावा मुदतीत आहे, कारण [  ].",
  "7. मूल्यांकन व कोर्ट फी : अधिकारक्षेत्र व कोर्ट फीसाठी दाव्याचे मूल्यांकन रु. [  ] करण्यात आले असून त्यावर रु. [  ] कोर्ट फी भरली आहे.",
  "8. या दाव्याच्या विषयाबाबत वादी व प्रतिवादी यांच्यात यापूर्वी कोणताही दावा दाखल झालेला नाही व कोणताही दावा प्रलंबित नाही.",
  "9. वादी ज्या कागदपत्रांवर भिस्त ठेवतात ती सोबतच्या यादीप्रमाणे दाखल केली आहेत.",
  "10. वादीचा नोटीस बजावण्याचा पत्ता : [पत्ता]",
  ...schedule("mr", ctx),
  "",
  "विनंती :",
  "म्हणून वादी विनंती करतात की,",
  "अ) [पहिली मागणी, उदा. प्रतिवादीविरुद्ध कायम मनाई हुकूम]",
  "ब) [दुसरी मागणी]",
  "क) दाव्याचा खर्च प्रतिवादीकडून वादीस देवविण्यात यावा.",
  "ड) न्यायाचे हितासाठी मा. न्यायालयास योग्य वाटेल ती इतर दाद देण्यात यावी.",
  ...signature("mr", advocate, "plaintiff"),
  "",
  "सत्यापन",
  "मी, [वादीचे नाव], वादी, याद्वारे सत्यापन करतो/करते की वरील परिच्छेद क्र. [  ] ते [  ] मधील मजकूर माझ्या स्वतःच्या माहितीप्रमाणे खरा व बरोबर आहे, आणि परिच्छेद क्र. [  ] ते [  ] मधील मजकूर मला मिळालेल्या माहितीप्रमाणे व माझ्या समजुतीप्रमाणे खरा आहे.",
  "म्हणून आज दिनांक [  ] रोजी [ठिकाण] येथे सत्यापन केले.",
  "",
  "वादी",
  "",
  "(सोबत : वादपत्राच्या समर्थनार्थ वादीचे प्रतिज्ञापत्र)",
  "",
  W.mr.documents,
  ...W.mr.docLines,
];

const PLAINT_EN = (ctx: CaseContext | null, advocate: Advocate) => [
  ...causeTitle("en", ctx),
  "",
  "PLAINT",
  "Suit for [nature of the suit, e.g. permanent injunction / recovery of money]",
  "",
  "The plaintiff(s) respectfully submit as under:",
  "",
  "1. The parties: [who the parties are and how they are related to the subject of the suit]",
  "2. [The facts, in the order they happened, with dates and amounts]",
  "3. [Further facts]",
  "4. Cause of action: The cause of action for the suit arose on [date] at [place], when [  ], and it continues.",
  "5. Jurisdiction: [The suit property is situated / the defendants reside / the cause of action arose] within the local limits of the jurisdiction of this Hon'ble Court, and the valuation of the suit is within its pecuniary jurisdiction.",
  "6. Limitation: The suit is within limitation because [  ].",
  "7. Valuation and court fee: The suit is valued at Rs. [  ] for the purposes of jurisdiction and court fee, and court fee of Rs. [  ] is paid.",
  "8. No other suit on the same cause of action between the parties has been filed earlier or is pending.",
  "9. The plaintiff(s) rely on the documents filed with the list below.",
  "10. Address for service of the plaintiff(s): [address]",
  ...schedule("en", ctx),
  "",
  "PRAYER",
  "The plaintiff(s) therefore pray that:",
  "(a) [first relief, e.g. a decree of permanent injunction restraining the defendants from ...]",
  "(b) [second relief]",
  "(c) the costs of the suit be awarded to the plaintiff(s);",
  "(d) any other relief this Hon'ble Court thinks fit be granted.",
  ...signature("en", advocate, "plaintiff"),
  "",
  "VERIFICATION",
  "I, [name of the plaintiff], the plaintiff above named, verify that the contents of paragraphs [  ] to [  ] are true to my own knowledge, and the contents of paragraphs [  ] to [  ] are based on information received and believed by me to be true.",
  "Verified at [place] on [date].",
  "",
  "Plaintiff",
  "",
  "(Filed with: affidavit of the plaintiff in support of the plaint)",
  "",
  W.en.documents,
  ...W.en.docLines,
];

const WS_MR = (ctx: CaseContext | null, advocate: Advocate) => [
  ...causeTitle("mr", ctx),
  "",
  "प्रतिवादी क्र. [  ] यांची लेखी कैफियत",
  "",
  "प्रतिवादी विनंतीपूर्वक खालीलप्रमाणे सादर करतात :",
  "",
  "प्राथमिक आक्षेप",
  "1. वादीचा दावा कायद्याने चालण्यास पात्र नाही, कारण [  ].",
  "2. [मुदतबाह्य / अधिकारक्षेत्र नाही / आवश्यक पक्षकार सामील नाहीत / मूल्यांकन व कोर्ट फी अपुरी — जे लागू असेल ते]",
  "",
  "परिच्छेदनिहाय उत्तर",
  "3. वादपत्रातील परिच्छेद क्र. 1 मधील मजकूर [कबूल / नाकबूल] आहे. [कारण]",
  "4. वादपत्रातील परिच्छेद क्र. 2 मधील मजकूर [कबूल / नाकबूल] आहे. [कारण]",
  "5. वादपत्रातील परिच्छेद क्र. [  ] मधील मजकूर [  ].",
  "6. वादपत्रातील जो मजकूर या कैफियतीत विशेषतः कबूल केलेला नाही तो सर्व नाकबूल आहे.",
  "",
  "खरी वस्तुस्थिती",
  "7. [प्रतिवादीची बाजू, घटना घडल्याच्या क्रमाने]",
  "8. वादीस दावा दाखल करण्यास कोणतेही कारण घडलेले नाही.",
  "9. [वजावट किंवा प्रति-दावा असल्यास, त्याचे मूल्यांकन व कोर्ट फीसह; नसल्यास हा परिच्छेद काढा]",
  "10. प्रतिवादी ज्या कागदपत्रांवर भिस्त ठेवतात ती सोबतच्या यादीप्रमाणे दाखल केली आहेत.",
  "",
  "विनंती :",
  "म्हणून प्रतिवादी विनंती करतात की,",
  "अ) वादीचा दावा खर्चासह फेटाळण्यात यावा.",
  "ब) न्यायाचे हितासाठी मा. न्यायालयास योग्य वाटेल ती इतर दाद देण्यात यावी.",
  ...signature("mr", advocate, "defendant"),
  "",
  "सत्यापन",
  "मी, [प्रतिवादीचे नाव], प्रतिवादी क्र. [  ], याद्वारे सत्यापन करतो/करते की वरील परिच्छेद क्र. [  ] ते [  ] मधील मजकूर माझ्या स्वतःच्या माहितीप्रमाणे खरा व बरोबर आहे, आणि परिच्छेद क्र. [  ] ते [  ] मधील मजकूर मला मिळालेल्या माहितीप्रमाणे व माझ्या समजुतीप्रमाणे खरा आहे.",
  "म्हणून आज दिनांक [  ] रोजी [ठिकाण] येथे सत्यापन केले.",
  "",
  "प्रतिवादी",
  "",
  "(सोबत : लेखी कैफियतीच्या समर्थनार्थ प्रतिवादीचे प्रतिज्ञापत्र)",
  "",
  W.mr.documents,
  ...W.mr.docLines,
];

const WS_EN = (ctx: CaseContext | null, advocate: Advocate) => [
  ...causeTitle("en", ctx),
  "",
  "WRITTEN STATEMENT ON BEHALF OF DEFENDANT NO. [  ]",
  "",
  "The defendant respectfully submits as under:",
  "",
  "PRELIMINARY OBJECTIONS",
  "1. The suit is not maintainable because [  ].",
  "2. [Barred by limitation / want of jurisdiction / non-joinder of necessary parties / insufficient valuation and court fee: whichever applies]",
  "",
  "PARA-WISE REPLY",
  "3. The contents of paragraph 1 of the plaint are [admitted / denied]. [Reason]",
  "4. The contents of paragraph 2 of the plaint are [admitted / denied]. [Reason]",
  "5. The contents of paragraph [  ] of the plaint [  ].",
  "6. Whatever is not specifically admitted in this written statement is denied.",
  "",
  "TRUE FACTS",
  "7. [The defendant's version, in the order things happened]",
  "8. The plaintiff has no cause of action to file the suit.",
  "9. [Set-off or counter-claim, if any, with its valuation and court fee; otherwise remove this paragraph]",
  "10. The defendant relies on the documents filed with the list below.",
  "",
  "PRAYER",
  "The defendant therefore prays that:",
  "(a) the suit be dismissed with costs;",
  "(b) any other relief this Hon'ble Court thinks fit be granted.",
  ...signature("en", advocate, "defendant"),
  "",
  "VERIFICATION",
  "I, [name of the defendant], defendant no. [  ], verify that the contents of paragraphs [  ] to [  ] are true to my own knowledge, and the contents of paragraphs [  ] to [  ] are based on information received and believed by me to be true.",
  "Verified at [place] on [date].",
  "",
  "Defendant",
  "",
  "(Filed with: affidavit of the defendant in support of the written statement)",
  "",
  W.en.documents,
  ...W.en.docLines,
];

const FORMS: Record<FormKind, Record<Locale, (ctx: CaseContext | null, advocate: Advocate) => string[]>> = {
  PLAINT: { mr: PLAINT_MR, en: PLAINT_EN },
  WRITTEN_STATEMENT: { mr: WS_MR, en: WS_EN },
};

/** The blank form for a pleading, with the case's details filled in. */
export function draftForm(kind: FormKind, language: Locale, ctx: CaseContext | null, advocate: Advocate): string {
  return FORMS[kind][language](ctx, advocate).join("\n");
}
