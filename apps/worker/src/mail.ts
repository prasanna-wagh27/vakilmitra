/**
 * Outgoing email from the worker (the evening court email). Same settings as the API:
 * SMTP_URL and MAIL_FROM. Without SMTP_URL the email is printed to the log outside
 * production, and skipped with a warning in production.
 */
import { createTransport } from "nodemailer";

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

export interface Mailer {
  send(mail: Mail): Promise<void>;
}

export function createMailer(
  env: { SMTP_URL?: string; MAIL_FROM: string; NODE_ENV: string },
  log: { info: (o: object, m: string) => void; warn: (m: string) => void },
): Mailer {
  if (env.SMTP_URL) {
    const transport = createTransport(env.SMTP_URL);
    return { send: async (m) => void (await transport.sendMail({ from: env.MAIL_FROM, ...m })) };
  }
  return {
    async send(m) {
      if (env.NODE_ENV === "production") log.warn(`SMTP_URL is not set; email "${m.subject}" was not sent`);
      else log.info({ to: m.to, subject: m.subject, text: m.text }, "email (not sent: no SMTP_URL)");
    },
  };
}
