/**
 * Creates a staff login for the admin panel, or resets one, and prints the password and the
 * authenticator setup once. Staff are only ever created here, on the server, never from the web.
 *
 *   pnpm --filter @vakilmitra/api admin:staff --email you@example.com --name "Your Name" --role OWNER
 *   pnpm --filter @vakilmitra/api admin:staff --email you@example.com --reset
 *   pnpm --filter @vakilmitra/api admin:staff --email you@example.com --disable
 */
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { eq, staff, staffSessions } from "@vakilmitra/db";
import { hashPassword, newTotpSecret, otpauthUri, sealSecret } from "../admin/security.js";
import { db, pool } from "../db.js";

const { values: a } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    role: { type: "string", default: "SUPPORT" },
    reset: { type: "boolean", default: false },
    disable: { type: "boolean", default: false },
  },
});

const email = a.email?.trim().toLowerCase();
if (!email?.includes("@")) {
  console.error("Pass --email");
  process.exit(1);
}
if (a.role !== "OWNER" && a.role !== "SUPPORT") {
  console.error("--role must be OWNER or SUPPORT");
  process.exit(1);
}

const existing = await db.query.staff.findFirst({ where: eq(staff.email, email) });

if (a.disable) {
  if (!existing) throw new Error("No such staff");
  await db.update(staff).set({ disabled: true }).where(eq(staff.id, existing.id));
  await db.delete(staffSessions).where(eq(staffSessions.staffId, existing.id));
  console.log(`Disabled ${email} and signed out all sessions.`);
} else {
  const password = randomBytes(15).toString("base64url");
  const secret = newTotpSecret();
  const creds = { passwordHash: hashPassword(password), totpSecret: sealSecret(secret), totpLastStep: null, disabled: false };
  if (existing) {
    if (!a.reset) {
      console.error(`${email} already exists. Use --reset to issue a new password and authenticator.`);
      process.exit(1);
    }
    await db.update(staff).set(creds).where(eq(staff.id, existing.id));
    await db.delete(staffSessions).where(eq(staffSessions.staffId, existing.id));
  } else {
    if (!a.name) {
      console.error("Pass --name for a new staff member");
      process.exit(1);
    }
    await db.insert(staff).values({ email, name: a.name, role: a.role, ...creds });
  }
  console.log(`\nStaff login for ${email}${existing ? " (reset)" : ""}`);
  console.log(`Password:          ${password}`);
  console.log(`Authenticator key: ${secret}`);
  console.log(`Or scan this URI as a QR code:\n${otpauthUri(email, secret)}\n`);
  console.log("Shown once. Store the password in a password manager.");
}
await pool.end();
