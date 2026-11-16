import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../lib/http.js";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    return;
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      res.status(404).json({ error: "not_found", message: "Not found" });
      return;
    }
    if (err.code === "P2002") {
      res.status(409).json({ error: "conflict", message: "Already exists" });
      return;
    }
  }
  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "invalid_json", message: "Malformed JSON" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "internal", message: "Something went wrong" });
}
