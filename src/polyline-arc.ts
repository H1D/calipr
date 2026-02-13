import type { Point, PolylineMeasurement } from "./types";
import { dist, pointNear, computeTangentArcBulge, circumscribedCircle, angleSweepThrough } from "./utils";

export const POINT_HIT_RADIUS = 10;
export const CLOSE_SNAP_RADIUS = 24;

/** Get the tangent direction at the end of the previous segment (= start of segment at segIdx) */
export function getPrevTangent(m: PolylineMeasurement, segIdx: number): Point {
  if (segIdx === 0) {
    return { x: 1, y: 0 };
  }
  const prevSeg = m.segments[segIdx - 1]!;
  const prevStart = segIdx >= 2 ? m.segments[segIdx - 2]!.end : m.start;

  let dx: number, dy: number;
  if (prevSeg.bulge) {
    const circle = circumscribedCircle(prevStart, prevSeg.bulge, prevSeg.end);
    if (circle) {
      const rx = prevSeg.end.x - circle.cx;
      const ry = prevSeg.end.y - circle.cy;
      const a1 = Math.atan2(prevStart.y - circle.cy, prevStart.x - circle.cx);
      const a2 = Math.atan2(prevSeg.bulge.y - circle.cy, prevSeg.bulge.x - circle.cx);
      const a3 = Math.atan2(prevSeg.end.y - circle.cy, prevSeg.end.x - circle.cx);
      const sweep = angleSweepThrough(a1, a2, a3);
      if (sweep >= 0) {
        dx = -ry; dy = rx;
      } else {
        dx = ry; dy = -rx;
      }
    } else {
      dx = prevSeg.end.x - prevStart.x;
      dy = prevSeg.end.y - prevStart.y;
    }
  } else {
    dx = prevSeg.end.x - prevStart.x;
    dy = prevSeg.end.y - prevStart.y;
  }
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.001) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

/** Result of the arc hold timeout — what to do when the user holds the mouse */
export interface ArcHoldResult {
  addNewSegment: boolean;
  newSegmentEnd?: Point;
}

/**
 * Decide what happens when the arc timeout fires.
 * - If the last segment is short (near previous endpoint), convert it to arc in-place.
 * - If the last segment is long, keep it straight and add a new arc segment.
 */
export function computeArcHoldAction(
  m: PolylineMeasurement,
  mousePos: Point,
): ArcHoldResult {
  const segs = m.segments;
  if (segs.length === 0) return { addNewSegment: false };
  const lastSeg = segs[segs.length - 1]!;
  const prevEnd = segs.length >= 2 ? segs[segs.length - 2]!.end : m.start;
  if (dist(prevEnd, lastSeg.end) > POINT_HIT_RADIUS) {
    return { addNewSegment: true, newSegmentEnd: { ...mousePos } };
  }
  return { addNewSegment: false };
}

/**
 * Update the arc segment during mouse movement.
 * For closing arcs: mouse directly controls bulge.
 * For normal arcs: endpoint follows mouse, bulge is tangent-constrained.
 */
export function updateArcSegment(
  m: PolylineMeasurement,
  mousePos: Point,
  isClosing: boolean,
): void {
  if (m.segments.length === 0) return;
  const lastSeg = m.segments[m.segments.length - 1]!;
  if (isClosing) {
    lastSeg.bulge = mousePos;
  } else {
    lastSeg.end = mousePos;
    const segIdx = m.segments.length - 1;
    const segStart = segIdx >= 1
      ? m.segments[segIdx - 1]!.end
      : m.start;
    const tangentDir = getPrevTangent(m, segIdx);
    const bulge = computeTangentArcBulge(segStart, mousePos, tangentDir);
    if (bulge) {
      lastSeg.bulge = bulge;
    } else {
      delete lastSeg.bulge;
    }
  }
}

/**
 * Check if close snap should be active (mouse near start with enough segments).
 */
export function shouldCloseSnap(
  m: PolylineMeasurement,
  mousePos: Point,
  shiftHeld: boolean,
  isClosing: boolean,
): boolean {
  return !shiftHeld && !isClosing
    && m.segments.length >= 2
    && pointNear(mousePos, m.start, CLOSE_SNAP_RADIUS);
}

/**
 * Snap the arc endpoint to the polyline start and recompute the bulge
 * for the snapped endpoint position.
 */
export function snapArcToClose(m: PolylineMeasurement): void {
  if (m.segments.length === 0) return;
  const lastSeg = m.segments[m.segments.length - 1]!;
  lastSeg.end = { ...m.start };
  const segIdx = m.segments.length - 1;
  const segStart = segIdx >= 1
    ? m.segments[segIdx - 1]!.end
    : m.start;
  const tangentDir = getPrevTangent(m, segIdx);
  const bulge = computeTangentArcBulge(segStart, m.start, tangentDir);
  if (bulge) {
    lastSeg.bulge = bulge;
  } else {
    delete lastSeg.bulge;
  }
}

/** Result of finalizing an arc on mouseup */
export interface ArcReleaseResult {
  closed: boolean;
  removedDegenerate: boolean;
}

/**
 * Finalize the arc on mouse release.
 * - Check if arc endpoint landed near start → close polygon.
 * - Remove degenerate arc (new-segment mode, user held but barely moved).
 */
export function finalizeArc(
  m: PolylineMeasurement,
  shiftHeld: boolean,
  wasNewSegment: boolean,
): ArcReleaseResult {
  // Check if arc endpoint landed near start → close polygon
  if (m.segments.length >= 2) {
    const lastSeg = m.segments[m.segments.length - 1]!;
    if (!shiftHeld && pointNear(lastSeg.end, m.start, CLOSE_SNAP_RADIUS)) {
      lastSeg.end = { ...m.start };
      m.closed = true;
      return { closed: true, removedDegenerate: false };
    }
  }
  // Remove degenerate arc segment — only for new-segment mode
  if (wasNewSegment && m.segments.length >= 2) {
    const lastSeg = m.segments[m.segments.length - 1]!;
    const prevEnd = m.segments[m.segments.length - 2]!.end;
    if (dist(prevEnd, lastSeg.end) < 2) {
      m.segments.pop();
      return { closed: false, removedDegenerate: true };
    }
  }
  return { closed: false, removedDegenerate: false };
}
