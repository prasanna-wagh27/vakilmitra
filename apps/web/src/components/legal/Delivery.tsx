import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n";
import { LEGAL } from "@/lib/legal";
import { Fill, LegalPage } from "./LegalPage";

export function DeliveryContent() {
  const { t, locale } = useI18n();
  return <LegalPage title={t("legal.delivery")}>{locale === "mr" ? <Mr /> : <En />}</LegalPage>;
}

function En() {
  return (
    <>
      <p>
        VakilMitra is online software, used in a web browser. <Fill v={LEGAL.operator} /> does not sell or ship physical goods, so no
        shipping charges apply and nothing is delivered to an address.
      </p>
      <h2>How a plan is delivered</h2>
      <ul>
        <li>Your account is ready as soon as you sign up, with a free trial.</li>
        <li>
          When you pay for a plan, it is applied to your account immediately, usually within a few seconds, and you can see it under
          Settings, Plan and billing.
        </li>
        <li>
          A receipt with a link to the GST invoice is emailed to the address on your account. Invoices can also be viewed and printed in the
          app at any time.
        </li>
      </ul>
      <h2>If something goes wrong</h2>
      <p>
        If your payment went through but the plan is not shown on your account within an hour, write to <Fill v={LEGAL.supportEmail} /> with
        the payment date and amount. We will apply the plan or refund the payment within one working day. See also our{" "}
        <Link to="/refunds">Cancellation and Refund Policy</Link>.
      </p>
    </>
  );
}

function Mr() {
  return (
    <>
      <p>
        वकीलमित्र हे वेब ब्राउझरमध्ये वापरायचे ऑनलाइन सॉफ्टवेअर आहे. <Fill v={LEGAL.operator} /> कोणतीही वस्तू विकत किंवा पाठवत नाहीत, त्यामुळे पाठवण्याचा
        खर्च लागत नाही आणि कोणत्याही पत्त्यावर काहीही पाठवले जात नाही.
      </p>
      <h2>योजना कशी मिळते</h2>
      <ul>
        <li>नोंदणी करताच मोफत चाचणीसह तुमचे खाते तयार होते.</li>
        <li>योजनेचे पैसे भरताच ती तुमच्या खात्यावर लगेच, साधारण काही सेकंदांत, लागू होते आणि सेटिंग्ज, प्लॅन व बिलिंग येथे दिसते.</li>
        <li>जीएसटी बीजकाच्या लिंकसह पावती तुमच्या खात्यावरील ईमेल पत्त्यावर पाठवली जाते. बीजके ॲपमध्येही कधीही पाहता व प्रिंट करता येतात.</li>
      </ul>
      <h2>काही अडचण आल्यास</h2>
      <p>
        पैसे गेले पण तासाभरात योजना खात्यावर दिसली नाही, तर पेमेंटची तारीख आणि रक्कम लिहून <Fill v={LEGAL.supportEmail} /> वर कळवा. आम्ही एका
        कामकाजाच्या दिवसात योजना लागू करू किंवा पैसे परत करू. आमचे <Link to="/refunds">रद्द करणे व परतावा धोरण</Link> ही पाहा.
      </p>
    </>
  );
}
