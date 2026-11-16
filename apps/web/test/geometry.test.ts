import { describe, expect, it } from "vitest";
import { defaultQuad, fitWithin, isConvex, orderCorners, outputSize, type Quad, quadArea, shrinkQuad } from "../src/lib/scanner/geometry";

describe("orderCorners", () => {
  it("orders shuffled corners TL, TR, BR, BL", () => {
    const q = orderCorners([
      { x: 900, y: 1200 },
      { x: 100, y: 80 },
      { x: 80, y: 1180 },
      { x: 920, y: 100 },
    ]);
    expect(q).toEqual([
      { x: 100, y: 80 },
      { x: 920, y: 100 },
      { x: 900, y: 1200 },
      { x: 80, y: 1180 },
    ]);
  });

  it("handles a page photographed at an angle", () => {
    const q = orderCorners([
      { x: 300, y: 50 },
      { x: 950, y: 300 },
      { x: 650, y: 1300 },
      { x: 20, y: 1000 },
    ]);
    expect(q[0]).toEqual({ x: 300, y: 50 });
    expect(q[2]).toEqual({ x: 650, y: 1300 });
    expect(isConvex(q)).toBe(true);
  });
});

describe("quad checks", () => {
  const rect: Quad = defaultQuad(1000, 2000, 0);
  it("computes area and output size", () => {
    expect(quadArea(rect)).toBe(2_000_000);
    expect(outputSize(rect)).toEqual({ width: 1000, height: 2000 });
    expect(outputSize(rect, 1000)).toEqual({ width: 500, height: 1000 });
  });

  it("rejects crossed handles", () => {
    const crossed: Quad = [rect[0], rect[2], rect[1], rect[3]];
    expect(isConvex(crossed)).toBe(false);
  });

  it("insets the default frame", () => {
    expect(defaultQuad(1000, 1000)[0]).toEqual({ x: 40, y: 40 });
  });

  it("never enlarges when fitting", () => {
    expect(fitWithin(800, 600, 2400)).toEqual({ width: 800, height: 600, scale: 1 });
    expect(fitWithin(4000, 3000, 2400)).toEqual({ width: 2400, height: 1800, scale: 0.6 });
  });
});

describe("shrinkQuad", () => {
  it("moves corners toward the centre", () => {
    const q = shrinkQuad(defaultQuad(1000, 1000, 0), 0.1);
    expect(q[0]).toEqual({ x: 50, y: 50 });
    expect(q[2]).toEqual({ x: 950, y: 950 });
  });
});
