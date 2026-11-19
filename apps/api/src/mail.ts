/**
 * Outgoing email: password resets, address checks and payment receipts.
 * Any SMTP provider works (Amazon SES, Zoho, Brevo...). Without SMTP_URL, development prints
 * the email to the log; production sends nothing and logs only that it could not.
 */
import { createTransport } from "nodemailer";
import { env, isProd } from "./env.js";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export class SmtpMailer implements Mailer {
  private transport;
  constructor(
    url: string,
    private from: string,
  ) {
    this.transport = createTransport(url);
  }
  async send(m: Mail) {
    await this.transport.sendMail({ from: this.from, to: m.to, subject: m.subject, text: m.text });
  }
}

/** No SMTP configured. Links in these emails sign people in, so they are printed only outside production. */
export class LogMailer implements Mailer {
  async send(m: Mail) {
    if (isProd) console.warn(`[mail] SMTP_URL is not set; email "${m.subject}" was not sent`);
    else console.info(`[mail] To: ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n`);
  }
}

export const createMailer = (): Mailer => (env.SMTP_URL ? new SmtpMailer(env.SMTP_URL, env.MAIL_FROM) : new LogMailer());

// ---------- Messages (Marathi first, English for advocates who chose it) ----------

type Locale = "mr" | "en";
const loc = (l: unknown): Locale => (l === "en" ? "en" : "mr");
const sign = { mr: "— वकीलमित्र", en: "— VakilMitra" };

export function resetPasswordMail(user: { email: string; name: string; locale?: unknown }, url: string): Mail {
  const l = loc(user.locale);
  return {
    to: user.email,
    subject: l === "mr" ? "वकीलमित्र: नवीन पासवर्ड सेट करा" : "VakilMitra: set a new password",
    text:
      l === "mr"
        ? `नमस्कार ${user.name},\n\nनवीन पासवर्ड सेट करण्यासाठी ही लिंक उघडा (एक तास चालेल):\n${url}\n\nहे तुम्ही मागितले नसेल तर हा ईमेल दुर्लक्षित करा; तुमचा पासवर्ड बदलणार नाही.\n\n${sign.mr}`
        : `Hello ${user.name},\n\nOpen this link to set a new password (it works for one hour):\n${url}\n\nIf you did not ask for this, ignore this email; your password stays the same.\n\n${sign.en}`,
  };
}

export function verifyEmailMail(user: { email: string; name: string; locale?: unknown }, url: string): Mail {
  const l = loc(user.locale);
  return {
    to: user.email,
    subject: l === "mr" ? "वकीलमित्र: तुमचा ईमेल पडताळा" : "VakilMitra: confirm your email",
    text:
      l === "mr"
        ? `नमस्कार ${user.name},\n\nहा ईमेल तुमचाच आहे हे पडताळण्यासाठी ही लिंक उघडा:\n${url}\n\nपासवर्ड विसरल्यास आणि पावत्यांसाठी आम्ही याच पत्त्यावर लिहू.\n\n${sign.mr}`
        : `Hello ${user.name},\n\nOpen this link to confirm this email address is yours:\n${url}\n\nWe use it for password resets and payment receipts.\n\n${sign.en}`,
  };
}

export function receiptMail(
  user: { email: string; name: string; locale?: unknown },
  inv: { number: string; planLabel: string; total: string; periodEnd: string; url: string },
): Mail {
  const l = loc(user.locale);
  return {
    to: user.email,
    subject: l === "mr" ? `वकीलमित्र: पैसे मिळाले, पावती ${inv.number}` : `VakilMitra: payment received, invoice ${inv.number}`,
    text:
      l === "mr"
        ? `नमस्कार ${user.name},\n\n${inv.planLabel} योजनेसाठी ${inv.total} (GST सह) मिळाले. योजना ${inv.periodEnd} पर्यंत चालू आहे.\n\nGST पावती पाहा किंवा प्रिंट करा:\n${inv.url}\n\n${sign.mr}`
        : `Hello ${user.name},\n\nWe received ${inv.total} (including GST) for the ${inv.planLabel} plan. Your plan runs until ${inv.periodEnd}.\n\nView or print the GST invoice:\n${inv.url}\n\n${sign.en}`,
  };
}
