/**
 * OCR eval harness: run engines over a labelled set of pages and score them against the
 * spec's quality gates. Used by the CLI (run.ts) and by tests.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { cer, FIELD_GROUPS, type FieldGroup, type FieldResult, matchFields, mean, median, type TruthFields, wer } from "../src/metrics.js";
import type { OcrEngine } from "../src/types.js";

export interface EvalCase {
  id: string;
  image: Buffer;
  truth: string;
  fields: TruthFields;
  /** e.g. { script: "handwritten", district: "Pune", doc_type: "SEVEN_TWELVE", source: "synthetic" } */
  meta: Record<string, string>;
}

/**
 * Load a dataset: one folder per page with page.(jpg|jpeg|png), truth.txt, and optional
 * fields.json and meta.json. Folders without a truth.txt are skipped (not labelled yet).
 */
export async function loadCases(dir: string): Promise<EvalCase[]> {
  const out: EvalCase[] = [];
  for (const id of (await readdir(dir)).sort()) {
    const d = join(dir, id);
    if (!(await stat(d)).isDirectory()) continue;
    const files = await readdir(d);
    const img = files.find((f) => /^page\.(jpe?g|png)$/i.test(f));
    if (!img || !files.includes("truth.txt")) continue;
    const json = async (f: string) => (files.includes(f) ? JSON.parse(await readFile(join(d, f), "utf8")) : {});
    out.push({
      id,
      image: await readFile(join(d, img)),
      truth: await readFile(join(d, "truth.txt"), "utf8"),
      fields: await json("fields.json"),
      meta: await json("meta.json"),
    });
  }
  return out;
}

export interface CaseResult {
  id: string;
  meta: Record<string, string>;
  ms: number;
  text: string;
  confidence: number | null;
  cer: number;
  wer: number;
  fields: FieldResult[];
  error?: string;
}

export interface EngineRun {
  engine: string;
  results: CaseResult[];
}

export async function runEngine(engine: OcrEngine, cases: EvalCase[], onCase?: (r: CaseResult) => void): Promise<EngineRun> {
  const results: CaseResult[] = [];
  for (const c of cases) {
    const started = Date.now();
    let r: CaseResult;
    try {
      const o = await engine.recognize(c.image, {
        contentType: c.meta.script === "handwritten" ? "handwritten" : c.meta.script === "printed" ? "printed" : "mixed",
      });
      r = {
        id: c.id,
        meta: c.meta,
        ms: Date.now() - started,
        text: o.text,
        confidence: o.confidence,
        cer: cer(c.truth, o.text),
        wer: wer(c.truth, o.text),
        fields: matchFields(c.fields, o.text),
      };
    } catch (e) {
      // A failed page scores as a total miss: errors must count against an engine, not vanish.
      r = {
        id: c.id,
        meta: c.meta,
        ms: Date.now() - started,
        text: "",
        confidence: null,
        cer: 1,
        wer: 1,
        fields: matchFields(c.fields, ""),
        error: e instanceof Error ? e.message : String(e),
      };
    }
    results.push(r);
    onCase?.(r);
  }
  return { engine: engine.name, results };
}

export interface GroupScore {
  group: FieldGroup;
  label: string;
  target: number;
  found: number;
  total: number;
  accuracy: number | null;
  passes: boolean | null;
}

export interface EngineSummary {
  engine: string;
  pages: number;
  errors: number;
  meanCer: number;
  medianCer: number;
  meanWer: number;
  /** Mean CER per meta.script value (printed / handwritten / mixed / unknown). */
  cerByScript: Record<string, { pages: number; meanCer: number }>;
  groups: GroupScore[];
  meanMs: number;
  /** True only if every field group with data meets its target. */
  passesGates: boolean | null;
}

export function summarize(run: EngineRun): EngineSummary {
  const rs = run.results;
  const byScript: Record<string, number[]> = {};
  for (const r of rs) {
    const k = r.meta.script ?? "unknown";
    byScript[k] = [...(byScript[k] ?? []), r.cer];
  }
  const groups: GroupScore[] = (Object.keys(FIELD_GROUPS) as FieldGroup[]).map((group) => {
    const all = rs.flatMap((r) => r.fields.filter((f) => f.group === group));
    const found = all.filter((f) => f.found).length;
    const accuracy = all.length ? found / all.length : null;
    const target = FIELD_GROUPS[group].target;
    return {
      group,
      label: FIELD_GROUPS[group].label,
      target,
      found,
      total: all.length,
      accuracy,
      passes: accuracy === null ? null : accuracy >= target,
    };
  });
  const judged = groups.filter((g) => g.passes !== null);
  return {
    engine: run.engine,
    pages: rs.length,
    errors: rs.filter((r) => r.error).length,
    meanCer: mean(rs.map((r) => r.cer)),
    medianCer: median(rs.map((r) => r.cer)),
    meanWer: mean(rs.map((r) => r.wer)),
    cerByScript: Object.fromEntries(Object.entries(byScript).map(([k, v]) => [k, { pages: v.length, meanCer: mean(v) }])),
    groups,
    meanMs: mean(rs.map((r) => r.ms)),
    passesGates: judged.length ? judged.every((g) => g.passes) : null,
  };
}

const pct = (n: number | null) => (n === null || Number.isNaN(n) ? "–" : `${(n * 100).toFixed(1)}%`);

export function renderMarkdown(summaries: EngineSummary[], runs: EngineRun[], meta: { dataset: string; date: string }): string {
  const scripts = [...new Set(summaries.flatMap((s) => Object.keys(s.cerByScript)))].sort();
  const lines: string[] = [];
  lines.push(`# OCR evaluation`, "", `Dataset: \`${meta.dataset}\` · ${summaries[0]?.pages ?? 0} pages · ${meta.date}`, "");
  lines.push(
    "Lower CER is better (character error rate after normalising digits and spacing). Field accuracy = share of labelled values that appear exactly in the OCR text; targets are the spec's quality gates.",
    "",
  );
  lines.push(
    `| Engine | Mean CER | Median CER | WER | ${scripts.map((s) => `CER ${s}`).join(" | ")} | Errors | Avg time | Meets all gates |`,
  );
  lines.push(`|---|---|---|---|${scripts.map(() => "---").join("|")}|---|---|---|`);
  for (const s of summaries) {
    lines.push(
      `| ${s.engine} | ${pct(s.meanCer)} | ${pct(s.medianCer)} | ${pct(s.meanWer)} | ${scripts.map((k) => (s.cerByScript[k] ? `${pct(s.cerByScript[k].meanCer)} (${s.cerByScript[k].pages})` : "–")).join(" | ")} | ${s.errors} | ${(s.meanMs / 1000).toFixed(1)} s | ${s.passesGates === null ? "no field labels" : s.passesGates ? "✅ yes" : "❌ no"} |`,
    );
  }
  lines.push("", "## Field accuracy vs spec targets", "");
  lines.push(`| Field group | Target | ${summaries.map((s) => s.engine).join(" | ")} |`);
  lines.push(`|---|---|${summaries.map(() => "---").join("|")}|`);
  for (const g of Object.keys(FIELD_GROUPS) as FieldGroup[]) {
    const def = FIELD_GROUPS[g];
    const cells = summaries.map((s) => {
      const x = s.groups.find((y) => y.group === g)!;
      return x.total ? `${x.passes ? "✅" : "❌"} ${pct(x.accuracy)} (${x.found}/${x.total})` : "–";
    });
    lines.push(`| ${def.label} | ${pct(def.target)} | ${cells.join(" | ")} |`);
  }
  lines.push("", "## Misses", "");
  for (const run of runs) {
    const misses = run.results.flatMap((r) => [
      ...(r.error ? [`- \`${r.id}\`: error: ${r.error}`] : []),
      ...r.fields.filter((f) => !f.found).map((f) => `- \`${r.id}\`: ${f.field} "${f.expected}" not found`),
    ]);
    lines.push(`### ${run.engine}`, "", ...(misses.length ? misses : ["None."]), "");
  }
  return lines.join("\n");
}
