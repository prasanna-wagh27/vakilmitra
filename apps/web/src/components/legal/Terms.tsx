import { Link } from "@tanstack/react-router";
import { GRACE_DAYS, TRIAL_DAYS } from "@vakilmitra/shared";
import { LEGAL } from "@/lib/legal";
import { Fill, LegalPage } from "./LegalPage";

const summary = [
  "वकीलमित्र हे वकिलांसाठी कामाचे साधन आहे; ते कायदेशीर सल्ला देत नाही. ७/१२, फेरफार वाचन आणि तपासण्या मदतीसाठी आहेत; अंतिम मत तुमचे.",
  "तुम्ही अपलोड केलेली कागदपत्रे आणि पक्षकारांची माहिती तुमचीच राहते. ती आम्ही विकत नाही, जाहिरातीसाठी वापरत नाही.",
  `${TRIAL_DAYS} दिवसांची मोफत चाचणी, नंतर मासिक किंवा वार्षिक योजना. योजना संपल्यावर ${GRACE_DAYS} दिवसांनी खाते फक्त वाचण्यासाठी राहते; माहिती हटत नाही.`,
  "पासवर्ड गोपनीय ठेवणे आणि पक्षकारांच्या माहितीसाठी आवश्यक संमती घेणे ही तुमची जबाबदारी.",
  "वाद असल्यास भारतीय कायदा लागू; न्यायक्षेत्र खाली दिलेल्या शहरातील न्यायालये.",
];

export function TermsContent() {
  return (
    <LegalPage title="Terms of Service" summary={summary}>
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
          <Link to="/pricing">Pricing</Link> page. Prices are in Indian rupees and exclude GST, which is added at 18%.
        </li>
        <li>
          Monthly plans renew automatically each month through Razorpay until you stop renewal in the app. Yearly plans are paid once per
          year and do not renew automatically.
        </li>
        <li>
          Payments are processed by Razorpay; we never see or store your card, UPI or bank details. A GST invoice is issued for every
          payment.
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
    </LegalPage>
  );
}
