import type { Locale } from "@vakilmitra/shared";
import { interpolate, type MessageKey, translate } from "@vakilmitra/shared/i18n";
import { fmtDate, fmtNumber } from "./format";

export interface ActivityEntry {
  id: string;
  at: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  caseId: string | null;
  caseTitle: string | null;
  method: string | null;
  status: number | null;
  ip: string | null;
  userAgent: string | null;
  actor: { id: string | null; name: string | null; isMe: boolean; kind: string };
}

export const ACTIVITY_KINDS = ["all", "view", "change", "signin"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

const has = (key: string, locale: Locale): key is MessageKey => translate(locale, key as MessageKey) !== key;

/** "Viewed case", "प्रकरण पाहिले": named actions first, else verb + thing, never a raw code. */
export function activityLabel(action: string, locale: Locale) {
  const t = (k: MessageKey) => translate(locale, k);
  const base = action.split(":")[0];
  if (has(`activity.a.${base}`, locale)) return t(`activity.a.${base}` as MessageKey);
  const dot = base.lastIndexOf(".");
  const entity = base.slice(0, dot);
  const verb = base.slice(dot + 1);
  if (!has(`activity.e.${entity}`, locale)) return t("activity.other");
  const thing = t(`activity.e.${entity}` as MessageKey);
  if (verb === "list") return interpolate(t("activity.listLine"), { entity: thing });
  if (!has(`activity.v.${verb}`, locale)) return t("activity.other");
  return interpolate(t("activity.line"), { verb: t(`activity.v.${verb}` as MessageKey), entity: thing });
}

export function whoLabel(e: ActivityEntry, locale: Locale) {
  if (e.actor.kind === "system") return translate(locale, "activity.system");
  if (e.actor.isMe) return translate(locale, "activity.you");
  return e.actor.name ?? translate(locale, "activity.unknown");
}

/** Refused (no access, not found) or failed; null when it went through. */
export function resultKey(e: ActivityEntry): MessageKey | null {
  if (!e.status || e.status < 400 || e.action.startsWith("auth.")) return null;
  return e.status === 403 || e.status === 404 ? "activity.refused" : "activity.failed";
}

export function deviceKey(ua: string | null): MessageKey | null {
  if (!ua) return null;
  if (/iPad|Tablet/i.test(ua)) return "activity.device.tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "activity.device.phone";
  return "activity.device.computer";
}

/** Digits in the reader's script (an IP address on a Marathi screen in Devanagari digits). */
export const localDigits = (s: string, locale: Locale) => (locale === "mr" ? s.replace(/\d/g, (d) => fmtNumber(Number(d), "mr")) : s);

export const whenLabel = (at: string, locale: Locale) =>
  // 24-hour clock in Marathi: "PM" would put English letters on a Marathi screen.
  fmtDate(at, locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: locale === "mr" ? "h23" : "h12",
  });

/** A spreadsheet of the entries, in the reader's language (Excel opens UTF-8 with the BOM). */
export function activityCsv(entries: ActivityEntry[], locale: Locale) {
  const t = (k: MessageKey) => translate(locale, k);
  const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ["when", "who", "what", "case", "result", "device", "ip"].map((c) => t(`activity.col.${c}` as MessageKey));
  const rows = entries.map((e) => {
    const r = resultKey(e);
    const d = deviceKey(e.userAgent);
    return [
      whenLabel(e.at, locale),
      whoLabel(e, locale),
      activityLabel(e.action, locale),
      e.caseId ? (e.caseTitle ?? t("activity.caseGone")) : "",
      t(r ?? "activity.ok"),
      d ? t(d) : "",
      e.ip ? localDigits(e.ip, locale) : "",
    ];
  });
  return `﻿${[head, ...rows].map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}
