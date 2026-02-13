import { describe, test, expect } from "bun:test";
import type { PolylineMeasurement } from "./types";
import {
  getPrevTangent,
  computeArcHoldAction,
  updateArcSegment,
  shouldCloseSnap,
  snapArcToClose,
  finalizeArc,
  POINT_HIT_RADIUS,
  CLOSE_SNAP_RADIUS,
} from "./polyline-arc";
import { circumscribedCircle } from "./utils";

// --- Helper to build polyline measurements for tests ---
function polyline(start: { x: number; y: number }, segments: Array<{ end: { x: number; y: number }; bulge?: { x: number; y: number } }>): PolylineMeasurement {
  return { kind: "polyline", id: "test", start, segments };
}

// ─────────────────────────────────────────────────────────
// getPrevTangent
// ─────────────────────────────────────────────────────────
describe("getPrevTangent", () => {
  test("first segment returns default horizontal tangent", () => {
    const m = polyline({ x: 0, y: 0 }, [{ end: { x: 10, y: 0 } }]);
    const t = getPrevTangent(m, 0);
    expect(t.x).toBeCloseTo(1, 3);
    expect(t.y).toBeCloseTo(0, 3);
  });

  test("straight segment tangent is segment direction", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 10, y: 0 } },
      { end: { x: 20, y: 0 } },
    ]);
    const t = getPrevTangent(m, 1);
    expect(t.x).toBeCloseTo(1, 3);
    expect(t.y).toBeCloseTo(0, 3);
  });

  test("diagonal straight segment tangent", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 10, y: 10 } },
      { end: { x: 20, y: 20 } },
    ]);
    const t = getPrevTangent(m, 1);
    expect(t.x).toBeCloseTo(Math.SQRT1_2, 3);
    expect(t.y).toBeCloseTo(Math.SQRT1_2, 3);
  });

  test("arc segment tangent is perpendicular to radius at endpoint", () => {
    // Semicircle: (0,0) through (5,5) to (10,0), center at (5,0), r=5
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 10, y: 0 }, bulge: { x: 5, y: 5 } },
      { end: { x: 20, y: 0 } },
    ]);
    const t = getPrevTangent(m, 1);
    // At (10,0) on circle centered (5,0): radius = (5,0), CCW tangent = (0,5) → normalized (0,1)
    // But the sweep is CCW (passes through (5,5)), so tangent should point downward: (0, -1)?
    // Let me verify: radius (10,0)-(5,0)=(5,0). CCW: tangent=(-0,5)=(0,5)→(0,1). Wait...
    // sweep through (5,5): a1=atan2(0-0,0-5)=π, a2=atan2(5-0,5-5)=π/2, a3=atan2(0-0,10-5)=0
    // sweep = angleSweepThrough(π, π/2, 0) → d2=normalizeAngle(π/2-π)=3π/2, d3=normalizeAngle(-π)=π
    // d2(3π/2) > d3(π) → CW → sweep = π - 2π = -π
    // CW tangent: (ry, -rx) = (0, -5) → normalized (0, -1)
    expect(t.x).toBeCloseTo(0, 2);
    expect(t.y).toBeCloseTo(-1, 2);
  });
});

// ─────────────────────────────────────────────────────────
// computeArcHoldAction — hybrid near/far decision
// ─────────────────────────────────────────────────────────
describe("computeArcHoldAction", () => {
  test("near click (< POINT_HIT_RADIUS) → in-place, no new segment", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 103, y: 0 } }, // 3px from prev end, < 10
    ]);
    const result = computeArcHoldAction(m, { x: 110, y: 10 });
    expect(result.addNewSegment).toBe(false);
  });

  test("far click (> POINT_HIT_RADIUS) → add new segment", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 200, y: 0 } }, // 100px from prev end, > 10
    ]);
    const result = computeArcHoldAction(m, { x: 210, y: 10 });
    expect(result.addNewSegment).toBe(true);
    expect(result.newSegmentEnd).toEqual({ x: 210, y: 10 });
  });

  test("exactly at POINT_HIT_RADIUS → in-place", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100 + POINT_HIT_RADIUS, y: 0 } },
    ]);
    const result = computeArcHoldAction(m, { x: 120, y: 0 });
    expect(result.addNewSegment).toBe(false);
  });

  test("first segment far from start → add new segment", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 50, y: 50 } }, // 70px from start
    ]);
    const result = computeArcHoldAction(m, { x: 60, y: 60 });
    expect(result.addNewSegment).toBe(true);
  });

  test("first segment near start → in-place", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 3, y: 4 } }, // 5px from start, < 10
    ]);
    const result = computeArcHoldAction(m, { x: 10, y: 10 });
    expect(result.addNewSegment).toBe(false);
  });

  test("empty segments → no new segment", () => {
    const m = polyline({ x: 0, y: 0 }, []);
    const result = computeArcHoldAction(m, { x: 10, y: 10 });
    expect(result.addNewSegment).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// updateArcSegment — tangent-constrained bulge
// ─────────────────────────────────────────────────────────
describe("updateArcSegment", () => {
  test("closing arc: bulge is set to mouse position directly", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 0, y: 0 } }, // closing segment
    ]);
    updateArcSegment(m, { x: 50, y: -30 }, true);
    expect(m.segments[1]!.bulge).toEqual({ x: 50, y: -30 });
    // endpoint stays unchanged for closing
    expect(m.segments[1]!.end).toEqual({ x: 0, y: 0 });
  });

  test("normal arc: endpoint follows mouse, bulge is tangent-constrained", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 0 } }, // will be updated
    ]);
    updateArcSegment(m, { x: 150, y: 50 }, false);
    expect(m.segments[1]!.end).toEqual({ x: 150, y: 50 });
    expect(m.segments[1]!.bulge).toBeDefined();
    // The arc should be tangent to the previous segment (horizontal at (100,0))
    const bulge = m.segments[1]!.bulge!;
    const circle = circumscribedCircle({ x: 100, y: 0 }, bulge, { x: 150, y: 50 });
    expect(circle).not.toBeNull();
  });

  test("endpoint on tangent line → no bulge (straight)", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 0 } },
    ]);
    // mouse directly ahead along the tangent direction (horizontal)
    updateArcSegment(m, { x: 200, y: 0 }, false);
    expect(m.segments[1]!.end).toEqual({ x: 200, y: 0 });
    expect(m.segments[1]!.bulge).toBeUndefined();
  });

  test("arc after arc: tangent is continuous", () => {
    // First arc: (0,0) through (5,5) to (10,0) — center (5,0)
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 10, y: 0 }, bulge: { x: 5, y: 5 } },
      { end: { x: 10, y: 0 } }, // will be updated
    ]);
    updateArcSegment(m, { x: 15, y: -5 }, false);
    // The new arc should start tangent to the first arc at (10,0)
    const bulge = m.segments[1]!.bulge!;
    expect(bulge).toBeDefined();
    // Verify the arc passes through the bulge
    const circle = circumscribedCircle({ x: 10, y: 0 }, bulge, { x: 15, y: -5 });
    expect(circle).not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────
// shouldCloseSnap
// ─────────────────────────────────────────────────────────
describe("shouldCloseSnap", () => {
  test("active when mouse near start with >= 2 segments", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
    ]);
    expect(shouldCloseSnap(m, { x: 5, y: 5 }, false, false)).toBe(true);
  });

  test("inactive with < 2 segments", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
    ]);
    expect(shouldCloseSnap(m, { x: 1, y: 1 }, false, false)).toBe(false);
  });

  test("inactive when mouse far from start", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
    ]);
    expect(shouldCloseSnap(m, { x: 200, y: 200 }, false, false)).toBe(false);
  });

  test("inactive when shift held", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
    ]);
    expect(shouldCloseSnap(m, { x: 1, y: 1 }, true, false)).toBe(false);
  });

  test("inactive during closing segment", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
    ]);
    expect(shouldCloseSnap(m, { x: 1, y: 1 }, false, true)).toBe(false);
  });

  test("active at exact CLOSE_SNAP_RADIUS boundary", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
    ]);
    expect(shouldCloseSnap(m, { x: CLOSE_SNAP_RADIUS, y: 0 }, false, false)).toBe(true);
  });

  test("inactive just outside CLOSE_SNAP_RADIUS", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
    ]);
    expect(shouldCloseSnap(m, { x: CLOSE_SNAP_RADIUS + 1, y: 0 }, false, false)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// snapArcToClose — snap endpoint to start and recompute bulge
// ─────────────────────────────────────────────────────────
describe("snapArcToClose", () => {
  test("snaps endpoint to polyline start", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
      { end: { x: 20, y: 10 } }, // near start, will be snapped
    ]);
    snapArcToClose(m);
    expect(m.segments[2]!.end).toEqual({ x: 0, y: 0 });
  });

  test("recomputes bulge for snapped endpoint", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
      { end: { x: 20, y: 10 }, bulge: { x: 50, y: 50 } }, // old bulge
    ]);
    snapArcToClose(m);
    // Bulge should be recomputed for endpoint = (0,0), not the old position
    const bulge = m.segments[2]!.bulge;
    expect(bulge).toBeDefined();
    // Old bulge (50,50) should not survive
    expect(bulge!.x).not.toBeCloseTo(50, 0);
    expect(bulge!.y).not.toBeCloseTo(50, 0);
  });

  test("removes bulge when endpoint equals segment start (degenerate)", () => {
    // If last seg start === polyline start, computeTangentArcBulge returns null
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 0, y: 0 } }, // segment start = polyline start
      { end: { x: 50, y: 50 } },
    ]);
    snapArcToClose(m);
    // endpoint snaps to (0,0), segStart is (0,0) → coincident → bulge removed
    expect(m.segments[1]!.bulge).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────
// finalizeArc — mouseup behavior
// ─────────────────────────────────────────────────────────
describe("finalizeArc", () => {
  test("closes polygon when arc endpoint is near start", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
      { end: { x: 5, y: 5 } }, // within CLOSE_SNAP_RADIUS of start
    ]);
    const result = finalizeArc(m, false, false);
    expect(result.closed).toBe(true);
    expect(m.closed).toBe(true);
    expect(m.segments[2]!.end).toEqual({ x: 0, y: 0 });
  });

  test("does NOT close when shift is held", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
      { end: { x: 5, y: 5 } },
    ]);
    const result = finalizeArc(m, true, false);
    expect(result.closed).toBe(false);
    expect(m.closed).toBeUndefined();
  });

  test("does NOT close when < 2 segments", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 5, y: 5 } },
    ]);
    const result = finalizeArc(m, false, false);
    expect(result.closed).toBe(false);
  });

  test("removes degenerate arc in new-segment mode", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 101, y: 0 } }, // degenerate: 1px from prev, < 2
    ]);
    const result = finalizeArc(m, false, true);
    expect(result.removedDegenerate).toBe(true);
    expect(m.segments.length).toBe(1); // arc segment removed
  });

  test("does NOT remove degenerate arc in in-place mode", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 101, y: 0 } }, // close to prev, but wasNewSegment=false
    ]);
    const result = finalizeArc(m, false, false);
    expect(result.removedDegenerate).toBe(false);
    expect(m.segments.length).toBe(2); // segment preserved
  });

  test("does NOT remove non-degenerate arc in new-segment mode", () => {
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 150, y: 50 } }, // 70px from prev, not degenerate
    ]);
    const result = finalizeArc(m, false, true);
    expect(result.removedDegenerate).toBe(false);
    expect(m.segments.length).toBe(2);
  });

  test("close takes priority over degenerate removal", () => {
    // Arc endpoint near start AND it's a new segment — close should win
    const m = polyline({ x: 0, y: 0 }, [
      { end: { x: 100, y: 0 } },
      { end: { x: 100, y: 100 } },
      { end: { x: 3, y: 4 } }, // near start (5px < CLOSE_SNAP_RADIUS)
    ]);
    const result = finalizeArc(m, false, true);
    expect(result.closed).toBe(true);
    expect(result.removedDegenerate).toBe(false);
    expect(m.segments.length).toBe(3); // NOT removed
  });
});
