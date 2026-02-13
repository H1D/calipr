import { describe, test, expect } from "bun:test";
import { ToolManager, getMeasurementPoints, setMeasurementPoint, findHoveredPoint, removePolylinePoint } from "./tool-manager";
import { LineTool } from "./tools/line-tool";
import { RectangleTool } from "./tools/rectangle-tool";
import { CircleTool } from "./tools/circle-tool";
import { CalibrateTool } from "./tools/calibrate-tool";
import type { Measurement, PolylineMeasurement, RectangleMeasurement, CircleMeasurement } from "./types";

function createManager() {
  const mgr = new ToolManager([], null, "mm", 0, 0);
  mgr.registerTool(new LineTool());
  mgr.registerTool(new RectangleTool());
  mgr.registerTool(new CircleTool());
  mgr.registerTool(new CalibrateTool(null));
  mgr.setActiveTool("line");
  return mgr;
}

describe("ToolManager", () => {
  describe("tool switching", () => {
    test("starts with the specified active tool", () => {
      const mgr = createManager();
      expect(mgr.activeToolName).toBe("line");
    });

    test("switching tools changes active tool", () => {
      const mgr = createManager();
      mgr.setActiveTool("rectangle");
      expect(mgr.activeToolName).toBe("rectangle");
    });

    test("switching tools finalizes active measurement", () => {
      const mgr = createManager();
      // Start a polyline with a segment
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseDown({ x: 150, y: 50 });
      // Switch tool → should complete the polyline
      mgr.setActiveTool("rectangle");
      expect(mgr.measurements).toHaveLength(1);
      expect(mgr.measurements[0]!.kind).toBe("polyline");
    });

    test("switching from empty active measurement discards it", () => {
      const mgr = createManager();
      mgr.handleMouseDown({ x: 50, y: 50 });
      // Only start point, no segments
      mgr.setActiveTool("rectangle");
      expect(mgr.measurements).toHaveLength(0);
    });
  });

  describe("action processing", () => {
    test("completeMeasurement adds to measurements", () => {
      const mgr = createManager();
      mgr.processActions({
        completeMeasurement: {
          kind: "rectangle",
          id: "test-rect",
          points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        },
      });
      expect(mgr.measurements).toHaveLength(1);
    });

    test("setCalibration updates calibration", () => {
      const mgr = createManager();
      mgr.processActions({
        setCalibration: { pxPerMmX: 5, pxPerMmY: 5 },
      });
      expect(mgr.calibration).toEqual({ pxPerMmX: 5, pxPerMmY: 5 });
    });

    test("switchTool changes the active tool", () => {
      const mgr = createManager();
      mgr.processActions({ switchTool: "circle" });
      expect(mgr.activeToolName).toBe("circle");
    });
  });

  describe("drag priority", () => {
    test("clicking on a completed point starts drag instead of tool click", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "rectangle",
        id: "rect-1",
        points: [{ x: 50, y: 50 }, { x: 150, y: 150 }],
      });
      // Click right on the first point (50,50) — no pan offset
      mgr.handleMouseDown({ x: 50, y: 50 });
      expect(mgr.isDragging).toBe(true);
      expect(mgr.dragInfo).toEqual({ measurementId: "rect-1", pointIndex: 0 });
    });

    test("drag updates point position on mouse move", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "rectangle",
        id: "rect-1",
        points: [{ x: 50, y: 50 }, { x: 150, y: 150 }],
      });
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseMove({ x: 70, y: 80 });
      const rect = mgr.measurements[0]! as RectangleMeasurement;
      expect(rect.points[0]).toEqual({ x: 70, y: 80 });
    });

    test("dragging polyline last endpoint near start shows close snap", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "polyline",
        id: "poly-1",
        start: { x: 0, y: 0 },
        segments: [
          { end: { x: 100, y: 0 } },
          { end: { x: 100, y: 100 } },
        ],
      });
      // Start drag on the last endpoint (100,100) — pointIndex 2
      mgr.handleMouseDown({ x: 100, y: 100 });
      expect(mgr.isDragging).toBe(true);
      // Drag near start (0,0)
      mgr.handleMouseMove({ x: 5, y: 5 });
      const poly = mgr.measurements[0]! as PolylineMeasurement;
      // Last endpoint should snap to start
      expect(poly.segments[1]!.end).toEqual({ x: 0, y: 0 });
      expect(mgr.dragCloseSnapPoint).toEqual({ x: 0, y: 0 });
    });

    test("dragging polyline start near last endpoint shows close snap", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "polyline",
        id: "poly-1",
        start: { x: 0, y: 0 },
        segments: [
          { end: { x: 100, y: 0 } },
          { end: { x: 100, y: 100 } },
        ],
      });
      // Start drag on start point (0,0) — pointIndex 0
      mgr.handleMouseDown({ x: 0, y: 0 });
      expect(mgr.isDragging).toBe(true);
      // Drag near last endpoint (100,100)
      mgr.handleMouseMove({ x: 95, y: 95 });
      const poly = mgr.measurements[0]! as PolylineMeasurement;
      // Start should snap to last endpoint
      expect(poly.start).toEqual({ x: 100, y: 100 });
      expect(mgr.dragCloseSnapPoint).toEqual({ x: 100, y: 100 });
    });

    test("drag close snap clears on mouseUp", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "polyline",
        id: "poly-1",
        start: { x: 0, y: 0 },
        segments: [
          { end: { x: 100, y: 0 } },
          { end: { x: 100, y: 100 } },
        ],
      });
      mgr.handleMouseDown({ x: 100, y: 100 });
      mgr.handleMouseMove({ x: 5, y: 5 });
      expect(mgr.dragCloseSnapPoint).not.toBeNull();
      mgr.handleMouseUp({ x: 5, y: 5 });
      expect(mgr.dragCloseSnapPoint).toBeNull();
    });

    test("Shift bypasses drag close snap", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "polyline",
        id: "poly-1",
        start: { x: 0, y: 0 },
        segments: [
          { end: { x: 100, y: 0 } },
          { end: { x: 100, y: 100 } },
        ],
      });
      mgr.handleMouseDown({ x: 100, y: 100 });
      mgr.shiftHeld = true;
      mgr.handleMouseMove({ x: 5, y: 5 });
      const poly = mgr.measurements[0]! as PolylineMeasurement;
      // Should NOT snap — point stays at mouse position
      expect(poly.segments[1]!.end).toEqual({ x: 5, y: 5 });
      expect(mgr.dragCloseSnapPoint).toBeNull();
    });

    test("mouseUp after drag finalizes drag state", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "rectangle",
        id: "rect-1",
        points: [{ x: 50, y: 50 }, { x: 150, y: 150 }],
      });
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 70, y: 80 });
      expect(mgr.isDragging).toBe(false);
      expect(mgr.dragInfo).toBeNull();
    });
  });

  describe("dblclick point removal", () => {
    test("double-click on polyline point removes it", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "polyline",
        id: "poly-1",
        start: { x: 0, y: 0 },
        segments: [
          { end: { x: 100, y: 0 } },
          { end: { x: 200, y: 0 } },
        ],
      });
      // Position mouse on the middle endpoint (100,0)
      mgr.mousePos = { x: 100, y: 0 };
      mgr.handleDblClick();
      const poly = mgr.measurements[0]! as PolylineMeasurement;
      expect(poly.segments).toHaveLength(1);
    });

    test("removing last segment deletes measurement", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "polyline",
        id: "poly-1",
        start: { x: 0, y: 0 },
        segments: [{ end: { x: 5, y: 0 } }],
      });
      // Position mouse on start (0,0)
      mgr.mousePos = { x: 0, y: 0 };
      mgr.handleDblClick();
      expect(mgr.measurements).toHaveLength(0);
    });
  });

  describe("keyboard: Delete/Backspace", () => {
    test("deletes hovered measurement when no active tool state", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "rectangle",
        id: "rect-1",
        points: [{ x: 50, y: 50 }, { x: 150, y: 150 }],
      });
      mgr.hoveredMeasurementId = "rect-1";
      mgr.hoveredPointIdx = 0;
      mgr.handleKeyDown("Delete", false);
      expect(mgr.measurements).toHaveLength(0);
    });
  });

  describe("help hint with snap suffix", () => {
    test("appends snap suffix when snap guide is active", () => {
      const mgr = createManager();
      // Start a polyline with a segment
      mgr.handleMouseDown({ x: 0, y: 0 });
      mgr.handleMouseDown({ x: 100, y: 0 });
      // Move mouse along tangent
      mgr.handleMouseMove({ x: 200, y: 1 });
      const hint = mgr.getHelpHint();
      // If snap is active, hint should contain "Shift"
      const ds = mgr.getDrawState();
      if (ds.snapGuide) {
        expect(hint).toContain("Shift");
      }
    });
  });

  describe("clearAll", () => {
    test("clears measurements and resets tool", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "rectangle",
        id: "rect-1",
        points: [{ x: 50, y: 50 }, { x: 150, y: 150 }],
      });
      mgr.clearAll();
      expect(mgr.measurements).toHaveLength(0);
    });
  });
});

// --- Hit-testing helpers ---
describe("getMeasurementPoints", () => {
  test("polyline returns start + segment endpoints + bulge points", () => {
    const m: PolylineMeasurement = {
      kind: "polyline",
      id: "p1",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 }, bulge: { x: 50, y: 25 } },
        { end: { x: 200, y: 0 } },
      ],
    };
    const pts = getMeasurementPoints(m);
    expect(pts).toHaveLength(4); // start, bulge, end, end
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 50, y: 25 });
    expect(pts[2]).toEqual({ x: 100, y: 0 });
    expect(pts[3]).toEqual({ x: 200, y: 0 });
  });

  test("rectangle returns two corner points", () => {
    const m: RectangleMeasurement = {
      kind: "rectangle",
      id: "r1",
      points: [{ x: 10, y: 20 }, { x: 110, y: 120 }],
    };
    const pts = getMeasurementPoints(m);
    expect(pts).toHaveLength(2);
  });

  test("circle returns center and edge point", () => {
    const m: CircleMeasurement = {
      kind: "circle",
      id: "c1",
      center: { x: 100, y: 100 },
      radiusPx: 50,
    };
    const pts = getMeasurementPoints(m);
    expect(pts).toHaveLength(2);
    expect(pts[0]).toEqual({ x: 100, y: 100 });
    expect(pts[1]).toEqual({ x: 150, y: 100 });
  });
});

describe("setMeasurementPoint", () => {
  test("moves polyline start", () => {
    const m: PolylineMeasurement = {
      kind: "polyline",
      id: "p1",
      start: { x: 0, y: 0 },
      segments: [{ end: { x: 100, y: 0 } }],
    };
    setMeasurementPoint(m, 0, { x: 10, y: 10 });
    expect(m.start).toEqual({ x: 10, y: 10 });
  });

  test("moves polyline segment endpoint", () => {
    const m: PolylineMeasurement = {
      kind: "polyline",
      id: "p1",
      start: { x: 0, y: 0 },
      segments: [{ end: { x: 100, y: 0 } }],
    };
    setMeasurementPoint(m, 1, { x: 200, y: 50 });
    expect(m.segments[0]!.end).toEqual({ x: 200, y: 50 });
  });

  test("moves rectangle corner", () => {
    const m: RectangleMeasurement = {
      kind: "rectangle",
      id: "r1",
      points: [{ x: 10, y: 20 }, { x: 110, y: 120 }],
    };
    setMeasurementPoint(m, 1, { x: 200, y: 200 });
    expect(m.points[1]).toEqual({ x: 200, y: 200 });
  });

  test("moves circle center", () => {
    const m: CircleMeasurement = {
      kind: "circle",
      id: "c1",
      center: { x: 100, y: 100 },
      radiusPx: 50,
    };
    setMeasurementPoint(m, 0, { x: 200, y: 200 });
    expect(m.center).toEqual({ x: 200, y: 200 });
  });

  test("moves circle edge point (updates radius)", () => {
    const m: CircleMeasurement = {
      kind: "circle",
      id: "c1",
      center: { x: 0, y: 0 },
      radiusPx: 50,
    };
    setMeasurementPoint(m, 1, { x: 30, y: 40 });
    expect(m.radiusPx).toBeCloseTo(50, 1); // 3-4-5 triangle
  });
});

describe("findHoveredPoint", () => {
  test("finds point within hit radius", () => {
    const measurements: Measurement[] = [
      { kind: "rectangle", id: "r1", points: [{ x: 50, y: 50 }, { x: 150, y: 150 }] },
    ];
    const hit = findHoveredPoint(measurements, { x: 52, y: 48 });
    expect(hit).not.toBeNull();
    expect(hit!.measurementId).toBe("r1");
    expect(hit!.pointIndex).toBe(0);
  });

  test("returns null when no point is near", () => {
    const measurements: Measurement[] = [
      { kind: "rectangle", id: "r1", points: [{ x: 50, y: 50 }, { x: 150, y: 150 }] },
    ];
    const hit = findHoveredPoint(measurements, { x: 500, y: 500 });
    expect(hit).toBeNull();
  });

  test("returns topmost measurement first (reverse order)", () => {
    const measurements: Measurement[] = [
      { kind: "rectangle", id: "r1", points: [{ x: 50, y: 50 }, { x: 150, y: 150 }] },
      { kind: "rectangle", id: "r2", points: [{ x: 50, y: 50 }, { x: 250, y: 250 }] },
    ];
    const hit = findHoveredPoint(measurements, { x: 50, y: 50 });
    expect(hit!.measurementId).toBe("r2"); // last = topmost
  });
});

describe("removePolylinePoint", () => {
  test("removes bulge (converts arc to straight)", () => {
    const m: PolylineMeasurement = {
      kind: "polyline",
      id: "p1",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 }, bulge: { x: 50, y: 25 } },
      ],
    };
    removePolylinePoint(m, 1); // bulge is point index 1
    expect(m.segments[0]!.bulge).toBeUndefined();
  });

  test("removes start point (shifts first segment)", () => {
    const m: PolylineMeasurement = {
      kind: "polyline",
      id: "p1",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 } },
        { end: { x: 200, y: 0 } },
      ],
    };
    removePolylinePoint(m, 0);
    expect(m.start).toEqual({ x: 100, y: 0 });
    expect(m.segments).toHaveLength(1);
  });

  test("removes last segment endpoint", () => {
    const m: PolylineMeasurement = {
      kind: "polyline",
      id: "p1",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 } },
        { end: { x: 200, y: 0 } },
      ],
    };
    removePolylinePoint(m, 2); // second endpoint
    expect(m.segments).toHaveLength(1);
  });
});
