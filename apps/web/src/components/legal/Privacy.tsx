import { Link } from "@tanstack/react-router";
import { GST_REGISTERED } from "@vakilmitra/shared";
import { fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";
import { Fill, LegalPage } from "./LegalPage";

export function PrivacyContent() {
  const { t, locale } = useI18n();
  return <LegalPage title={t("legal.privacy")}>{locale === "mr" ? <Mr /> : <En />}</LegalPage>;
}

function En() {
  return (
    <>
      <p>
        This policy explains what personal data VakilMitra collects, why, and what control you have over it. It is our notice under the
        Digital Personal Data Protection Act, 2023 and the rules made under it. VakilMitra is run by <Fill v={LEGAL.operator} />,{" "}
        <Fill v={LEGAL.address} /> ("we", "us").
      </p>

      <h2>1. Two kinds of data, two roles</h2>
      <ul>
        <li>
          <strong>Your account data.</strong> We decide how this is used, so for it we are the Data Fiduciary.
        </li>
        <li>
          <strong>Data in your files</strong>: your clients' names and contact details, parties, land records, court papers, notes and
          reports. You decide what goes in and why; we process it only on your instructions, to run the service for you. For this data you
          are the Data Fiduciary and we are your Data Processor. Requests from your clients about their data should go to you; we will help
          you answer them.
        </li>
      </ul>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          Account: name, email address, password (stored only as a secure hash), and optionally phone and Bar Council enrolment number.
        </li>
        <li>Preferences: language and whether you allow cloud OCR.</li>
        <li>
          Billing: plan, payment dates and amounts, billing name{GST_REGISTERED ? ", GSTIN" : ""} and state, and the receipts and invoices
          we issue. Card, UPI and bank details go directly to Razorpay and never reach us.
        </li>
        <li>
          Your files: what you enter or scan, as described above. Photos are re-encoded on upload, which removes location and camera
          details.
        </li>
        <li>
          Security records: sign-in sessions (device and IP address), and an activity log of every action in your account: who opened,
          searched, added, changed, shared, exported or deleted each case and file, and every sign-in, with the time, IP address and device.
          The log never contains the content of your files. We keep these to protect your account and to show you, under Settings, Activity
          log, who accessed your files.
        </li>
      </ul>

      <h2>3. Why we use it</h2>
      <ul>
        <li>to give you the service you signed up for, including reading your scanned pages and building reports;</li>
        <li>to sign you in, keep your account secure and prevent misuse;</li>
        <li>to take payments, issue receipts and invoices, and keep the accounts that tax law requires;</li>
        <li>to send emails about your account: password resets, address confirmation, payment receipts and important service notices.</li>
      </ul>
      <p>
        We do not sell personal data, show advertising, build marketing profiles, or use your files to train AI models. We will ask for your
        consent before using your data for any other purpose.
      </p>

      <h2>4. Where it is stored and how it is protected</h2>
      <p>
        Your data is stored on servers in India. Every file is encrypted at rest with its own key (AES-256-GCM). Connections are encrypted
        (HTTPS), passwords are hashed, and access is limited to what each person needs: a junior sees only the cases shared with them. Our
        support staff can see account and plan details and usage counts, but not the contents of your cases or files.
      </p>

      <h2>5. Who else processes it</h2>
      <p>We use a small number of service providers, each only for the task below and bound to protect the data:</p>
      <ul>
        <li>cloud hosting and storage in India, to run the service and keep your files;</li>
        <li>Razorpay, to take payments;</li>
        <li>an email delivery provider, to send account emails;</li>
        <li>
          cloud OCR (Sarvam AI, in India; Google Cloud Vertex AI, Mumbai region), <strong>only if you turn on</strong> "Read hard pages with
          cloud OCR" in Settings. It is off by default. When on, only pages our own reader finds hard to read are sent, each one is recorded
          in your access log, and you can turn it off at any time.
        </li>
      </ul>
      <p>We may also disclose data where Indian law requires it, for example on a lawful order of a court or authority.</p>

      <h2>6. Cookies</h2>
      <p>
        We use one cookie, to keep you signed in. There are no advertising or tracking cookies, and fonts are served from our own servers,
        so opening VakilMitra does not share your visit with other companies.
      </p>

      <h2>7. How long we keep it</h2>
      <ul>
        <li>
          Your account and files: for as long as you keep your account. If your plan ends, they stay readable and exportable; we do not
          delete them for that reason.
        </li>
        <li>
          When you delete a case or your account, its records and files are deleted at once. Backup copies are overwritten within 30 days.
          We keep an anonymous record that a deletion happened.
        </li>
        <li>The activity log: for 1 year from each entry, then deleted automatically.</li>
        <li>Receipts, invoices and payment records: for 8 years, as required by tax law, even after the account is deleted.</li>
      </ul>

      <h2>8. Your rights</h2>
      <p>Under the DPDP Act you can:</p>
      <ul>
        <li>get a summary of your personal data and how it is processed;</li>
        <li>correct or update it (most of it directly in Settings);</li>
        <li>have it erased: Settings, "Delete account", removes everything except the records the law requires us to keep;</li>
        <li>withdraw a consent you gave (such as cloud OCR) as easily as you gave it;</li>
        <li>nominate a person to exercise these rights if you die or become unable to;</li>
        <li>complain to us, and then to the Data Protection Board of India.</li>
      </ul>
      <p>
        Write to our Grievance Officer, <Fill v={LEGAL.grievanceOfficer} />, at <Fill v={LEGAL.grievanceEmail} />. We will acknowledge your
        request within 7 days and answer within 30 days at the latest.
      </p>

      <h2>9. Data breaches</h2>
      <p>
        If a breach affects your personal data, we will tell you without delay what happened, what it means for you and what we are doing,
        and report it to the Data Protection Board as the law requires.
      </p>

      <h2>10. Children</h2>
      <p>VakilMitra is for advocates and their staff, and is not meant for anyone under 18.</p>

      <h2>11. Changes and language</h2>
      <p>
        If we change this policy in a way that matters, we will tell you by email or in the app before the change applies. The date at the
        top shows the latest version. This policy is available in English and Marathi; if the two differ in meaning, the English text
        prevails. See also our <Link to="/terms">Terms of Service</Link>.
      </p>
    </>
  );
}

function Mr() {
  const n = (x: number) => fmtNumber(x, "mr");
  return (
    <>
      <p>
        वकीलमित्र कोणती वैयक्तिक माहिती घेते, कशासाठी, आणि त्यावर तुमचे काय नियंत्रण आहे, हे या धोरणात सांगितले आहे. डिजिटल वैयक्तिक डेटा संरक्षण अधिनियम, २०२३
        आणि त्याखालील नियमांनुसार ही आमची सूचना आहे. वकीलमित्र <Fill v={LEGAL.operator} />, <Fill v={LEGAL.address} /> ("आम्ही") चालवतात.
      </p>

      <h2>१. दोन प्रकारची माहिती, दोन भूमिका</h2>
      <ul>
        <li>
          <strong>तुमच्या खात्याची माहिती.</strong> ती कशी वापरायची हे आम्ही ठरवतो, म्हणून या माहितीसाठी आम्ही "डेटा विश्वस्त" आहोत.
        </li>
        <li>
          <strong>तुमच्या फाइलींतील माहिती</strong>: तुमच्या पक्षकारांची नावे व संपर्क तपशील, पक्ष, जमिनीच्या नोंदी, न्यायालयीन कागदपत्रे, टिपा आणि अहवाल.
          त्यात काय ठेवायचे आणि का, हे तुम्ही ठरवता; आम्ही ती फक्त तुमच्या सूचनेनुसार, तुमच्यासाठी सेवा चालवण्यासाठी हाताळतो. या माहितीसाठी तुम्ही "डेटा विश्वस्त"
          आहात आणि आम्ही तुमचे "डेटा प्रक्रियाकर्ता" आहोत. तुमच्या पक्षकारांनी त्यांच्या माहितीबद्दल केलेल्या विनंत्या तुमच्याकडे याव्यात; त्यांना उत्तर देण्यात आम्ही
          तुम्हाला मदत करू.
        </li>
      </ul>

      <h2>२. आम्ही कोणती माहिती घेतो</h2>
      <ul>
        <li>खाते: नाव, ईमेल पत्ता, पासवर्ड (फक्त सुरक्षित हॅश स्वरूपात साठवला जातो), आणि ऐच्छिकपणे फोन व बार कौन्सिल नोंदणी क्रमांक.</li>
        <li>पसंती: भाषा, आणि क्लाउड ओसीआर वापरण्याची परवानगी दिली आहे का.</li>
        <li>
          बिलिंग: योजना, पेमेंटच्या तारखा व रकमा, बिलावरील नाव{GST_REGISTERED ? ", जीएसटीआयएन" : ""} व राज्य, आणि आम्ही दिलेल्या पावत्या व बीजके. कार्ड,
          यूपीआय आणि बँकेचे तपशील थेट रेझरपेकडे जातात; ते आमच्यापर्यंत कधीही पोहोचत नाहीत.
        </li>
        <li>
          तुमच्या फाइल्स: वर सांगितल्याप्रमाणे तुम्ही भरलेली किंवा स्कॅन केलेली माहिती. अपलोड करताना फोटो पुन्हा तयार केले जातात, त्यामुळे त्यातील ठिकाण आणि कॅमेऱ्याचे
          तपशील निघून जातात.
        </li>
        <li>
          सुरक्षा नोंदी: लॉग इन सत्रे (डिव्हाइस आणि आयपी पत्ता), आणि तुमच्या खात्यातील प्रत्येक कृतीची हालचाल नोंद: प्रत्येक प्रकरण व फाइल कोणी उघडली, शोधली,
          जोडली, बदलली, शेअर केली, निर्यात केली किंवा हटवली, आणि प्रत्येक लॉग इन, वेळ, आयपी पत्ता व डिव्हाइससह. या नोंदीत तुमच्या फाइल्समधील मजकूर कधीही
          नसतो. तुमचे खाते सुरक्षित ठेवण्यासाठी आणि सेटिंग्ज, हालचालींची नोंद येथे तुमच्या फाइल्स कोणी पाहिल्या हे तुम्हाला दाखवण्यासाठी आम्ही या नोंदी ठेवतो.
        </li>
      </ul>

      <h2>३. आम्ही ती कशासाठी वापरतो</h2>
      <ul>
        <li>तुम्ही घेतलेली सेवा देण्यासाठी, यात तुमची स्कॅन केलेली पाने वाचणे आणि अहवाल तयार करणे समाविष्ट;</li>
        <li>तुम्हाला लॉग इन करू देण्यासाठी, खाते सुरक्षित ठेवण्यासाठी आणि गैरवापर टाळण्यासाठी;</li>
        <li>पेमेंट घेण्यासाठी, पावत्या व बीजके देण्यासाठी आणि कर कायद्याने आवश्यक हिशोब ठेवण्यासाठी;</li>
        <li>खात्याबद्दल ईमेल पाठवण्यासाठी: पासवर्ड बदलणे, ईमेल पडताळणी, पेमेंटच्या पावत्या आणि सेवेबद्दलच्या महत्त्वाच्या सूचना.</li>
      </ul>
      <p>
        आम्ही वैयक्तिक माहिती विकत नाही, जाहिराती दाखवत नाही, विपणनासाठी प्रोफाइल बनवत नाही, आणि तुमच्या फाइल्स एआय मॉडेल शिकवण्यासाठी वापरत नाही.
        इतर कोणत्याही कारणासाठी माहिती वापरण्यापूर्वी आम्ही तुमची संमती घेऊ.
      </p>

      <h2>४. माहिती कुठे साठवली जाते आणि कशी सुरक्षित ठेवली जाते</h2>
      <p>
        तुमची माहिती भारतातील सर्व्हरवर साठवली जाते. प्रत्येक फाइल स्वतःच्या स्वतंत्र किल्लीने एनक्रिप्ट करून साठवली जाते. सर्व जोडण्या एनक्रिप्टेड असतात, पासवर्ड
        हॅश स्वरूपात ठेवले जातात, आणि प्रत्येकाला फक्त आवश्यक तेवढाच प्रवेश असतो: ज्युनियरला फक्त त्याच्याशी शेअर केलेली प्रकरणे दिसतात. आमच्या मदत कर्मचाऱ्यांना खाते व
        योजनेचे तपशील आणि वापराचे आकडे दिसतात, पण तुमच्या प्रकरणांतील किंवा फाइलींतील मजकूर दिसत नाही.
      </p>

      <h2>५. माहिती आणखी कोण हाताळते</h2>
      <p>आम्ही मोजक्या सेवा पुरवठादारांचा वापर करतो; प्रत्येकजण फक्त खाली दिलेल्या कामासाठी, आणि माहिती सुरक्षित ठेवण्याच्या बंधनासह:</p>
      <ul>
        <li>सेवा चालवण्यासाठी आणि तुमच्या फाइल्स ठेवण्यासाठी भारतातील क्लाउड होस्टिंग व साठवण;</li>
        <li>पेमेंट घेण्यासाठी रेझरपे;</li>
        <li>खात्याचे ईमेल पाठवण्यासाठी ईमेल वितरण सेवा;</li>
        <li>
          क्लाउड ओसीआर (सर्वम एआय, भारतात; गूगल क्लाउड व्हर्टेक्स एआय, मुंबई विभाग), <strong>फक्त तुम्ही</strong> सेटिंग्जमध्ये "कठीण पाने क्लाउड ओसीआर ने वाचा"{" "}
          <strong>चालू केल्यास</strong>. हे मूलतः बंद असते. चालू केल्यावर, आमच्या स्वतःच्या वाचकाला कठीण वाटलेलीच पाने पाठवली जातात, प्रत्येक पान तुमच्या प्रवेश
          नोंदीत नोंदवले जाते, आणि तुम्ही ते कधीही बंद करू शकता.
        </li>
      </ul>
      <p>भारतीय कायद्याने आवश्यक असल्यास, उदा. न्यायालय किंवा प्राधिकरणाच्या कायदेशीर आदेशावर, आम्ही माहिती उघड करू शकतो.</p>

      <h2>६. कुकीज</h2>
      <p>
        तुम्हाला लॉग इन ठेवण्यासाठी आम्ही एकच कुकी वापरतो. जाहिरात किंवा मागोवा घेणाऱ्या कुकीज नाहीत, आणि फॉन्ट आमच्याच सर्व्हरवरून येतात, त्यामुळे वकीलमित्र
        उघडल्याची माहिती इतर कंपन्यांना जात नाही.
      </p>

      <h2>७. माहिती किती काळ ठेवली जाते</h2>
      <ul>
        <li>तुमचे खाते आणि फाइल्स: तुमचे खाते असेपर्यंत. योजना संपली तरी त्या वाचता व निर्यात करता येतात; केवळ त्या कारणाने आम्ही त्या हटवत नाही.</li>
        <li>
          तुम्ही एखादे प्रकरण किंवा खाते हटवल्यास, त्याच्या नोंदी आणि फाइल्स लगेच हटवल्या जातात. बॅकअपमधील प्रती {n(30)} दिवसांत पुसल्या जातात. हटवणे झाले याची
          नाव नसलेली नोंद आम्ही ठेवतो.
        </li>
        <li>हालचालींची नोंद: प्रत्येक नोंद {n(1)} वर्ष ठेवली जाते, त्यानंतर आपोआप हटवली जाते.</li>
        <li>पावत्या, बीजके आणि पेमेंटच्या नोंदी: कर कायद्यानुसार {n(8)} वर्षे, खाते हटवल्यानंतरही.</li>
      </ul>

      <h2>८. तुमचे हक्क</h2>
      <p>डिजिटल वैयक्तिक डेटा संरक्षण अधिनियमानुसार तुम्ही:</p>
      <ul>
        <li>तुमच्या वैयक्तिक माहितीचा आणि ती कशी हाताळली जाते याचा सारांश मागू शकता;</li>
        <li>ती दुरुस्त किंवा अद्ययावत करू शकता (बहुतेक थेट सेटिंग्जमध्ये);</li>
        <li>ती हटवू शकता: सेटिंग्जमधील "खाते हटवा" कायद्याने ठेवाव्या लागणाऱ्या नोंदी सोडून सर्व काही काढून टाकते;</li>
        <li>दिलेली संमती (उदा. क्लाउड ओसीआर) दिली तितक्याच सहजपणे मागे घेऊ शकता;</li>
        <li>तुमचा मृत्यू झाल्यास किंवा तुम्ही असमर्थ झाल्यास हे हक्क वापरण्यासाठी एखाद्या व्यक्तीला नामनिर्देशित करू शकता;</li>
        <li>आमच्याकडे, आणि त्यानंतर भारतीय डेटा संरक्षण मंडळाकडे तक्रार करू शकता.</li>
      </ul>
      <p>
        आमचे तक्रार निवारण अधिकारी <Fill v={LEGAL.grievanceOfficer} /> यांना <Fill v={LEGAL.grievanceEmail} /> वर लिहा. आम्ही {n(7)} दिवसांत
        विनंती मिळाल्याचे कळवू आणि जास्तीत जास्त {n(30)} दिवसांत उत्तर देऊ.
      </p>

      <h2>९. माहितीची सुरक्षा भंग</h2>
      <p>
        सुरक्षा भंगाचा तुमच्या वैयक्तिक माहितीवर परिणाम झाल्यास, काय घडले, त्याचा तुमच्यासाठी अर्थ काय आणि आम्ही काय करत आहोत हे आम्ही विलंब न करता तुम्हाला
        कळवू, आणि कायद्यानुसार डेटा संरक्षण मंडळाला कळवू.
      </p>

      <h2>१०. मुले</h2>
      <p>वकीलमित्र वकील आणि त्यांच्या कर्मचाऱ्यांसाठी आहे; {n(18)} वर्षांखालील कोणासाठीही नाही.</p>

      <h2>११. बदल आणि भाषा</h2>
      <p>
        या धोरणात महत्त्वाचा बदल केल्यास, तो लागू होण्यापूर्वी आम्ही ईमेलने किंवा ॲपमध्ये कळवू. वरील तारीख नवीनतम आवृत्ती दाखवते. हे धोरण मराठी आणि इंग्रजीत
        उपलब्ध आहे; दोन्हींच्या अर्थात फरक आढळल्यास इंग्रजी मजकूर ग्राह्य धरला जाईल. आमच्या <Link to="/terms">सेवेच्या अटी</Link>ही पाहा.
      </p>
    </>
  );
}
