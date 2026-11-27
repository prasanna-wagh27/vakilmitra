import { accessLogs, advocates, and, eq } from "@vakilmitra/db";
import { updateProfileInput } from "@vakilmitra/shared";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyRequest } from "fastify";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { auth } from "../auth.js";
import { db } from "../db.js";
import { HttpError } from "../lib/http.js";

const profile = {
  id: true,
  name: true,
  email: true,
  emailVerified: true,
  phone: true,
  barCouncilNo: true,
  locale: true,
  cloudOcrConsent: true,
  cloudOcrConsentAt: true,
  aiConsent: true,
  aiConsentAt: true,
  dailyDigest: true,
  createdAt: true,
} as const;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const logConsent = (tx: Tx, req: FastifyRequest, action: string) =>
  tx.insert(accessLogs).values({ advocateId: req.advocateId, action, entityType: "advocate", entityId: req.advocateId, ip: req.ip });

export const accountRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", async (req) => {
    const advocate = await db.query.advocates.findFirst({ where: eq(advocates.id, req.advocateId), columns: profile });
    if (!advocate) throw new HttpError(401, "unauthenticated", "Please sign in");
    return { advocate };
  });

  app.patch("/", { schema: { body: updateProfileInput } }, async (req) => {
    const { cloudOcrConsent, aiConsent, ...rest } = req.body;
    await db.transaction(async (tx) => {
      if (Object.keys(rest).length) await tx.update(advocates).set(rest).where(eq(advocates.id, req.advocateId));
      // Only a real change moves the consent date and is logged: repeating "on" keeps the date consent was first given.
      // Same transaction: consent never changes without its audit row (DPDP).
      if (cloudOcrConsent !== undefined) {
        const changed = await tx
          .update(advocates)
          .set({ cloudOcrConsent, cloudOcrConsentAt: cloudOcrConsent ? new Date() : null })
          .where(and(eq(advocates.id, req.advocateId), eq(advocates.cloudOcrConsent, !cloudOcrConsent)))
          .returning({ id: advocates.id });
        if (changed.length) await logConsent(tx, req, `consent.cloud_ocr.${cloudOcrConsent ? "on" : "off"}`);
      }
      if (aiConsent !== undefined) {
        const changed = await tx
          .update(advocates)
          .set({ aiConsent, aiConsentAt: aiConsent ? new Date() : null })
          .where(and(eq(advocates.id, req.advocateId), eq(advocates.aiConsent, !aiConsent)))
          .returning({ id: advocates.id });
        if (changed.length) await logConsent(tx, req, `consent.ai.${aiConsent ? "on" : "off"}`);
      }
    });
    const advocate = await db.query.advocates.findFirst({ where: eq(advocates.id, req.advocateId), columns: profile });
    return { advocate };
  });

  /** One-tap delete of the whole account and every client, case and document in it. Always needs the password. */
  app.delete("/", { schema: { body: z.object({ password: z.string().min(1) }) } }, async (req, reply) => {
    try {
      await auth.api.deleteUser({ headers: fromNodeHeaders(req.headers), body: { password: req.body.password } });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 400) throw new HttpError(401, "invalid_credentials", "Password is incorrect");
      throw e;
    }
    // Clear the session cookies under both names (production uses the __Secure- prefix).
    reply.header(
      "set-cookie",
      ["better-auth.session_token", "better-auth.session_data"].flatMap((name) => [
        `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`,
        `__Secure-${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      ]),
    );
    return reply.code(204).send();
  });
};
