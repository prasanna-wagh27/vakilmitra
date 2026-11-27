import type { Locale } from "@vakilmitra/shared";
import { ApiError } from "./api";

/**
 * The API and sign-in answer in English. In Marathi every error is shown in Marathi:
 * the exact message when we know it, else one for its code, else a general one.
 * Never English text on a Marathi screen.
 */
const MR_BY_MESSAGE: Record<string, string> = {
  "This document is already in the property's chain": "हे कागदपत्र आधीच या मालमत्तेच्या साखळीत आहे.",
  "Online payment is not set up yet": "ऑनलाइन पेमेंटची सोय अजून सुरू झालेली नाही.",
  "Razorpay is not set up": "ऑनलाइन पेमेंटची सोय अजून सुरू झालेली नाही.",
  "This field already has a value; edit it instead": "या रकान्यात आधीच मूल्य आहे; तेच बदला.",
  "This document is in a property's timeline; remove it from the timeline to change its details":
    "हे कागदपत्र मालमत्तेच्या कालक्रमात आहे; तपशील बदलण्यासाठी आधी ते कालक्रमातून काढा.",
  "Password is incorrect": "पासवर्ड चुकीचा आहे.",
  "This file is not a readable image": "ही फाइल वाचता येण्याजोगी प्रतिमा नाही.",
  "Pick a date in the future": "पुढील तारीख निवडा.",
  "There is no paid plan to cancel": "थांबवण्यासाठी कोणतीही सशुल्क योजना नाही.",
  "You already own this case": "हे प्रकरण आधीच तुमचे आहे.",
  "Payment could not be verified": "पेमेंटची पडताळणी होऊ शकली नाही.",
  "Give the record's date": "नोंदीची तारीख द्या.",
  "Read the document's details first": "आधी कागदपत्रातील तपशील वाचा.",
  "Write the opinion before approving": "मंजूर करण्यापूर्वी मत लिहा.",
  "Add pages to this document first": "आधी या कागदपत्रात पाने जोडा.",
  "Details are read from a 7/12, Ferfar or Index-II only": "तपशील फक्त ७/१२, फेरफार किंवा सूची-२ मधूनच वाचले जातात.",
  "Only a 7/12, Ferfar or Index-II can be added to the chain": "साखळीत फक्त ७/१२, फेरफार किंवा सूची-२ जोडता येते.",
  "Pages are still being read": "पाने अजून वाचली जात आहेत.",
  "Review every detail before adding it to the chain": "साखळीत जोडण्यापूर्वी प्रत्येक तपशील तपासा.",
  "Pages must be JPEG, PNG or WebP images": "पाने जेपीईजी, पीएनजी किंवा वेबपी प्रतिमा असाव्यात.",
  "This month's scanning limit for the plan is used up. Upgrade the plan to scan more.":
    "या महिन्याची स्कॅनिंग मर्यादा संपली. आणखी स्कॅन करण्यासाठी योजना वाढवा.",
  "Storage for the plan is full. Upgrade the plan for more space.": "योजनेची जागा भरली आहे. अधिक जागेसाठी योजना वाढवा.",
  "Sharing cases with juniors needs the Pro or Chamber plan.": "ज्युनियरसोबत प्रकरणे शेअर करण्यासाठी प्रो किंवा चेंबर योजना लागते.",
  "All junior seats on the plan are in use.": "योजनेतील सर्व ज्युनियर जागा भरल्या आहेत.",
  "Could not load the payment window. Check the connection and try again.": "पेमेंटची खिडकी उघडता आली नाही. इंटरनेट जोडणी तपासून पुन्हा प्रयत्न करा.",
  "Payment window unavailable": "पेमेंटची खिडकी उपलब्ध नाही.",
  "Allow AI in Settings first": "आधी सेटिंग्जमध्ये एआय वापरास परवानगी द्या.",
  "The case owner has not allowed AI for their cases": "प्रकरणाच्या मालकाने एआय वापरास परवानगी दिलेली नाही.",
  "This month's AI limit for the plan is used up. Upgrade the plan for more.": "या महिन्याची एआय मर्यादा संपली. अधिकसाठी योजना वाढवा.",
  "This page has no text to translate yet": "या पानावर भाषांतरासाठी अजून मजकूर नाही.",
  "This page has too much text to translate at once": "या पानावर एकावेळी भाषांतरासाठी खूप जास्त मजकूर आहे.",
  "The AI service did not answer. Try again in a minute.": "एआय सेवेकडून उत्तर आले नाही. एका मिनिटाने पुन्हा प्रयत्न करा.",
  "AI is not set up yet": "एआय सेवा अजून सुरू केलेली नाही.",
  "Case tracking is not switched on yet. Your diary dates still work as before.":
    "eCourts वर प्रकरणे पाहण्याची सोय अजून सुरू झालेली नाही. डायरीतील तारखा पूर्वीसारख्याच चालतात.",
  "Enter the case's CNR number (16 characters, like MHPU010012342024).": "प्रकरणाचा CNR क्रमांक द्या (१६ अक्षरी, उदा. MHPU010012342024).",
  "All case tracking places on the plan are in use. Stop tracking a closed case, or upgrade.":
    "योजनेतील eCourts वर पाहण्याच्या सर्व जागा भरल्या आहेत. संपलेल्या प्रकरणाचे पाहणे थांबवा किंवा योजना वाढवा.",
  "Checked a few minutes ago. Try again a little later.": "काही मिनिटांपूर्वीच तपासले. थोड्या वेळाने पुन्हा प्रयत्न करा.",
  "This case is not tracked": "हे प्रकरण eCourts वर पाहिले जात नाही.",
};

const MR_BY_CODE: Record<string, string> = {
  unauthenticated: "कृपया लॉग इन करा.",
  read_only: "तुमची योजना संपली आहे. काम जोडण्यासाठी किंवा बदलण्यासाठी योजना निवडा; तुमच्या फाइल्स वाचण्यासाठी व निर्यातीसाठी उपलब्ध आहेत.",
  not_found: "हे सापडले नाही.",
  bad_value: "मूल्य अपेक्षित स्वरूपात नाही.",
  invalid_input: "काही माहिती योग्य नाही. फॉर्म तपासा.",
  conflict: "हे आधीच अस्तित्वात आहे.",
  ai_off: "एआय सेवा अजून सुरू केलेली नाही.",
  tracking_unavailable: "eCourts वर प्रकरणे पाहण्याची सोय अजून सुरू झालेली नाही.",
  cnr_required: "प्रकरणाचा CNR क्रमांक द्या (१६ अक्षरी, उदा. MHPU010012342024).",
  too_soon: "काही मिनिटांपूर्वीच तपासले. थोड्या वेळाने पुन्हा प्रयत्न करा.",
  ai_failed: "एआय सेवेकडून उत्तर आले नाही. एका मिनिटाने पुन्हा प्रयत्न करा.",
  ai_consent_required: "आधी सेटिंग्जमध्ये एआय वापरास परवानगी द्या.",
  // Sign-in (Better Auth codes)
  INVALID_EMAIL_OR_PASSWORD: "ईमेल किंवा पासवर्ड चुकीचा आहे.",
  INVALID_PASSWORD: "पासवर्ड चुकीचा आहे.",
  INVALID_EMAIL: "ईमेल पत्ता योग्य नाही.",
  USER_ALREADY_EXISTS: "या ईमेलने आधीच खाते आहे. लॉग इन करा.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "या ईमेलने आधीच खाते आहे. लॉग इन करा किंवा दुसरा ईमेल वापरा.",
  PASSWORD_TOO_SHORT: "पासवर्ड किमान ८ अक्षरांचा असावा.",
  PASSWORD_TOO_LONG: "पासवर्ड खूप लांब आहे.",
  INVALID_TOKEN: "ही लिंक संपली आहे किंवा आधीच वापरली आहे.",
  TOKEN_EXPIRED: "ही लिंक संपली आहे.",
  EMAIL_ALREADY_VERIFIED: "हा ईमेल आधीच पडताळलेला आहे.",
  SESSION_EXPIRED: "सत्र संपले. पुन्हा लॉग इन करा.",
};

const MR_TOO_MANY = "खूप प्रयत्न झाले. थोड्या वेळाने पुन्हा प्रयत्न करा.";

/** The text to show for an error, in the reader's language. */
export function errorText(error: unknown, locale: Locale, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (locale === "en") return message || fallback;
  const code = error instanceof ApiError ? error.code : "";
  if (error instanceof ApiError && error.status === 429) return MR_TOO_MANY;
  return MR_BY_MESSAGE[message] ?? MR_BY_CODE[code] ?? fallback;
}

/** Sign-in errors come from the auth client as plain objects; keep their code for translation. */
export const authError = (e: { status: number; code?: string; message?: string }) =>
  new ApiError(e.status, e.code ?? "auth", e.message ?? "");
