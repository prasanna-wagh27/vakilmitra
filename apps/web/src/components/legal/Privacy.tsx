import { Link } from "@tanstack/react-router";
import { LEGAL } from "@/lib/legal";
import { Fill, LegalPage } from "./LegalPage";

const summary = [
  "आम्ही फक्त खाते चालवण्यासाठी लागणारी माहिती घेतो: नाव, ईमेल, फोन, बार कौन्सिल क्रमांक आणि तुम्ही टाकलेली प्रकरणांची माहिती व कागदपत्रे.",
  "सर्व फाईल्स एनक्रिप्ट करून भारतातील सर्व्हरवर ठेवल्या जातात. माहिती विकली जात नाही, जाहिराती नाहीत, ट्रॅकिंग कुकीज नाहीत.",
  "कठीण पाने क्लाउड OCR कडे पाठवणे बंद असते; तुम्ही सेटिंग्जमध्ये चालू केले तरच पाठवली जातात.",
  "तुमच्या पक्षकारांच्या माहितीबाबत निर्णय तुमचा; आम्ही ती फक्त तुमच्या वतीने हाताळतो.",
  "माहिती पाहणे, दुरुस्त करणे, हटवणे किंवा तक्रार करणे हा तुमचा हक्क आहे. संपूर्ण खाते ॲपमधून एका बटणाने हटवता येते.",
];

export function PrivacyContent() {
  return (
    <LegalPage title="Privacy Policy" summary={summary}>
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
          Billing: plan, payment dates and amounts, billing name, GSTIN and state, and the invoices we issue. Card, UPI and bank details go
          directly to Razorpay and never reach us.
        </li>
        <li>
          Your files: what you enter or scan, as described above. Photos are re-encoded on upload, which removes location and camera
          details.
        </li>
        <li>
          Security records: sign-in sessions (device and IP address), and a log of who opened, shared or deleted each case. We keep these to
          protect your account and to show you who accessed your files.
        </li>
      </ul>

      <h2>3. Why we use it</h2>
      <ul>
        <li>to give you the service you signed up for, including reading your scanned pages and building reports;</li>
        <li>to sign you in, keep your account secure and prevent misuse;</li>
        <li>to take payments, issue GST invoices and keep the accounts that tax law requires;</li>
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
        <li>Invoices and payment records: for 8 years, as required by tax law, even after the account is deleted.</li>
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

      <h2>11. Changes</h2>
      <p>
        If we change this policy in a way that matters, we will tell you by email or in the app before the change applies. The date at the
        top shows the latest version. See also our <Link to="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  );
}
