import { Link } from "@tanstack/react-router";
import { GRACE_DAYS, GST_REGISTERED, TRIAL_DAYS } from "@vakilmitra/shared";
import { fmtNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";
import { Fill, LegalPage } from "./LegalPage";

export function RefundsContent() {
  const { t, locale } = useI18n();
  return <LegalPage title={t("legal.refunds")}>{locale === "mr" ? <Mr /> : <En />}</LegalPage>;
}

function En() {
  return (
    <>
      <p>
        This policy covers paid VakilMitra plans bought from <Fill v={LEGAL.operator} />. Prices and plans are on the{" "}
        <Link to="/pricing">Pricing</Link> page.
      </p>

      <h2>1. Free trial</h2>
      <p>
        Every new account starts with a free trial of {TRIAL_DAYS} days. No card or payment is needed, so there is nothing to cancel or
        refund. When the trial ends you can choose a plan; if you do not, the account becomes read-only after {GRACE_DAYS} more days and
        your data stays available to read and export.
      </p>

      <h2>2. Cancelling a monthly plan</h2>
      <ul>
        <li>
          Monthly plans renew automatically. You can stop renewal at any time in the app (Settings, Plan and billing, "Stop renewal"), or by
          writing to us.
        </li>
        <li>
          After you stop renewal, you will not be charged again and the plan stays active until the end of the month you have paid for.
        </li>
        <li>A month that has already started is not refunded, in full or in part, except as described in section 4.</li>
      </ul>

      <h2>3. Yearly plans</h2>
      <ul>
        <li>Yearly plans are paid once and do not renew automatically, so there is nothing to cancel.</li>
        <li>
          <strong>7-day refund:</strong> if you ask within 7 days of paying for a yearly plan, we refund the full amount
          {GST_REGISTERED ? ", including GST" : ""}.
        </li>
        <li>After 7 days, yearly payments are not refunded, and the plan stays active until the end of the paid year.</li>
      </ul>

      <h2>4. Charges we always refund</h2>
      <ul>
        <li>a payment taken twice for the same plan and period;</li>
        <li>a renewal charged after you had stopped renewal;</li>
        <li>a payment taken where the plan was not applied to your account and we cannot fix that promptly;</li>
        <li>
          the unused part of a paid period if we withdraw a paid feature, as set out in our <Link to="/terms">Terms of Service</Link>.
        </li>
      </ul>

      <h2>5. Changing plans</h2>
      <p>
        When you switch to a different plan or billing period, the new plan starts on the day you pay for it and runs for a full month or
        year from then. Time left on the previous plan is not carried over or refunded, so the best time to switch is near the end of a
        period. Buying the same yearly plan again adds a year after the current one ends.
      </p>

      <h2>6. How to ask for a refund</h2>
      <p>
        Email <Fill v={LEGAL.supportEmail} /> from the address on your account, with the receipt or invoice number (it starts with "VM/")
        and the reason. We reply within 2 working days. An approved refund is sent through Razorpay to the card, UPI account or bank account
        you paid from, and usually reaches you within 5 to 7 working days, depending on your bank.
        {GST_REGISTERED && " We issue a credit note against the GST invoice."}
      </p>

      <h2>7. Payment problems</h2>
      <p>
        If money left your account but the app did not confirm the payment, do not pay again: write to us with the date and amount. Most
        such payments are either confirmed within an hour or reversed automatically by your bank. If a renewal payment fails, your plan
        stays active for {GRACE_DAYS} days while you pay again.
      </p>
    </>
  );
}

function Mr() {
  const n = (x: number) => fmtNumber(x, "mr");
  return (
    <>
      <p>
        हे धोरण <Fill v={LEGAL.operator} /> यांच्याकडून घेतलेल्या वकीलमित्रच्या सशुल्क योजनांना लागू आहे. किमती आणि योजना <Link to="/pricing">किंमत</Link>{" "}
        पानावर आहेत.
      </p>

      <h2>१. मोफत चाचणी</h2>
      <p>
        प्रत्येक नवीन खाते {n(TRIAL_DAYS)} दिवसांच्या मोफत चाचणीने सुरू होते. कार्ड किंवा पेमेंट लागत नाही, त्यामुळे रद्द करण्यासारखे किंवा परत करण्यासारखे काही
        नसते. चाचणी संपल्यावर तुम्ही योजना निवडू शकता; न निवडल्यास आणखी {n(GRACE_DAYS)} दिवसांनी खाते फक्त वाचण्यासाठी राहते, आणि तुमची माहिती वाचण्यासाठी
        व निर्यात करण्यासाठी उपलब्ध राहते.
      </p>

      <h2>२. मासिक योजना रद्द करणे</h2>
      <ul>
        <li>मासिक योजना आपोआप नूतनीकृत होतात. ॲपमधून (सेटिंग्ज, प्लॅन व बिलिंग, "नूतनीकरण थांबवा") किंवा आम्हाला लिहून तुम्ही कधीही नूतनीकरण थांबवू शकता.</li>
        <li>नूतनीकरण थांबवल्यावर पुन्हा पैसे कापले जात नाहीत, आणि भरलेला महिना संपेपर्यंत योजना चालू राहते.</li>
        <li>कलम ४ मध्ये सांगितलेल्या बाबी वगळता, सुरू झालेल्या महिन्याचे पैसे पूर्ण किंवा अंशतः परत केले जात नाहीत.</li>
      </ul>

      <h2>३. वार्षिक योजना</h2>
      <ul>
        <li>वार्षिक योजना एकदाच भरायच्या असतात आणि आपोआप नूतनीकृत होत नाहीत, त्यामुळे रद्द करण्यासारखे काही नसते.</li>
        <li>
          <strong>{n(7)} दिवसांत परतावा:</strong> वार्षिक योजनेचे पैसे भरल्यापासून {n(7)} दिवसांत मागितल्यास, {GST_REGISTERED ? "जीएसटीसह " : ""}संपूर्ण
          रक्कम परत केली जाते.
        </li>
        <li>{n(7)} दिवसांनंतर वार्षिक पेमेंट परत केले जात नाही, आणि भरलेले वर्ष संपेपर्यंत योजना चालू राहते.</li>
      </ul>

      <h2>४. नेहमी परत केली जाणारी रक्कम</h2>
      <ul>
        <li>एकाच योजनेसाठी आणि कालावधीसाठी दोनदा कापलेले पैसे;</li>
        <li>तुम्ही नूतनीकरण थांबवल्यानंतर कापलेले नूतनीकरणाचे पैसे;</li>
        <li>पैसे कापले पण योजना तुमच्या खात्यावर लागू झाली नाही आणि आम्ही ते लगेच दुरुस्त करू शकलो नाही;</li>
        <li>
          आमच्या <Link to="/terms">सेवेच्या अटींनुसार</Link>, आम्ही एखादी सशुल्क सुविधा काढून टाकल्यास भरलेल्या कालावधीचा न वापरलेला भाग.
        </li>
      </ul>

      <h2>५. योजना बदलणे</h2>
      <p>
        तुम्ही दुसरी योजना किंवा दुसरा बिलिंग कालावधी निवडल्यास, नवीन योजना पैसे भरल्याच्या दिवशी सुरू होते आणि तेव्हापासून पूर्ण महिना किंवा वर्ष चालते. आधीच्या
        योजनेचा उरलेला काळ पुढे नेला जात नाही किंवा परत केला जात नाही; म्हणून कालावधी संपत आल्यावर योजना बदलणे चांगले. तीच वार्षिक योजना पुन्हा घेतल्यास, चालू
        वर्ष संपल्यानंतर आणखी एक वर्ष जोडले जाते.
      </p>

      <h2>६. परतावा कसा मागावा</h2>
      <p>
        खात्यावरील ईमेल पत्त्यावरून <Fill v={LEGAL.supportEmail} /> वर पावती किंवा बीजक क्रमांक (तो वरच्या भागात छापलेला असतो) आणि कारण लिहून पाठवा.
        आम्ही {n(2)} कामकाजाच्या दिवसांत उत्तर देतो. मंजूर परतावा रेझरपेमार्फत तुम्ही ज्या कार्ड, यूपीआय खाते किंवा बँक खात्यातून पैसे भरले त्यावर पाठवला जातो, आणि
        तुमच्या बँकेनुसार साधारण {n(5)} ते {n(7)} कामकाजाच्या दिवसांत जमा होतो.
        {GST_REGISTERED && " जीएसटी बीजकावर आम्ही जमा टीप (क्रेडिट नोट) देतो."}
      </p>

      <h2>७. पेमेंटमधील अडचणी</h2>
      <p>
        तुमच्या खात्यातून पैसे गेले पण ॲपने पेमेंटची खात्री दाखवली नाही, तर पुन्हा पैसे भरू नका: तारीख आणि रक्कम लिहून आम्हाला कळवा. असे बहुतेक पेमेंट तासाभरात निश्चित
        होतात किंवा बँक आपोआप परत करते. नूतनीकरणाचे पेमेंट अयशस्वी झाल्यास, तुम्ही पुन्हा पैसे भरेपर्यंत योजना {n(GRACE_DAYS)} दिवस चालू राहते.
      </p>
    </>
  );
}
