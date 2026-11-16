import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env.js";
import { HttpError } from "../lib/http.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      advocateId?: string;
    }
  }
}

export const SESSION_COOKIE = "vm_session";
const SESSION_DAYS = 30;

export function issueSession(res: Response, advocateId: string) {
  const token = jwt.sign({ sub: advocateId }, env.jwtSecret, { expiresIn: `${SESSION_DAYS}d` });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = req.cookies?.[SESSION_COOKIE] ?? (header?.startsWith("Bearer ") ? header.slice(7) : undefined);
  if (!token) throw new HttpError(401, "unauthenticated", "Please sign in");
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
    req.advocateId = String(payload.sub);
  } catch {
    throw new HttpError(401, "unauthenticated", "Session expired, please sign in again");
  }
  next();
}
