import { fitWithin } from "./geometry";

/** Longest side of what we upload: plenty for OCR of small Devanagari, light on mobile data. */
export const UPLOAD_MAX_SIDE = 2400;
/** Longest side we work with in memory while cropping. */
export const WORK_MAX_SIDE = 3000;

export function drawToCanvas(source: CanvasImageSource, width: number, height: number, maxSide = WORK_MAX_SIDE) {
  const fit = fitWithin(width, height, maxSide);
  const canvas = document.createElement("canvas");
  canvas.width = fit.width;
  canvas.height = fit.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, fit.width, fit.height);
  return canvas;
}

/** Decode an image file upright (EXIF orientation applied) into a canvas. */
export async function fileToCanvas(file: Blob) {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    return drawToCanvas(bmp, bmp.width, bmp.height);
  } finally {
    bmp.close();
  }
}

export function canvasToJpeg(canvas: HTMLCanvasElement, maxSide = UPLOAD_MAX_SIDE, quality = 0.85): Promise<Blob> {
  const src = canvas.width > maxSide || canvas.height > maxSide ? drawToCanvas(canvas, canvas.width, canvas.height, maxSide) : canvas;
  return new Promise((resolve, reject) =>
    src.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode image"))), "image/jpeg", quality),
  );
}

/** Small preview for the thumbnail strip. */
export async function thumbnail(canvas: HTMLCanvasElement) {
  const blob = await canvasToJpeg(canvas, 240, 0.7);
  return URL.createObjectURL(blob);
}
