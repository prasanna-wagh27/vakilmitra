import { describe, expect, it } from "vitest";
import { loadCases, renderMarkdown, runEngine, summarize } from "../eval/harness.js";
import type { OcrEngine } from "../src/types.js";

const cases = await loadCases(new URL("../eval/sample", import.meta.url).pathname);

/** An engine that returns the truth for some pages and garbles or fails others. */
function scripted(name: string, behaviour: Record<string, "truth" | "garble" | "fail">): OcrEngine {
  return {
    name,
    external: false,
    async recognize(image) {
      const c = cases.find((x) => x.image === image)!;
      const b = behaviour[c.id] ?? "truth";
      if (b === "fail") throw new Error("provider timeout");
      const text = b === "garble" ? c.truth.replace(/जाधव/g, "जधव").replace(/112|११२/g, "172") : c.truth;
      return { engine: name, text, confidence: 0.9, words: [], width: 1, height: 1 };
    },
    async close() {},
  };
}

describe("eval harness", () => {
  it("loads the labelled sample set", () => {
    expect(cases.map((c) => c.id)).toEqual(["ferfar-degraded", "index2-small", "satbara-clean", "satbara-phone"]);
    expect(cases[0].fields.ferfar_no).toBe("1290");
    expect(cases[0].meta.script).toBe("printed");
  });

  it("scores a perfect engine as passing every gate", async () => {
    const s = summarize(await runEngine(scripted("perfect", {}), cases));
    expect(s.meanCer).toBe(0);
    expect(s.passesGates).toBe(true);
  });

  it("catches wrong names and numbers, and counts failures as misses", async () => {
    const run = await runEngine(scripted("flaky", { "satbara-clean": "garble", "index2-small": "fail" }), cases);
    const s = summarize(run);
    expect(s.errors).toBe(1);
    expect(s.meanCer).toBeGreaterThan(0);
    expect(s.groups.find((g) => g.group === "owners")?.accuracy).toBeLessThan(0.95);
    expect(s.passesGates).toBe(false);
    const md = renderMarkdown([s], [run], { dataset: "sample", date: "today" });
    expect(md).toContain("❌");
    expect(md).toContain('`satbara-clean`: owners "सुरेश जाधव" not found');
    expect(md).toContain("`index2-small`: error: provider timeout");
  });
});
