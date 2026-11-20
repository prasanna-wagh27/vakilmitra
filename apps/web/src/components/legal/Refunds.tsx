import { Link } from "@tanstack/react-router";
import { GRACE_DAYS, TRIAL_DAYS } from "@vakilmitra/shared";
import { LEGAL } from "@/lib/legal";
import { Fill, LegalPage } from "./LegalPage";

const summary = [
  `${TRIAL_DAYS} दिवसांची चाचणी मोफत; कार्ड किंवा पैसे लागत नाहीत.`,
  "मासिक योजना: ॲपमधून कधीही नूतनीकरण थांबवा; भरलेला महिना संपेपर्यंत योजना चालू राहते. सुरू झालेल्या महिन्याचे पैसे परत मिळत नाहीत.",
  "वार्षिक योजना: पैसे भरल्यापासून ७ दिवसांत मागितल्यास पूर्ण परतावा (GST सह).",
  "दोनदा कापलेले किंवा चुकीने कापलेले पैसे पूर्ण परत.",
  "मंजूर परतावा ५ ते ७ कामकाजाच्या दिवसांत मूळ पेमेंट पद्धतीवर जमा होतो.",
];

export function RefundsContent() {
  return (
    <LegalPage title="Cancellation and Refund Policy" summary={summary}>
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
          <strong>7-day refund:</strong> if you ask within 7 days of paying for a yearly plan, we refund the full amount, including GST.
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
        Email <Fill v={LEGAL.supportEmail} /> from the address on your account, with the invoice number (it starts with "VM/") and the
        reason. We reply within 2 working days. An approved refund is sent through Razorpay to the card, UPI account or bank account you
        paid from, and usually reaches you within 5 to 7 working days, depending on your bank. We issue a credit note against the GST
        invoice.
      </p>

      <h2>7. Payment problems</h2>
      <p>
        If money left your account but the app did not confirm the payment, do not pay again: write to us with the date and amount. Most
        such payments are either confirmed within an hour or reversed automatically by your bank. If a renewal payment fails, your plan
        stays active for {GRACE_DAYS} days while you pay again.
      </p>
    </LegalPage>
  );
}
