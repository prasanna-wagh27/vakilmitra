/** Pure geometry for page corners. Coordinates are in source-image pixels. */
export interface Pt {
  x: number;
  y: number;
}
/** Always ordered: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Pt, Pt, Pt, Pt];

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Order 4 arbitrary corner points as TL, TR, BR, BL (sum/difference method). */
export function orderCorners(pts: Pt[]): Quad {
  if (pts.length !== 4) throw new Error("Need exactly 4 points");
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...pts].sort((a, b) => a.y - a.x - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

/** Shoelace area. */
export function quadArea(q: Quad): number {
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) / 2;
}

/** True if the four corners make a convex, non-degenerate shape (no crossed handles). */
export function isConvex(q: Quad): boolean {
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    const c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 1e-9) return false;
    const s = Math.sign(cross);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** A frame slightly inside the image edges: the starting guess when no page edge is found. */
export function defaultQuad(width: number, height: number, inset = 0.04): Quad {
  const dx = width * inset;
  const dy = height * inset;
  return [
    { x: dx, y: dy },
    { x: width - dx, y: dy },
    { x: width - dx, y: height - dy },
    { x: dx, y: height - dy },
  ];
}

export function fullQuad(width: number, height: number): Quad {
  return defaultQuad(width, height, 0);
}

/** Size of the flattened page: the longer of each pair of opposite edges, capped at maxSide. */
export function outputSize(q: Quad, maxSide = 3000): { width: number; height: number } {
  const [tl, tr, br, bl] = q;
  let width = Math.max(dist(tl, tr), dist(bl, br));
  let height = Math.max(dist(tl, bl), dist(tr, br));
  const k = Math.min(1, maxSide / Math.max(width, height));
  width = Math.max(1, Math.round(width * k));
  height = Math.max(1, Math.round(height * k));
  return { width, height };
}

/** Scale to fit within maxSide, never enlarging. */
export function fitWithin(width: number, height: number, maxSide: number) {
  const k = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.round(width * k), height: Math.round(height * k), scale: k };
}

export function clampQuad(q: Quad, width: number, height: number): Quad {
  return q.map((p) => ({ x: Math.min(width, Math.max(0, p.x)), y: Math.min(height, Math.max(0, p.y)) })) as Quad;
}

export function boundingBox(q: Quad) {
  const xs = q.map((p) => p.x);
  const ys = q.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Pull corners toward the centre by a fraction, so the flattened page has no desk sliver at its edges. */
export function shrinkQuad(q: Quad, fraction: number): Quad {
  const cx = q.reduce((s, p) => s + p.x, 0) / 4;
  const cy = q.reduce((s, p) => s + p.y, 0) / 4;
  return q.map((p) => ({ x: p.x + (cx - p.x) * fraction, y: p.y + (cy - p.y) * fraction })) as Quad;
}
