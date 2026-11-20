import { Link } from "@tanstack/react-router";
import { LEGAL } from "@/lib/legal";
import { Fill, LegalPage } from "./LegalPage";

const summary = [
  "वकीलमित्र ही ऑनलाइन सेवा आहे; कोणतीही वस्तू पाठवली जात नाही.",
  "पैसे भरताच योजना तुमच्या खात्यावर लगेच लागू होते आणि GST पावती ईमेलवर येते.",
  "योजना लागू न झाल्यास आम्हाला लिहा; आम्ही एका कामकाजाच्या दिवसात सोडवू.",
];

export function DeliveryContent() {
  return (
    <LegalPage title="Shipping and Delivery Policy" summary={summary}>
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
    </LegalPage>
  );
}
