import { useEffect, useRef, useState } from "react";
import { isConvex, type Pt, type Quad } from "@/lib/scanner/geometry";

/**
 * The captured photo with four draggable corners. Drawn in SVG in image coordinates, so it
 * scales to any screen and pointer positions map back exactly. Handles are big for thumbs.
 */
export function CornerEditor({
  canvas,
  quad,
  onChange,
  label,
}: {
  canvas: HTMLCanvasElement;
  quad: Quad;
  onChange: (q: Quad) => void;
  label: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const W = canvas.width;
  const H = canvas.height;
  const r = Math.max(W, H) * 0.028;

  useEffect(() => {
    let u: string | null = null;
    canvas.toBlob(
      (b) => {
        if (!b) return;
        u = URL.createObjectURL(b);
        setUrl(u);
      },
      "image/jpeg",
      0.8,
    );
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [canvas]);

  function toImage(e: React.PointerEvent): Pt {
    const svg = svgRef.current!;
    const m = svg.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return { x: Math.min(W, Math.max(0, p.x)), y: Math.min(H, Math.max(0, p.y)) };
  }

  function move(e: React.PointerEvent) {
    if (drag === null) return;
    const next = quad.map((p, i) => (i === drag ? toImage(e) : p)) as Quad;
    if (isConvex(next)) onChange(next); // never let corners cross
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      className="h-full max-h-full w-full touch-none select-none"
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={move}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {url && <image href={url} width={W} height={H} />}
      <path d={`M0 0H${W}V${H}H0Z M${quad.map((p) => `${p.x} ${p.y}`).join(" L")}Z`} fill="rgba(0,0,0,0.45)" fillRule="evenodd" />
      <polygon points={quad.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#6d95f0" strokeWidth={r * 0.18} />
      {quad.map((p, i) => (
        <g key={i}>
          <circle
            cx={p.x}
            cy={p.y}
            r={r * 1.8}
            fill="transparent"
            className="cursor-grab"
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              setDrag(i);
            }}
          />
          <circle cx={p.x} cy={p.y} r={r * 0.7} fill="#fff" stroke="#1f4fb8" strokeWidth={r * 0.2} pointerEvents="none" />
        </g>
      ))}
    </svg>
  );
}
