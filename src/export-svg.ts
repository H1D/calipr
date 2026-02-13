import type { Measurement, Calibration, Unit, Point, PolylineSegment } from "./types.ts";
import { circumscribedCircle, angleSweepThrough } from "./utils.ts";

/**
 * Compute SVG arc command parameters for an arc through start, bulge (mid), end.
 */
function svgArcParams(
  start: Point,
  mid: Point,
  end: Point,
): { rx: number; ry: number; largeArc: 0 | 1; sweepFlag: 0 | 1; x: number; y: number } | null {
  const circle = circumscribedCircle(start, mid, end);
  if (!circle) return null;

  const a1 = Math.atan2(start.y - circle.cy, start.x - circle.cx);
  const a2 = Math.atan2(mid.y - circle.cy, mid.x - circle.cx);
  const a3 = Math.atan2(end.y - circle.cy, end.x - circle.cx);
  const sweep = angleSweepThrough(a1, a2, a3);

  const sweepFlag: 0 | 1 = sweep > 0 ? 1 : 0;
  const largeArc: 0 | 1 = Math.abs(sweep) > Math.PI ? 1 : 0;

  return { rx: circle.r, ry: circle.r, largeArc, sweepFlag, x: end.x, y: end.y };
}

function renderPolyline(start: Point, segments: PolylineSegment[], closed: boolean): string {
  let pathD = `M ${start.x} ${start.y}`;
  let prev = start;

  for (const seg of segments) {
    if (seg.bulge) {
      const arcParams = svgArcParams(prev, seg.bulge, seg.end);
      if (arcParams) {
        pathD += ` A ${arcParams.rx} ${arcParams.ry} 0 ${arcParams.largeArc} ${arcParams.sweepFlag} ${arcParams.x} ${arcParams.y}`;
      } else {
        pathD += ` L ${seg.end.x} ${seg.end.y}`;
      }
    } else {
      pathD += ` L ${seg.end.x} ${seg.end.y}`;
    }
    prev = seg.end;
  }

  if (closed && segments.length >= 2) {
    pathD += " Z";
  }

  return `<path d="${pathD}" fill="none"/>`;
}

function renderRectangle(a: Point, b: Point): string {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none"/>`;
}

function renderCircle(center: Point, radiusPx: number): string {
  return `<circle cx="${center.x}" cy="${center.y}" r="${radiusPx}" fill="none"/>`;
}

function renderMeasurement(m: Measurement): string {
  switch (m.kind) {
    case "polyline":
      return renderPolyline(m.start, m.segments, !!m.closed);
    case "rectangle":
      return renderRectangle(m.points[0], m.points[1]);
    case "circle":
      return renderCircle(m.center, m.radiusPx);
  }
}

/**
 * Export all measurements as a minimal SVG — geometry only.
 */
export function exportSVG(
  measurements: Measurement[],
  _calibration: Calibration | null,
  _unit: Unit,
  width?: number,
  height?: number,
): string {
  const w = width ?? (typeof window !== "undefined" ? window.innerWidth : 1920);
  const h = height ?? (typeof window !== "undefined" ? window.innerHeight : 1080);

  const body = measurements
    .map((m) => renderMeasurement(m))
    .join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" stroke="black" stroke-width="1">`,
    body,
    `</svg>`,
  ].join("\n");
}

/**
 * Trigger a browser download of the SVG string as a file.
 */
export function downloadSVG(svgString: string, filename: string): void {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
