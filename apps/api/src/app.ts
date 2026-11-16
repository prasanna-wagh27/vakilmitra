import express, { Router } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./env.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";
import { authRouter } from "./routes/auth.js";
import { clientsRouter } from "./routes/clients.js";
import { casesRouter } from "./routes/cases.js";
import { diaryRouter, hearingsRouter } from "./routes/diary.js";
import { feesRouter } from "./routes/fees.js";
import { landRouter } from "./routes/land.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.webOrigin, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  const api = Router();
  api.get("/health", (_req, res) => {
    res.json({ ok: true });
  });
  api.use("/auth", authRouter);

  const authed = Router();
  authed.use(requireAuth);
  authed.use("/clients", clientsRouter);
  authed.use("/cases", casesRouter);
  authed.use("/diary", diaryRouter);
  authed.use("/fees", feesRouter);
  authed.use("/", hearingsRouter);
  authed.use("/", landRouter);
  api.use(authed);

  app.use("/api", api);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "not_found", message: "No such endpoint" });
  });
  app.use(errorHandler);
  return app;
}
