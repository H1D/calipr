import type { Point, Calibration, Unit, PolylineMeasurement } from "./types";
import { DEFAULT_PX_PER_MM } from "./types";

export function dist(a: Point, b: Point): number {
  return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
}

export function distXY(a: Point, b: Point, cal: Calibration | null): { mm: number; px: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const px = Math.sqrt(dx * dx + dy * dy);

  if (!cal) {
    const mm = px / DEFAULT_PX_PER_MM;
    return { mm, px };
  }

  const mmX = dx / cal.pxPerMmX;
  const mmY = dy / cal.pxPerMmY;
  const mm = Math.sqrt(mmX * mmX + mmY * mmY);
  return { mm, px };
}

export function pxToUnit(px: number, cal: Calibration | null, unit: Unit): number {
  const pxPerMm = cal ? (cal.pxPerMmX + cal.pxPerMmY) / 2 : DEFAULT_PX_PER_MM;
  const mm = px / pxPerMm;
  switch (unit) {
    case "mm": return mm;
    case "cm": return mm / 10;
    case "in": return mm / 25.4;
  }
}

export function distToUnit(a: Point, b: Point, cal: Calibration | null, unit: Unit): number {
  const { mm } = distXY(a, b, cal);
  switch (unit) {
    case "mm": return mm;
    case "cm": return mm / 10;
    case "in": return mm / 25.4;
  }
}

export function formatValue(value: number, unit: Unit): string {
  const decimals = unit === "mm" ? 1 : 2;
  return `${value.toFixed(decimals)} ${unit}`;
}

export function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

export function polygonArea(points: Point[], cal: Calibration | null, unit: Unit): number {
  // Shoelace formula for area in pixels
  let areaPx2 = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const pi = points[i]!;
    const pj = points[j]!;
    areaPx2 += pi.x * pj.y;
    areaPx2 -= pj.x * pi.y;
  }
  areaPx2 = Math.abs(areaPx2) / 2;

  const pxPerMmX = cal ? cal.pxPerMmX : DEFAULT_PX_PER_MM;
  const pxPerMmY = cal ? cal.pxPerMmY : DEFAULT_PX_PER_MM;
  const areaMm2 = areaPx2 / (pxPerMmX * pxPerMmY);

  switch (unit) {
    case "mm": return areaMm2;
    case "cm": return areaMm2 / 100;
    case "in": return areaMm2 / (25.4 * 25.4);
  }
}

export function formatArea(value: number, unit: Unit): string {
  const decimals = unit === "mm" ? 1 : 2;
  return `${value.toFixed(decimals)} ${unit}²`;
}

/** Detect default unit based on browser locale. Imperial countries (US, LR, MM) get inches. */
export function detectDefaultUnit(locale: string): Unit {
  const tag = locale.split("-")[0] === "en" ? locale : "";
  if (tag === "en-US" || tag === "en-LR" || tag === "en-MM") return "in";
  return "mm";
}

/**
 * Compute the circumscribed circle through 3 points.
 * Returns { cx, cy, r } or null if points are collinear.
 */
export function circumscribedCircle(p1: Point, p2: Point, p3: Point): { cx: number; cy: number; r: number } | null {
  const ax = p1.x, ay = p1.y;
  const bx = p2.x, by = p2.y;
  const cx = p3.x, cy = p3.y;

  const D = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(D) < 1e-10) return null; // collinear

  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / D;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / D;
  const r = Math.sqrt((ax - ux) ** 2 + (ay - uy) ** 2);

  return { cx: ux, cy: uy, r };
}

/** Compute circular arc length through 3 points (start, mid, end) */
export function arcLength(start: Point, mid: Point, end: Point): number {
  const circle = circumscribedCircle(start, mid, end);
  if (!circle) return dist(start, end); // collinear fallback

  // Compute the angle subtended by the arc
  const a1 = Math.atan2(start.y - circle.cy, start.x - circle.cx);
  const a2 = Math.atan2(mid.y - circle.cy, mid.x - circle.cx);
  const a3 = Math.atan2(end.y - circle.cy, end.x - circle.cx);

  // Determine the sweep angle (the arc that passes through mid)
  let sweep = angleSweepThrough(a1, a2, a3);
  return Math.abs(sweep) * circle.r;
}

/**
 * Compute the signed sweep angle from a1 to a3 that passes through a2.
 * All angles in radians.
 */
export function angleSweepThrough(a1: number, a2: number, a3: number): number {
  // Normalize angles relative to a1
  let d2 = normalizeAngle(a2 - a1);
  let d3 = normalizeAngle(a3 - a1);

  // Check if going counterclockwise from a1 passes through a2 before a3
  if (d2 < d3) {
    // CCW direction works: a1 → a2 → a3
    return d3;
  } else {
    // CW direction: sweep is negative
    return d3 - 2 * Math.PI;
  }
}

/** Normalize angle to [0, 2π) */
export function normalizeAngle(a: number): number {
  a = a % (2 * Math.PI);
  if (a < 0) a += 2 * Math.PI;
  return a;
}

export function arcLengthToUnit(start: Point, mid: Point, end: Point, cal: Calibration | null, unit: Unit): number {
  const px = arcLength(start, mid, end);
  const pxPerMm = cal ? (cal.pxPerMmX + cal.pxPerMmY) / 2 : DEFAULT_PX_PER_MM;
  const mm = px / pxPerMm;
  switch (unit) {
    case "mm": return mm;
    case "cm": return mm / 10;
    case "in": return mm / 25.4;
  }
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function pointNear(p: Point, target: Point, threshold: number): boolean {
  return dist(p, target) <= threshold;
}

export function screenToWorld(screen: Point, panX: number, panY: number): Point {
  return { x: screen.x - panX, y: screen.y - panY };
}

export function worldToScreen(world: Point, panX: number, panY: number): Point {
  return { x: world.x + panX, y: world.y + panY };
}

/**
 * Compute the bulge point for an arc that starts tangent to `tangentDir` at `segStart`
 * and ends at `segEnd`. Returns null if points are coincident or the endpoint lies
 * along the tangent (straight line, no arc needed).
 */
export function computeTangentArcBulge(segStart: Point, segEnd: Point, tangentDir: Point): Point | null {
  const nx = -tangentDir.y;
  const ny = tangentDir.x;

  const dx = segStart.x - segEnd.x;
  const dy = segStart.y - segEnd.y;

  if (dx * dx + dy * dy < 1e-6) return null;

  const denom = 2 * (nx * dx + ny * dy);
  if (Math.abs(denom) < 1e-6) return null;

  const t = -(dx * dx + dy * dy) / denom;

  const cx = segStart.x + t * nx;
  const cy = segStart.y + t * ny;
  const r = Math.abs(t);

  const a1 = Math.atan2(segStart.y - cy, segStart.x - cx);
  const a3 = Math.atan2(segEnd.y - cy, segEnd.x - cx);

  let aMid: number;
  if (t > 0) {
    let sweep = normalizeAngle(a3 - a1);
    if (sweep === 0) sweep = 2 * Math.PI;
    aMid = a1 + sweep / 2;
  } else {
    let sweep = normalizeAngle(a1 - a3);
    if (sweep === 0) sweep = 2 * Math.PI;
    aMid = a1 - sweep / 2;
  }

  return {
    x: cx + r * Math.cos(aMid),
    y: cy + r * Math.sin(aMid),
  };
}

/** Angle (in degrees) at vertex between vectors vertex→a and vertex→b. Returns 0 if points coincide. */
export function vertexAngleDeg(a: Point, vertex: Point, b: Point): number {
  const vax = a.x - vertex.x;
  const vay = a.y - vertex.y;
  const vbx = b.x - vertex.x;
  const vby = b.y - vertex.y;

  const magA = Math.sqrt(vax * vax + vay * vay);
  const magB = Math.sqrt(vbx * vbx + vby * vby);
  if (magA < 1e-10 || magB < 1e-10) return 0;

  const cosAngle = Math.max(-1, Math.min(1, (vax * vbx + vay * vby) / (magA * magB)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

export interface VertexAngle {
  vertex: Point;
  prev: Point;   // incoming direction reference point
  next: Point;    // outgoing direction reference point
  degrees: number;
}

/** Compute the angle at every junction vertex of a polyline. For closed polylines, includes the start vertex. */
export function polylineVertexAngles(m: PolylineMeasurement): VertexAngle[] {
  const segs = m.segments;
  if (segs.length < 2) return [];

  const angles: VertexAngle[] = [];

  // Interior vertices (where segment i meets segment i+1)
  let prev = m.start;
  for (let i = 0; i < segs.length - 1; i++) {
    const vertex = segs[i]!.end;
    const next = segs[i + 1]!.end;
    angles.push({ vertex, prev, next, degrees: vertexAngleDeg(prev, vertex, next) });
    prev = vertex;
  }

  // Closed polyline: additional angles for closing loop
  if (m.closed && segs.length >= 2) {
    const lastEnd = segs[segs.length - 1]!.end;
    const hasExplicitClose = lastEnd.x === m.start.x && lastEnd.y === m.start.y;

    if (!hasExplicitClose) {
      // Closing segment was popped: angle at last vertex (→ implicit close back to start)
      angles.push({
        vertex: lastEnd,
        prev,
        next: m.start,
        degrees: vertexAngleDeg(prev, lastEnd, m.start),
      });
    }

    // Angle at start vertex
    const prevToStart = hasExplicitClose ? segs[segs.length - 2]!.end : lastEnd;
    const nextFromStart = segs[0]!.end;
    angles.push({
      vertex: m.start,
      prev: prevToStart,
      next: nextFromStart,
      degrees: vertexAngleDeg(prevToStart, m.start, nextFromStart),
    });
  }

  return angles;
}

export function gridVisibleRange(panX: number, panY: number, width: number, height: number, gridStep: number) {
  const minX = -panX;
  const minY = -panY;
  return {
    startX: Math.floor(minX / gridStep) * gridStep,
    startY: Math.floor(minY / gridStep) * gridStep,
    endX: minX + width,
    endY: minY + height,
  };
}
