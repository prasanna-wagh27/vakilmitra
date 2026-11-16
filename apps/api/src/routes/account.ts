import { advocates, eq } from "@vakilmitra/db";
import { updateProfileInput } from "@vakilmitra/shared";
import { fromNodeHeaders } from "better-auth/node";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { auth } from "../auth.js";
import { db } from "../db.js";
import { HttpError } from "../lib/http.js";

const profile = { id: true, name: true, email: true, phone: true, barCouncilNo: true, locale: true, createdAt: true } as const;

export const accountRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get("/", async (req) => {
    const advocate = await db.query.advocates.findFirst({ where: eq(advocates.id, req.advocateId), columns: profile });
    if (!advocate) throw new HttpError(401, "unauthenticated", "Please sign in");
    return { advocate };
  });

  app.patch("/", { schema: { body: updateProfileInput } }, async (req) => {
    const [advocate] = await db.update(advocates).set(req.body).where(eq(advocates.id, req.advocateId)).returning({
      id: advocates.id,
      name: advocates.name,
      email: advocates.email,
      phone: advocates.phone,
      barCouncilNo: advocates.barCouncilNo,
      locale: advocates.locale,
    });
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
    reply.header("set-cookie", "better-auth.session_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
    return reply.code(204).send();
  });
};
