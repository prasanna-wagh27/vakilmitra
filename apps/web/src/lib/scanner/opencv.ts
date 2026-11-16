/**
 * OpenCV.js (Apache-2.0) for page-edge detection and perspective correction.
 * It is large (~3.5 MB gzipped), so it is loaded only on the scanner screen, never in the main bundle.
 */
import type cvModule from "@techstark/opencv-js";
import { boundingBox, clampQuad, isConvex, orderCorners, outputSize, type Pt, type Quad, quadArea, shrinkQuad } from "./geometry";

export type CV = typeof cvModule;

let loading: Promise<{ cv: CV }> | null = null;

/**
 * Loaded as a plain <script> (it is a UMD build that sets window.cv), not through the bundler.
 * The OpenCV module is a "thenable" with its own .then; bundler interop and promise chains try to
 * unwrap it and spin forever. So no promise ever resolves with the module itself: we wait for the
 * runtime (cv.Mat) and hand it back wrapped in a plain object.
 */
export function loadOpenCv(timeoutMs = 60_000): Promise<{ cv: CV }> {
  loading ??= import("@techstark/opencv-js/dist/opencv.js?url").then(
    ({ default: src }) =>
      new Promise<{ cv: CV }>((resolve, reject) => {
        const w = window as unknown as { cv?: CV };
        const started = Date.now();
        const wait = () => {
          if (w.cv?.Mat) resolve({ cv: w.cv });
          else if (Date.now() - started > timeoutMs) reject(new Error("OpenCV did not initialise"));
          else setTimeout(wait, 50);
        };
        if (w.cv) return wait();
        const script = document.createElement("script");
        script.src = src;
        script.async = true;
        script.onload = wait;
        script.onerror = () => reject(new Error("Could not load OpenCV"));
        document.head.append(script);
      }),
  );
  loading.catch(() => {
    loading = null; // allow a retry next time the scanner opens
  });
  return loading;
}

/** Find the page outline: the largest convex 4-sided contour covering at least 20% of the photo. */
export function detectPage(cv: CV, canvas: HTMLCanvasElement): Quad | null {
  const scale = Math.min(1, 800 / Math.max(canvas.width, canvas.height));
  const small = document.createElement("canvas");
  small.width = Math.round(canvas.width * scale);
  small.height = Math.round(canvas.height * scale);
  small.getContext("2d")!.drawImage(canvas, 0, 0, small.width, small.height);

  const src = cv.imread(small);
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
    cv.Canny(gray, edges, 50, 150);
    cv.dilate(edges, edges, kernel);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const minArea = 0.2 * small.width * small.height;
    let best: Pt[] | null = null;
    let bestArea = 0;
    for (let i = 0; i < contours.size(); i++) {
      const c = contours.get(i);
      const area = cv.contourArea(c);
      if (area >= minArea && area > bestArea) {
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.02 * cv.arcLength(c, true), true);
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const d = approx.data32S;
          best = [0, 1, 2, 3].map((k) => ({ x: d[k * 2] / scale, y: d[k * 2 + 1] / scale }));
          bestArea = area;
        }
        approx.delete();
      }
      c.delete();
    }
    if (!best) return null;
    // Detected edges sit on the page boundary (the edge map is dilated): step just inside it.
    const q = clampQuad(shrinkQuad(orderCorners(best), 0.008), canvas.width, canvas.height);
    return isConvex(q) ? q : null;
  } finally {
    for (const m of [src, gray, edges, contours, hierarchy, kernel]) m.delete();
  }
}

/** Flatten the page: perspective-correct the quad into an upright rectangle. */
export function warpPage(cv: CV, canvas: HTMLCanvasElement, q: Quad): HTMLCanvasElement {
  const { width, height } = outputSize(q);
  const [tl, tr, br, bl] = q;
  const src = cv.imread(canvas);
  const dst = new cv.Mat();
  const from = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
  const to = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, width, 0, width, height, 0, height]);
  const m = cv.getPerspectiveTransform(from, to);
  try {
    cv.warpPerspective(src, dst, m, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_REPLICATE, new cv.Scalar());
    const out = document.createElement("canvas");
    cv.imshow(out, dst);
    return out;
  } finally {
    for (const x of [src, dst, from, to, m]) x.delete();
  }
}

/** Without OpenCV: crop to the corners' bounding box (no perspective correction). */
export function cropToBox(canvas: HTMLCanvasElement, q: Quad): HTMLCanvasElement {
  const b = boundingBox(q);
  const out = document.createElement("canvas");
  out.width = Math.max(1, Math.round(b.width));
  out.height = Math.max(1, Math.round(b.height));
  out.getContext("2d")!.drawImage(canvas, b.x, b.y, b.width, b.height, 0, 0, out.width, out.height);
  return out;
}

export { quadArea };
