import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { HttpError, parse } from "../lib/http.js";
import { clearSession, issueSession, requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const publicAdvocate = { id: true, name: true, email: true, phone: true, barCouncilNo: true, locale: true, createdAt: true } as const;

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8).max(200),
  phone: z.string().trim().max(20).optional(),
  barCouncilNo: z.string().trim().max(40).optional(),
  locale: z.enum(["mr", "en"]).optional(),
});

authRouter.post("/register", async (req, res) => {
  const { password, ...body } = parse(registerSchema, req.body);
  const exists = await prisma.advocate.findUnique({ where: { email: body.email } });
  if (exists) throw new HttpError(409, "email_taken", "An account with this email already exists");
  const advocate = await prisma.advocate.create({
    data: { ...body, passwordHash: await bcrypt.hash(password, 12) },
    select: publicAdvocate,
  });
  issueSession(res, advocate.id);
  res.status(201).json({ advocate });
});

const loginSchema = z.object({ email: z.string().trim().toLowerCase(), password: z.string() });

authRouter.post("/login", async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const a = await prisma.advocate.findUnique({ where: { email } });
  if (!a || !(await bcrypt.compare(password, a.passwordHash))) {
    throw new HttpError(401, "invalid_credentials", "Email or password is incorrect");
  }
  issueSession(res, a.id);
  const advocate = await prisma.advocate.findUniqueOrThrow({ where: { id: a.id }, select: publicAdvocate });
  res.json({ advocate });
});

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, async (req, res) => {
  const advocate = await prisma.advocate.findUnique({ where: { id: req.advocateId }, select: publicAdvocate });
  if (!advocate) throw new HttpError(401, "unauthenticated", "Please sign in");
  res.json({ advocate });
});

const updateMeSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  barCouncilNo: z.string().trim().max(40).nullable().optional(),
  locale: z.enum(["mr", "en"]).optional(),
});

authRouter.patch("/me", requireAuth, async (req, res) => {
  const data = parse(updateMeSchema, req.body);
  const advocate = await prisma.advocate.update({ where: { id: req.advocateId }, data, select: publicAdvocate });
  res.json({ advocate });
});

/** One-tap delete of the whole account and every case, client and document in it. */
authRouter.delete("/me", requireAuth, async (req, res) => {
  const { password } = parse(z.object({ password: z.string() }), req.body);
  const a = await prisma.advocate.findUniqueOrThrow({ where: { id: req.advocateId } });
  if (!(await bcrypt.compare(password, a.passwordHash))) {
    throw new HttpError(401, "invalid_credentials", "Password is incorrect");
  }
  await prisma.$transaction([
    prisma.accessLog.create({ data: { advocateId: null, action: "account.delete", entityType: "advocate", entityId: a.id, ip: req.ip } }),
    prisma.advocate.delete({ where: { id: a.id } }),
  ]);
  clearSession(res);
  res.status(204).end();
});
