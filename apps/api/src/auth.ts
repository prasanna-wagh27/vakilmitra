import { accessLogs, accounts, advocates, sessions, subscriptions, verifications } from "@vakilmitra/db";
import { TRIAL_DAYS } from "@vakilmitra/shared";
import { keys } from "@vakilmitra/storage";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db.js";
import { env, isProd } from "./env.js";
import { currentAudit } from "./lib/audit.js";
import { type Mail, resetPasswordMail, verifyEmailMail } from "./mail.js";
import { getServices, mailer } from "./services.js";

/**
 * Better Auth runs inside our own Postgres. An advocate is Better Auth's "user".
 * Email + password for now; phone OTP (MSG91) and chamber orgs plug in here later.
 */
export const auth = betterAuth({
  baseURL: env.API_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_ORIGIN],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: advocates, session: sessions, account: accounts, verification: verifications },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 200,
    resetPasswordTokenExpiresIn: 60 * 60,
    // A reset signs out every device, in case the old password was known to someone else.
    revokeSessionsOnPasswordReset: true,
    // Not awaited, so the answer takes the same time whether or not the account exists.
    sendResetPassword: async ({ user, url }) => {
      void send(resetPasswordMail(user, url));
    },
    // Attribute the audit entry for the reset to the account.
    onPasswordReset: async ({ user }) => {
      const a = currentAudit();
      if (a) a.advocateId = user.id;
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      // Land back in the app, not on the API: sign-up sends a relative "/" that would resolve against the API.
      const u = new URL(url);
      if (!u.searchParams.get("callbackURL")?.startsWith(`${env.WEB_ORIGIN}/`))
        u.searchParams.set("callbackURL", `${env.WEB_ORIGIN}/settings?verified=1`);
      void send(verifyEmailMail(user, u.toString()));
    },
    afterEmailVerification: async (user) => {
      const a = currentAudit();
      if (a) a.advocateId = user.id;
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  user: {
    additionalFields: {
      phone: { type: "string", required: false },
      barCouncilNo: { type: "string", required: false },
      locale: { type: "string", required: false, defaultValue: "mr" },
    },
    deleteUser: {
      enabled: true,
      // Keep an anonymised record that the account was deleted (DPDP audit trail).
      beforeDelete: async (user) => {
        await db
          .insert(accessLogs)
          .values({ advocateId: null, actor: "system", action: "account.delete", entityType: "advocate", entityId: user.id });
      },
      // Files go only after the rows are gone: if the delete fails, the account keeps its pages.
      // If this step fails, what remains is unreadable ciphertext, never a record pointing at nothing.
      afterDelete: async (user) => {
        await getServices().storage.deletePrefix(keys.advocate(user.id));
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        // The free trial starts at sign-up.
        after: async (user) => {
          await db
            .insert(subscriptions)
            .values({ advocateId: user.id, trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000) })
            .onConflictDoNothing();
        },
      },
    },
  },
  rateLimit: {
    enabled: env.NODE_ENV !== "test",
    window: 60,
    max: 30,
    // Each of these sends an email: a few per address-holder is plenty.
    customRules: {
      "/request-password-reset": { window: 15 * 60, max: 3 },
      "/send-verification-email": { window: 15 * 60, max: 3 },
    },
  },
  advanced: { useSecureCookies: isProd },
});

const send = (m: Mail) =>
  mailer()
    .send(m)
    .catch((err) => console.error("[mail] failed:", (err as Error).message));

export type Session = typeof auth.$Infer.Session;
