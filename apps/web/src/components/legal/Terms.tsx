import { Link } from "@tanstack/react-router";
import { GRACE_DAYS, GST_REGISTERED, TRIAL_DAYS } from "@vakilmitra/shared";
import { fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";
import { Fill, LegalPage } from "./LegalPage";

export function TermsContent() {
  const { t, locale } = useI18n();
  return <LegalPage title={t("legal.terms")}>{locale === "mr" ? <Mr /> : <En />}</LegalPage>;
}

function En() {
  return (
    <>
      <p>
        These terms are an agreement between you and <Fill v={LEGAL.operator} /> ("VakilMitra", "we", "us"), which runs the VakilMitra
        practice software at this website. By creating an account or using the service you agree to them. If you do not agree, do not use
        the service.
      </p>

      <h2>1. Who can use VakilMitra</h2>
      <p>
        VakilMitra is for advocates enrolled with a State Bar Council in India, and for juniors and staff an advocate invites to their
        cases. You must be at least 18 years old. You are responsible for everything done through your account, so keep your password
        private and tell us at once if you think someone else has used it.
      </p>

      <h2>2. What the service does, and what it does not</h2>
      <p>
        VakilMitra helps you keep your diary, cases, clients and fees, scan documents, read land records (7/12, Ferfar, Index-II), check an
        ownership chain against fixed rules, and prepare title search reports for you to edit and export.
      </p>
      <p>
        <strong>VakilMitra does not give legal advice and is not a substitute for your professional judgment.</strong> Text read from
        scanned pages can be wrong, especially on handwritten or faded records, and the rule checks can only flag what they are built to
        find. Every fact shows the page it came from so that you can check it. You are responsible for verifying facts against the original
        records and for every opinion, report or document you give a client, whether or not it was prepared with VakilMitra.
      </p>

      <h2>3. Your data and your clients' data</h2>
      <ul>
        <li>
          Everything you put into VakilMitra (case details, client details, documents, notes and reports) stays yours. You give us
          permission to store and process it only to run the service for you, as described in our <Link to="/privacy">Privacy Policy</Link>.
        </li>
        <li>
          For personal data of your clients and other people in your files, you decide why and how it is processed; we process it on your
          behalf. You are responsible for having a lawful basis, such as your client's consent or your professional duties, for putting it
          into VakilMitra.
        </li>
        <li>We do not sell your data, show advertising, or use your files to train AI models.</li>
        <li>
          You can export your work and delete a case, or your whole account, at any time from the app. Deletion removes your files; see the
          Privacy Policy for the records we must keep.
        </li>
      </ul>

      <h2>4. Trial, plans and payment</h2>
      <ul>
        <li>
          A new account gets a free trial of {TRIAL_DAYS} days with no payment details needed. After that you can choose a paid plan on the{" "}
          <Link to="/pricing">Pricing</Link> page. Prices are in Indian rupees.{" "}
          {GST_REGISTERED ? "They exclude GST, which is added at 18%." : "They are final; no GST is charged."}
        </li>
        <li>
          Monthly plans renew automatically each month through Razorpay until you stop renewal in the app. Yearly plans are paid once per
          year and do not renew automatically.
        </li>
        <li>
          Payments are processed by Razorpay; we never see or store your card, UPI or bank details.{" "}
          {GST_REGISTERED ? "A GST invoice is issued for every payment." : "A receipt is issued for every payment."}
        </li>
        <li>
          If a plan or trial ends and is not renewed, your account stays fully usable for {GRACE_DAYS} more days and then becomes read-only:
          you can still open, read and export everything, but not add new work. Choosing a plan restores full use. We do not delete your
          data because a plan ended.
        </li>
        <li>
          Each plan has the limits shown on the Pricing page (pages scanned per month, storage and junior seats). Cancellations and refunds
          are covered by our <Link to="/refunds">Cancellation and Refund Policy</Link>.
        </li>
        <li>We may change prices for future periods. We will tell you at least 30 days before a change applies to you.</li>
      </ul>

      <h2>5. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>upload material you have no right to hold, or use the service for anything unlawful;</li>
        <li>try to reach another user's data, test or break the service's security, or overload it;</li>
        <li>resell or share access to the service outside your own practice, or copy or reverse engineer the software.</li>
      </ul>
      <p>We may suspend an account that breaks these rules, after telling you why unless the law or an urgent risk prevents it.</p>

      <h2>6. Availability and changes</h2>
      <p>
        We work to keep VakilMitra available and your data safe, including encrypted storage and regular backups, but we cannot promise
        uninterrupted service. We may improve or change features; if we remove something important that you have paid for, you may cancel
        and receive a pro-rata refund for the unused period.
      </p>

      <h2>7. Liability</h2>
      <p>
        To the extent the law allows, the service is provided "as is", and our total liability to you for any claim about the service is
        limited to the fees you paid us in the 12 months before the claim. We are not liable for indirect or consequential losses, or for
        decisions made on information you did not verify against the original records. Nothing in these terms limits liability that cannot
        be limited by law.
      </p>

      <h2>8. Ending the agreement</h2>
      <p>
        You can stop using VakilMitra and delete your account at any time. We may end the agreement with 30 days' notice, or at once for a
        serious breach of these terms; in either case you will be able to export your data first unless the law prevents it.
      </p>

      <h2>9. Changes to these terms</h2>
      <p>
        If we change these terms in a way that matters, we will tell you by email or in the app at least 15 days before the change applies.
        Continuing to use the service after that means you accept the new terms.
      </p>

      <h2>10. Law and disputes</h2>
      <p>
        These terms are governed by the laws of India. Courts at <Fill v={LEGAL.courtsCity} />, Maharashtra, have exclusive jurisdiction.
        Before going to court, please write to us at <Fill v={LEGAL.supportEmail} /> so that we can try to resolve the matter within 30
        days.
      </p>

      <h2>11. Contact</h2>
      <p>
        <Fill v={LEGAL.operator} />, <Fill v={LEGAL.address} />. Email <Fill v={LEGAL.supportEmail} />, phone{" "}
        <Fill v={LEGAL.supportPhone} />. See also the <Link to="/contact">Contact</Link> page.
      </p>

      <h2>12. Language</h2>
      <p>These terms are available in English and Marathi. If the two differ in meaning, the English text prevails.</p>
    </>
  );
}

function Mr() {
  const n = (x: number) => fmtNumber(x, "mr");
  return (
    <>
      <p>
        या अटी म्हणजे तुम्ही आणि <Fill v={LEGAL.operator} /> ("वकीलमित्र", "आम्ही") यांच्यातील करार आहे. ही वेबसाइट आणि वकीलमित्र हे वकिली कामाचे सॉफ्टवेअर
        आम्ही चालवतो. खाते तयार करून किंवा सेवा वापरून तुम्ही या अटी मान्य करता. अटी मान्य नसल्यास सेवा वापरू नका.
      </p>

      <h2>१. वकीलमित्र कोण वापरू शकते</h2>
      <p>
        वकीलमित्र हे भारतातील राज्य बार कौन्सिलकडे नोंदणी असलेल्या वकिलांसाठी, आणि वकिलाने आपल्या प्रकरणांसाठी बोलावलेल्या ज्युनियर व कर्मचाऱ्यांसाठी आहे.
        वापरकर्त्याचे वय किमान {n(18)} वर्षे असावे. तुमच्या खात्यातून होणाऱ्या प्रत्येक कृतीची जबाबदारी तुमची आहे; म्हणून पासवर्ड गोपनीय ठेवा आणि दुसऱ्या कोणी खाते
        वापरल्याचा संशय आल्यास आम्हाला लगेच कळवा.
      </p>

      <h2>२. सेवा काय करते आणि काय करत नाही</h2>
      <p>
        वकीलमित्र तुम्हाला डायरी, प्रकरणे, पक्षकार आणि फी सांभाळण्यास, कागदपत्रे स्कॅन करण्यास, जमिनीच्या नोंदी (७/१२, फेरफार, सूची-२) वाचण्यास, मालकी साखळी
        ठरलेल्या नियमांनुसार तपासण्यास, आणि टायटल सर्च रिपोर्ट तयार करून तो बदलण्यास व निर्यात करण्यास मदत करते.
      </p>
      <p>
        <strong>वकीलमित्र कायदेशीर सल्ला देत नाही आणि तुमच्या व्यावसायिक निर्णयाची जागा घेत नाही.</strong> स्कॅन केलेल्या पानांवरून वाचलेला मजकूर चुकीचा असू
        शकतो, विशेषतः हस्तलिखित किंवा पुसट नोंदींवर; आणि नियमांवर आधारित तपासण्या त्यांना जे शोधण्यासाठी बनवले आहे तेवढेच दाखवू शकतात. प्रत्येक माहिती ज्या
        पानावरून घेतली ते पान दाखवले जाते, जेणेकरून तुम्ही ती तपासू शकाल. मूळ नोंदींशी माहिती पडताळणे, आणि पक्षकाराला दिलेले प्रत्येक मत, अहवाल किंवा कागदपत्र, हे
        वकीलमित्र वापरून तयार केले असो वा नसो, याची जबाबदारी तुमची आहे.
      </p>

      <h2>३. तुमची आणि तुमच्या पक्षकारांची माहिती</h2>
      <ul>
        <li>
          तुम्ही वकीलमित्रमध्ये ठेवलेली सर्व माहिती (प्रकरणे, पक्षकारांचे तपशील, कागदपत्रे, टिपा आणि अहवाल) तुमचीच राहते. फक्त तुमच्यासाठी सेवा चालवण्यासाठी ती
          साठवण्याची व हाताळण्याची परवानगी तुम्ही आम्हाला देता, जसे आमच्या <Link to="/privacy">गोपनीयता धोरणात</Link> सांगितले आहे.
        </li>
        <li>
          तुमच्या पक्षकारांच्या आणि फाइलींतील इतर व्यक्तींच्या वैयक्तिक माहितीबाबत ती का व कशी हाताळायची हे तुम्ही ठरवता; आम्ही ती तुमच्या वतीने हाताळतो. ती
          माहिती वकीलमित्रमध्ये ठेवण्यासाठी कायदेशीर आधार (उदा. पक्षकाराची संमती किंवा तुमची व्यावसायिक कर्तव्ये) असणे ही तुमची जबाबदारी आहे.
        </li>
        <li>आम्ही तुमची माहिती विकत नाही, जाहिराती दाखवत नाही, आणि तुमच्या फाइल्स एआय मॉडेल शिकवण्यासाठी वापरत नाही.</li>
        <li>
          तुम्ही कधीही तुमचे काम निर्यात करू शकता आणि एखादे प्रकरण किंवा संपूर्ण खाते ॲपमधून हटवू शकता. हटवल्यावर तुमच्या फाइल्स काढून टाकल्या जातात; कायद्यानुसार
          आम्हाला ठेवाव्या लागणाऱ्या नोंदींसाठी गोपनीयता धोरण पाहा.
        </li>
      </ul>

      <h2>४. चाचणी, योजना आणि पेमेंट</h2>
      <ul>
        <li>
          नवीन खात्याला {n(TRIAL_DAYS)} दिवसांची मोफत चाचणी मिळते; पेमेंटचे तपशील लागत नाहीत. त्यानंतर <Link to="/pricing">किंमत</Link> पानावरून सशुल्क
          योजना निवडता येते. किमती भारतीय रुपयांत आहेत.{" "}
          {GST_REGISTERED ? <>त्यात जीएसटी समाविष्ट नाही; तो {n(18)}% दराने वेगळा लागतो.</> : "त्या अंतिम आहेत; त्यावर जीएसटी लागत नाही."}
        </li>
        <li>
          मासिक योजना रेझरपेमार्फत दर महिन्याला आपोआप नूतनीकृत होतात, जोपर्यंत तुम्ही ॲपमधून नूतनीकरण थांबवत नाही. वार्षिक योजना वर्षातून एकदा भरायच्या असतात
          आणि आपोआप नूतनीकृत होत नाहीत.
        </li>
        <li>
          पेमेंट रेझरपेमार्फत होते; तुमचे कार्ड, यूपीआय किंवा बँकेचे तपशील आम्ही कधीही पाहत किंवा साठवत नाही.{" "}
          {GST_REGISTERED ? "प्रत्येक पेमेंटसाठी जीएसटी बीजक दिले जाते." : "प्रत्येक पेमेंटसाठी पावती दिली जाते."}
        </li>
        <li>
          योजना किंवा चाचणी संपल्यावर नूतनीकरण न केल्यास, खाते आणखी {n(GRACE_DAYS)} दिवस पूर्णपणे वापरता येते आणि नंतर फक्त वाचण्यासाठी राहते: सर्व काही
          उघडता, वाचता व निर्यात करता येते, पण नवीन काम जोडता येत नाही. योजना निवडल्यावर पूर्ण वापर पुन्हा सुरू होतो. योजना संपली म्हणून आम्ही तुमची माहिती
          हटवत नाही.
        </li>
        <li>
          प्रत्येक योजनेच्या मर्यादा (दरमहा स्कॅन पाने, जागा आणि ज्युनियर) किंमत पानावर दिल्या आहेत. रद्द करणे व परतावा यासाठी आमचे{" "}
          <Link to="/refunds">रद्द करणे व परतावा धोरण</Link> लागू आहे.
        </li>
        <li>पुढील कालावधीसाठी आम्ही किमती बदलू शकतो. बदल तुम्हाला लागू होण्यापूर्वी किमान {n(30)} दिवस आधी आम्ही कळवू.</li>
      </ul>

      <h2>५. योग्य वापर</h2>
      <p>तुम्ही पुढील गोष्टी करणार नाही असे मान्य करता:</p>
      <ul>
        <li>ज्या साहित्यावर तुमचा अधिकार नाही ते अपलोड करणे, किंवा सेवा कोणत्याही बेकायदेशीर कामासाठी वापरणे;</li>
        <li>दुसऱ्या वापरकर्त्याची माहिती मिळवण्याचा प्रयत्न करणे, सेवेची सुरक्षा तपासणे किंवा मोडणे, किंवा सेवेवर अवाजवी भार टाकणे;</li>
        <li>स्वतःच्या वकिली व्यवसायाबाहेर सेवा पुन्हा विकणे किंवा तिचा प्रवेश वाटणे, किंवा सॉफ्टवेअरची नक्कल करणे वा ते उलगडणे.</li>
      </ul>
      <p>हे नियम मोडणारे खाते आम्ही निलंबित करू शकतो; कायदा किंवा तातडीचा धोका आड येत नसल्यास त्याआधी कारण कळवू.</p>

      <h2>६. उपलब्धता आणि बदल</h2>
      <p>
        वकीलमित्र उपलब्ध ठेवण्यासाठी आणि तुमची माहिती सुरक्षित ठेवण्यासाठी (एनक्रिप्टेड साठवण आणि नियमित बॅकअपसह) आम्ही प्रयत्न करतो, पण सेवा कधीही खंडित
        होणार नाही याची हमी देऊ शकत नाही. आम्ही सुविधा सुधारू किंवा बदलू शकतो; तुम्ही पैसे भरलेली एखादी महत्त्वाची सुविधा आम्ही काढून टाकल्यास, तुम्ही योजना रद्द
        करून न वापरलेल्या कालावधीचा प्रमाणशीर परतावा घेऊ शकता.
      </p>

      <h2>७. जबाबदारीची मर्यादा</h2>
      <p>
        कायद्याने परवानगी दिलेल्या मर्यादेपर्यंत, सेवा "जशी आहे तशी" दिली जाते, आणि सेवेबाबतच्या कोणत्याही दाव्यासाठी आमची एकूण जबाबदारी दाव्यापूर्वीच्या {n(12)}{" "}
        महिन्यांत तुम्ही आम्हाला भरलेल्या शुल्काइतकीच मर्यादित आहे. अप्रत्यक्ष किंवा परिणामी नुकसानासाठी, किंवा मूळ नोंदींशी न पडताळलेल्या माहितीवर घेतलेल्या
        निर्णयांसाठी आम्ही जबाबदार नाही. कायद्यानुसार मर्यादित करता येत नाही अशी जबाबदारी या अटी मर्यादित करत नाहीत.
      </p>

      <h2>८. करार संपवणे</h2>
      <p>
        तुम्ही कधीही वकीलमित्र वापरणे थांबवून खाते हटवू शकता. आम्ही {n(30)} दिवसांची सूचना देऊन, किंवा या अटींचा गंभीर भंग झाल्यास तात्काळ, करार संपवू शकतो;
        दोन्ही बाबतीत, कायदा आड येत नसल्यास, तुम्हाला आधी तुमची माहिती निर्यात करता येईल.
      </p>

      <h2>९. या अटींमधील बदल</h2>
      <p>
        या अटींमध्ये महत्त्वाचा बदल केल्यास, तो लागू होण्यापूर्वी किमान {n(15)} दिवस आधी आम्ही ईमेलने किंवा ॲपमध्ये कळवू. त्यानंतरही सेवा वापरणे म्हणजे नवीन अटी
        मान्य करणे.
      </p>

      <h2>१०. कायदा आणि वाद</h2>
      <p>
        या अटींना भारतीय कायदे लागू आहेत. <Fill v={LEGAL.courtsCity} />, महाराष्ट्र येथील न्यायालयांना अनन्य अधिकारक्षेत्र आहे. न्यायालयात जाण्यापूर्वी कृपया{" "}
        <Fill v={LEGAL.supportEmail} /> वर आम्हाला लिहा, म्हणजे {n(30)} दिवसांत प्रश्न सोडवण्याचा प्रयत्न करता येईल.
      </p>

      <h2>११. संपर्क</h2>
      <p>
        <Fill v={LEGAL.operator} />, <Fill v={LEGAL.address} />. ईमेल <Fill v={LEGAL.supportEmail} />, फोन <Fill v={LEGAL.supportPhone} />.{" "}
        <Link to="/contact">संपर्क</Link> पानही पाहा.
      </p>

      <h2>१२. भाषा</h2>
      <p>या अटी मराठी आणि इंग्रजीत उपलब्ध आहेत. दोन्हींच्या अर्थात फरक आढळल्यास इंग्रजी मजकूर ग्राह्य धरला जाईल.</p>
    </>
  );
}
