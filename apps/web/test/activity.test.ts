import { describe, expect, it } from "vitest";
import { activityCsv, activityLabel, localDigits } from "../src/lib/activity";

/** Every action the API records (see apps/api/src/lib/audit.ts and the named actions). */
const ACTIONS = [
  "case.view",
  "case.list",
  "case.create",
  "case.update",
  "case.delete",
  "case.share",
  "case.unshare",
  "document.view",
  "document.extract",
  "page.view",
  "page.ocr",
  "page.sent_to_ocr:sarvam",
  "hearing.create",
  "fee_agreement.update",
  "report.export",
  "report.approve",
  "property.check",
  "search.view",
  "auth.sign_in",
  "auth.sign_in_failed",
  "auth.password_reset",
  "account.create",
  "consent.cloud_ocr.on",
  "billing.paid",
  "billing.checkout",
  "diary.board",
];

describe("activity labels", () => {
  it("are whole Marathi on Marathi screens and whole English on English ones", () => {
    for (const a of ACTIONS) {
      const mr = activityLabel(a, "mr");
      const en = activityLabel(a, "en");
      expect(mr, a).not.toMatch(/[A-Za-z]/);
      expect(en, a).not.toMatch(/[ऀ-ॿ]/);
      expect(en, a).not.toBe("Other action");
    }
  });

  it("falls back to a general label, never a code", () => {
    expect(activityLabel("widget.frobnicate", "mr")).toBe("इतर क्रिया");
    expect(activityLabel("case.frobnicate", "en")).toBe("Other action");
  });

  it("writes a spreadsheet in the reader's language", () => {
    const csv = activityCsv(
      [
        {
          id: "1",
          at: "2026-11-20T06:00:00Z",
          action: "case.view",
          entityType: "case",
          entityId: "c1",
          caseId: "c1",
          caseTitle: "पाटील विरुद्ध जाधव",
          method: "GET",
          status: 404,
          ip: "10.0.0.1",
          userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile",
          actor: { id: "a", name: "Adv. X", isMe: false, kind: "advocate" },
        },
      ],
      "mr",
    );
    expect(csv.startsWith("﻿केव्हा,कोणी,काय,प्रकरण")).toBe(true);
    expect(csv).toContain("नाकारले");
    expect(csv).toContain("फोन");
    expect(csv).not.toMatch(/[AP]M/);
    expect(csv).toContain(localDigits("10.0.0.1", "mr"));
  });
});
