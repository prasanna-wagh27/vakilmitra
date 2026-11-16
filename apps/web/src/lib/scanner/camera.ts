import { drawToCanvas } from "./image";

/** Minimal typing for ImageCapture (Chrome/Android), which gives full-resolution stills. */
interface ImageCaptureLike {
  takePhoto(): Promise<Blob>;
}
type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: "environment" }, width: { ideal: 3840 }, height: { ideal: 2160 } },
  });
  video.srcObject = stream;
  video.setAttribute("playsinline", "true");
  video.muted = true;
  await video.play();
  return stream;
}

export function stopCamera(stream: MediaStream | null) {
  for (const t of stream?.getTracks() ?? []) t.stop();
}

/**
 * Capture a still into memory. Never touches the gallery or the file system:
 * the frame lives only in a canvas until it is encrypted on the server.
 */
export async function capture(stream: MediaStream, video: HTMLVideoElement): Promise<HTMLCanvasElement> {
  const track = stream.getVideoTracks()[0];
  const Ctor = (window as unknown as { ImageCapture?: ImageCaptureCtor }).ImageCapture;
  if (Ctor && track) {
    try {
      const blob = await new Ctor(track).takePhoto();
      const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
      try {
        return drawToCanvas(bmp, bmp.width, bmp.height);
      } finally {
        bmp.close();
      }
    } catch {
      // Fall through to a video frame (some devices refuse takePhoto while previewing).
    }
  }
  return drawToCanvas(video, video.videoWidth, video.videoHeight);
}
