import { describe, test, expect } from "bun:test";
import { LineTool } from "./line-tool";
import type { ToolContext } from "../tool";

function ctx(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    mousePos: { x: 0, y: 0 },
    calibration: null,
    unit: "mm",
    measurements: [],
    shiftHeld: false,
    ...overrides,
  };
}

describe("LineTool", () => {
  test("first click creates active polyline measurement", () => {
    const tool = new LineTool();
    tool.onClick({ x: 50, y: 50 }, ctx());
    expect(tool.hasActiveMeasurement()).toBe(true);
    const ds = tool.getDrawState(ctx());
    expect(ds.activeMeasurement).not.toBeNull();
    expect(ds.activeMeasurement!.kind).toBe("polyline");
    if (ds.activeMeasurement!.kind === "polyline") {
      expect(ds.activeMeasurement!.start).toEqual({ x: 50, y: 50 });
      expect(ds.activeMeasurement!.segments).toHaveLength(0);
    }
  });

  test("second click adds a segment", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    const ds = tool.getDrawState(ctx());
    expect(ds.activeMeasurement!.kind).toBe("polyline");
    if (ds.activeMeasurement!.kind === "polyline") {
      expect(ds.activeMeasurement!.segments).toHaveLength(1);
      expect(ds.activeMeasurement!.segments[0]!.end).toEqual({ x: 100, y: 0 });
    }
  });

  test("Enter completes polyline with segments", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    const actions = tool.onKeyDown("Enter", false, ctx());
    expect(actions).not.toBeNull();
    expect(actions!.completeMeasurement).toBeDefined();
    expect(actions!.completeMeasurement!.kind).toBe("polyline");
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("Enter does nothing without segments", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    const actions = tool.onKeyDown("Enter", false, ctx());
    expect(actions).toBeNull();
    expect(tool.hasActiveMeasurement()).toBe(true);
  });

  test("Escape finalizes polyline with segments", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    const actions = tool.onKeyDown("Escape", false, ctx());
    expect(actions!.completeMeasurement).toBeDefined();
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("Escape cancels polyline without segments", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    const actions = tool.onKeyDown("Escape", false, ctx());
    expect(actions).toBeDefined();
    expect(actions!.completeMeasurement).toBeUndefined();
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("Escape with no active measurement returns null", () => {
    const tool = new LineTool();
    const actions = tool.onKeyDown("Escape", false, ctx());
    expect(actions).toBeNull();
  });

  test("Backspace removes last segment", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    tool.onClick({ x: 200, y: 0 }, ctx());
    tool.onKeyDown("Backspace", false, ctx());
    const ds = tool.getDrawState(ctx());
    if (ds.activeMeasurement!.kind === "polyline") {
      expect(ds.activeMeasurement!.segments).toHaveLength(1);
    }
  });

  test("Backspace with no segments returns null (defers to manager)", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    const actions = tool.onKeyDown("Backspace", false, ctx());
    expect(actions).toBeNull();
  });

  test("double-click completes polyline with segments", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    const actions = tool.onDblClick({ x: 100, y: 0 }, ctx());
    expect(actions.completeMeasurement).toBeDefined();
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("double-click with no segments does nothing", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    const actions = tool.onDblClick({ x: 0, y: 0 }, ctx());
    expect(actions.completeMeasurement).toBeUndefined();
    expect(tool.hasActiveMeasurement()).toBe(true);
  });

  test("onDeactivate finalizes active polyline with segments", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    const actions = tool.onDeactivate(ctx());
    expect(actions.completeMeasurement).toBeDefined();
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("onDeactivate discards polyline with no segments", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    const actions = tool.onDeactivate(ctx());
    expect(actions.completeMeasurement).toBeUndefined();
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("close snap: clicking near start with >= 2 segments triggers close", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 100 }, ctx());
    // Click near start — within CLOSE_SNAP_RADIUS (24px)
    tool.onClick({ x: 5, y: 5 }, ctx());
    // mouseUp finalizes the closing segment
    const actions = tool.onMouseUp({ x: 5, y: 5 }, ctx());
    expect(actions.completeMeasurement).toBeDefined();
    if (actions.completeMeasurement?.kind === "polyline") {
      expect(actions.completeMeasurement.closed).toBe(true);
    }
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("close snap: Shift bypasses close detection", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 100 }, ctx());
    // Click near start with Shift held — should add segment, not close
    tool.onClick({ x: 5, y: 5 }, ctx({ shiftHeld: true }));
    expect(tool.hasActiveMeasurement()).toBe(true);
    const ds = tool.getDrawState(ctx());
    if (ds.activeMeasurement?.kind === "polyline") {
      expect(ds.activeMeasurement.segments).toHaveLength(3);
      expect(ds.activeMeasurement.closed).toBeUndefined();
    }
  });

  test("snap guide appears during tangent-aligned mouse move", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    // Move mouse along the tangent direction (horizontal from (100,0))
    tool.onMouseMove({ x: 200, y: 1 }, ctx({ mousePos: { x: 200, y: 1 } }));
    const ds = tool.getDrawState(ctx({ mousePos: { x: 200, y: 1 } }));
    expect(ds.snapGuide).not.toBeNull();
    expect(ds.snapGuide!.snapType).toBe("tangent");
  });

  test("snap guide suppressed when Shift held", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    tool.onMouseMove({ x: 200, y: 1 }, ctx({ mousePos: { x: 200, y: 1 }, shiftHeld: true }));
    const ds = tool.getDrawState(ctx({ mousePos: { x: 200, y: 1 }, shiftHeld: true }));
    expect(ds.snapGuide).toBeNull();
  });

  test("close snap suppresses tangent/perpendicular snap guide", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 100 }, ctx());
    // Move mouse near start along a tangent-ish direction
    // The close snap should take precedence, clearing snap guide
    tool.onMouseMove({ x: 5, y: 5 }, ctx({ mousePos: { x: 5, y: 5 } }));
    const ds = tool.getDrawState(ctx({ mousePos: { x: 5, y: 5 } }));
    expect(ds.closeSnapRing).not.toBeNull();
    expect(ds.snapGuide).toBeNull(); // close snap takes precedence
  });

  test("close snap ring shown when mouse near start with >= 2 segments", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 100 }, ctx());
    tool.onMouseMove({ x: 5, y: 5 }, ctx({ mousePos: { x: 5, y: 5 } }));
    const ds = tool.getDrawState(ctx({ mousePos: { x: 5, y: 5 } }));
    expect(ds.closeSnapRing).not.toBeNull();
    expect(ds.effectiveMousePos).toEqual({ x: 0, y: 0 }); // snaps to start
  });

  test("help hint changes through polyline lifecycle", () => {
    const tool = new LineTool();
    expect(tool.getHelpHint(ctx())).toContain("first point");

    tool.onClick({ x: 0, y: 0 }, ctx());
    expect(tool.getHelpHint(ctx())).toContain("hold & drag");

    tool.onClick({ x: 100, y: 0 }, ctx());
    expect(tool.getHelpHint(ctx())).toContain("Enter");
  });

  test("mouseUp with no active arc does nothing", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    const actions = tool.onMouseUp({ x: 50, y: 50 }, ctx());
    expect(actions.completeMeasurement).toBeUndefined();
  });

  test("multiple segments accumulate correctly", () => {
    const tool = new LineTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onClick({ x: 100, y: 0 }, ctx());
    tool.onClick({ x: 200, y: 100 }, ctx());
    tool.onClick({ x: 300, y: 50 }, ctx());
    const ds = tool.getDrawState(ctx());
    if (ds.activeMeasurement?.kind === "polyline") {
      expect(ds.activeMeasurement.segments).toHaveLength(3);
    }
  });
});
