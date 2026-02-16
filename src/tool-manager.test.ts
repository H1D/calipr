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
      // Deferred drag: dragInfo set but isDragging not yet true
      expect(mgr.dragInfo).toEqual({ measurementId: "rect-1", pointIndex: 0 });
      expect(mgr.isDragging).toBe(false);
      // Move past 3px threshold to promote to drag
      mgr.handleMouseMove({ x: 54, y: 50 });
      expect(mgr.isDragging).toBe(true);
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
      // Drag near start (0,0) — distance exceeds threshold, promotes to drag
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
      // Drag near last endpoint (100,100) — distance exceeds threshold, promotes to drag
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

  describe("dblclick removes selected polyline point", () => {
    test("dblclick on selected polyline point removes only that point", () => {
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
      // Click to select start
      mgr.handleMouseDown({ x: 0, y: 0 });
      mgr.handleMouseUp({ x: 0, y: 0 });
      expect(mgr.selectedMeasurementId).toBe("poly-1");

      // 2nd click + dblclick
      mgr.handleMouseDown({ x: 0, y: 0 });
      mgr.handleMouseUp({ x: 0, y: 0 });

      mgr.handleDblClick();
      // Point removed, but measurement survives
      expect(mgr.measurements).toHaveLength(1);
      const poly = mgr.measurements[0]! as PolylineMeasurement;
      expect(poly.segments).toHaveLength(1);
      expect(mgr.selectedMeasurementId).toBeNull();
    });

    test("dblclick on selected polyline with 1 segment deletes measurement", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "polyline",
        id: "poly-1",
        start: { x: 0, y: 0 },
        segments: [{ end: { x: 5, y: 0 } }],
      });
      mgr.handleMouseDown({ x: 0, y: 0 });
      mgr.handleMouseUp({ x: 0, y: 0 });
      mgr.handleMouseDown({ x: 0, y: 0 });
      mgr.handleMouseUp({ x: 0, y: 0 });
      mgr.handleDblClick();
      // 0 segments left → measurement deleted
      expect(mgr.measurements).toHaveLength(0);
    });

    test("dblclick on selected rectangle does NOT remove point", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "rectangle",
        id: "rect-1",
        points: [{ x: 50, y: 50 }, { x: 150, y: 150 }],
      });
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      mgr.handleDblClick();
      // Rectangle points are not individually removable
      expect(mgr.measurements).toHaveLength(1);
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

    test("bumps saveVersion", () => {
      const mgr = createManager();
      const before = mgr.saveVersion;
      mgr.measurements.push({
        kind: "rectangle",
        id: "rect-1",
        points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
      });
      mgr.clearAll();
      expect(mgr.saveVersion).toBeGreaterThan(before);
    });
  });

  describe("selection", () => {
    function managerWithRect() {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "rectangle",
        id: "rect-1",
        points: [{ x: 50, y: 50 }, { x: 150, y: 150 }],
      });
      return mgr;
    }

    function managerWithTriangle() {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "polyline",
        id: "poly-1",
        start: { x: 0, y: 0 },
        segments: [
          { end: { x: 100, y: 0 } },
          { end: { x: 50, y: 80 } },
        ],
      });
      return mgr;
    }

    test("click on point selects it (mouseDown + mouseUp below threshold)", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      expect(mgr.selectedMeasurementId).toBe("rect-1");
      expect(mgr.selectedPointIdx).toBe(0);
    });

    test("click on empty space clears selection", () => {
      const mgr = managerWithRect();
      // Select first
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      expect(mgr.selectedMeasurementId).toBe("rect-1");
      // Click empty space
      mgr.handleMouseDown({ x: 500, y: 500 });
      expect(mgr.selectedMeasurementId).toBeNull();
      expect(mgr.selectedPointIdx).toBeNull();
    });

    test("drag past threshold does NOT select", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseMove({ x: 70, y: 80 }); // > 3px threshold
      mgr.handleMouseUp({ x: 70, y: 80 });
      expect(mgr.selectedMeasurementId).toBeNull();
    });

    test("switching tools clears selection", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      expect(mgr.selectedMeasurementId).toBe("rect-1");
      mgr.setActiveTool("circle");
      expect(mgr.selectedMeasurementId).toBeNull();
    });

    test("getSelectedPointPos returns point coords when selected", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      expect(mgr.getSelectedPointPos()).toEqual({ x: 50, y: 50 });
    });

    test("getSelectedPointPos returns null when nothing selected", () => {
      const mgr = managerWithRect();
      expect(mgr.getSelectedPointPos()).toBeNull();
    });

    test("ArrowRight nudges +0.5 in x", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      mgr.handleKeyDown("ArrowRight", false);
      const rect = mgr.measurements[0]! as RectangleMeasurement;
      expect(rect.points[0]).toEqual({ x: 50.5, y: 50 });
    });

    test("ArrowLeft nudges -0.5 in x", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      mgr.handleKeyDown("ArrowLeft", false);
      const rect = mgr.measurements[0]! as RectangleMeasurement;
      expect(rect.points[0]).toEqual({ x: 49.5, y: 50 });
    });

    test("ArrowUp nudges -0.5 in y", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      mgr.handleKeyDown("ArrowUp", false);
      const rect = mgr.measurements[0]! as RectangleMeasurement;
      expect(rect.points[0]).toEqual({ x: 50, y: 49.5 });
    });

    test("ArrowDown nudges +0.5 in y", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      mgr.handleKeyDown("ArrowDown", false);
      const rect = mgr.measurements[0]! as RectangleMeasurement;
      expect(rect.points[0]).toEqual({ x: 50, y: 50.5 });
    });

    test("nudge sets nudgeHideLabelsUntil", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      mgr.handleKeyDown("ArrowRight", false);
      expect(mgr.nudgeHideLabelsUntil).toBeGreaterThan(Date.now());
    });

    test("nudge bumps saveVersion", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      const before = mgr.saveVersion;
      mgr.handleKeyDown("ArrowRight", false);
      expect(mgr.saveVersion).toBeGreaterThan(before);
    });

    test("arrow keys do nothing without selection", () => {
      const mgr = managerWithRect();
      const result = mgr.handleKeyDown("ArrowRight", false);
      const rect = mgr.measurements[0]! as RectangleMeasurement;
      expect(rect.points[0]).toEqual({ x: 50, y: 50 });
      expect(result).toBeNull();
    });

    test("Tab cycles to next point", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      expect(mgr.selectedPointIdx).toBe(0);
      mgr.handleKeyDown("Tab", false);
      expect(mgr.selectedPointIdx).toBe(1);
    });

    test("Tab wraps around to first point", () => {
      const mgr = managerWithRect();
      // Select second point
      mgr.handleMouseDown({ x: 150, y: 150 });
      mgr.handleMouseUp({ x: 150, y: 150 });
      expect(mgr.selectedPointIdx).toBe(1);
      mgr.handleKeyDown("Tab", false);
      expect(mgr.selectedPointIdx).toBe(0);
    });

    test("Tab cycles through polyline points", () => {
      const mgr = managerWithTriangle();
      // Select start (0,0)
      mgr.handleMouseDown({ x: 0, y: 0 });
      mgr.handleMouseUp({ x: 0, y: 0 });
      expect(mgr.selectedPointIdx).toBe(0);
      mgr.handleKeyDown("Tab", false);
      expect(mgr.selectedPointIdx).toBe(1);
      mgr.handleKeyDown("Tab", false);
      expect(mgr.selectedPointIdx).toBe(2);
      mgr.handleKeyDown("Tab", false);
      expect(mgr.selectedPointIdx).toBe(0); // wraps
    });

    test("Escape clears selection", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      expect(mgr.selectedMeasurementId).toBe("rect-1");
      mgr.handleKeyDown("Escape", false);
      expect(mgr.selectedMeasurementId).toBeNull();
      expect(mgr.selectedPointIdx).toBeNull();
    });

    test("Delete removes selected measurement", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      mgr.handleKeyDown("Delete", false);
      expect(mgr.measurements).toHaveLength(0);
      expect(mgr.selectedMeasurementId).toBeNull();
    });

    test("Backspace removes selected measurement", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      mgr.handleKeyDown("Backspace", false);
      expect(mgr.measurements).toHaveLength(0);
    });

    test("Delete on selected polyline point removes only that point", () => {
      const mgr = managerWithTriangle();
      // Select middle endpoint (100, 0) — pointIndex 1
      mgr.handleMouseDown({ x: 100, y: 0 });
      mgr.handleMouseUp({ x: 100, y: 0 });
      expect(mgr.selectedMeasurementId).toBe("poly-1");
      expect(mgr.selectedPointIdx).toBe(1);
      mgr.handleKeyDown("Delete", false);
      // Measurement still exists with 1 fewer segment
      expect(mgr.measurements).toHaveLength(1);
      const poly = mgr.measurements[0]! as PolylineMeasurement;
      expect(poly.segments).toHaveLength(1);
      expect(mgr.selectedMeasurementId).toBeNull();
    });

    test("Delete on selected polyline start removes start, shifts to next", () => {
      const mgr = managerWithTriangle();
      // Select start (0, 0)
      mgr.handleMouseDown({ x: 0, y: 0 });
      mgr.handleMouseUp({ x: 0, y: 0 });
      mgr.handleKeyDown("Delete", false);
      expect(mgr.measurements).toHaveLength(1);
      const poly = mgr.measurements[0]! as PolylineMeasurement;
      expect(poly.start).toEqual({ x: 100, y: 0 });
      expect(poly.segments).toHaveLength(1);
    });

    test("Delete on selected polyline with 1 segment deletes entire measurement", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "polyline",
        id: "poly-1",
        start: { x: 0, y: 0 },
        segments: [{ end: { x: 100, y: 0 } }],
      });
      // Select start
      mgr.handleMouseDown({ x: 0, y: 0 });
      mgr.handleMouseUp({ x: 0, y: 0 });
      mgr.handleKeyDown("Delete", false);
      // Removing start leaves 0 segments → measurement deleted
      expect(mgr.measurements).toHaveLength(0);
    });

    test("Delete on selected polyline bulge removes only the bulge", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "polyline",
        id: "poly-arc",
        start: { x: 0, y: 0 },
        segments: [
          { end: { x: 100, y: 0 }, bulge: { x: 50, y: 25 } },
          { end: { x: 200, y: 0 } },
        ],
      });
      // Select the bulge point (50, 25) — pointIndex 1
      mgr.handleMouseDown({ x: 50, y: 25 });
      mgr.handleMouseUp({ x: 50, y: 25 });
      expect(mgr.selectedPointIdx).toBe(1);
      mgr.handleKeyDown("Delete", false);
      expect(mgr.measurements).toHaveLength(1);
      const poly = mgr.measurements[0]! as PolylineMeasurement;
      // Bulge removed, arc → straight; segments count unchanged
      expect(poly.segments).toHaveLength(2);
      expect(poly.segments[0]!.bulge).toBeUndefined();
    });

    test("help hint shows selection shortcuts when selected", () => {
      const mgr = managerWithRect();
      mgr.handleMouseDown({ x: 50, y: 50 });
      mgr.handleMouseUp({ x: 50, y: 50 });
      const hint = mgr.getHelpHint();
      expect(hint).toContain("nudge");
      expect(hint).toContain("Tab");
      expect(hint).toContain("Del");
      expect(hint).toContain("Esc");
    });
  });

  describe("saveVersion", () => {
    test("increments on measurement completion", () => {
      const mgr = createManager();
      const before = mgr.saveVersion;
      mgr.processActions({
        completeMeasurement: {
          kind: "rectangle",
          id: "r1",
          points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
        },
      });
      expect(mgr.saveVersion).toBe(before + 1);
    });

    test("increments on drag move", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "rectangle",
        id: "rect-1",
        points: [{ x: 50, y: 50 }, { x: 150, y: 150 }],
      });
      mgr.handleMouseDown({ x: 50, y: 50 });
      const before = mgr.saveVersion;
      mgr.handleMouseMove({ x: 70, y: 80 }); // exceeds threshold + drags
      expect(mgr.saveVersion).toBeGreaterThan(before);
    });

    test("increments on delete hovered", () => {
      const mgr = createManager();
      mgr.measurements.push({
        kind: "rectangle",
        id: "rect-1",
        points: [{ x: 50, y: 50 }, { x: 150, y: 150 }],
      });
      mgr.hoveredMeasurementId = "rect-1";
      mgr.hoveredPointIdx = 0;
      const before = mgr.saveVersion;
      mgr.handleKeyDown("Delete", false);
      expect(mgr.saveVersion).toBeGreaterThan(before);
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

  test("closed polyline with arc does NOT duplicate start/end point", () => {
    // Triangle closed with an arc: last segment end === start
    const m: PolylineMeasurement = {
      kind: "polyline",
      id: "p-closed-arc",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 } },
        { end: { x: 50, y: 80 } },
        { end: { x: 0, y: 0 }, bulge: { x: 10, y: 40 } }, // closing arc
      ],
      closed: true,
    };
    const pts = getMeasurementPoints(m);
    // Should be: start(0,0), end1(100,0), end2(50,80), bulge(10,40)
    // Should NOT include closing segment's end (duplicate of start)
    expect(pts).toHaveLength(4);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 100, y: 0 });
    expect(pts[2]).toEqual({ x: 50, y: 80 });
    expect(pts[3]).toEqual({ x: 10, y: 40 });
  });

  test("closed polyline WITHOUT arc (closing segment popped) keeps all vertices", () => {
    // LineTool pops the straight closing segment on close, so the data looks like:
    // segments = [{end: B}, {end: C}], closed = true
    // C is a REAL vertex, not a duplicate of start — must NOT be skipped.
    const m: PolylineMeasurement = {
      kind: "polyline",
      id: "p-closed-straight",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 } },
        { end: { x: 50, y: 80 } },
      ],
      closed: true,
    };
    const pts = getMeasurementPoints(m);
    // Should be 3 points: start(0,0), B(100,0), C(50,80)
    expect(pts).toHaveLength(3);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[1]).toEqual({ x: 100, y: 0 });
    expect(pts[2]).toEqual({ x: 50, y: 80 });
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

  test("moving start of closed polyline with arc updates closing segment end", () => {
    const m: PolylineMeasurement = {
      kind: "polyline",
      id: "p-closed",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 } },
        { end: { x: 50, y: 80 } },
        { end: { x: 0, y: 0 }, bulge: { x: 10, y: 40 } },
      ],
      closed: true,
    };
    setMeasurementPoint(m, 0, { x: 5, y: 5 });
    expect(m.start).toEqual({ x: 5, y: 5 });
    // The closing segment's end must track the start
    expect(m.segments[2]!.end).toEqual({ x: 5, y: 5 });
  });

  test("moving start of closed polyline WITHOUT arc does NOT overwrite last vertex", () => {
    // LineTool pops the closing segment — last seg end is a real vertex, not a duplicate
    const m: PolylineMeasurement = {
      kind: "polyline",
      id: "p-closed-noarc",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 } },
        { end: { x: 50, y: 80 } },
      ],
      closed: true,
    };
    setMeasurementPoint(m, 0, { x: 5, y: 5 });
    expect(m.start).toEqual({ x: 5, y: 5 });
    // Vertex C must NOT be overwritten — it's a real vertex, not a closing duplicate
    expect(m.segments[1]!.end).toEqual({ x: 50, y: 80 });
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
