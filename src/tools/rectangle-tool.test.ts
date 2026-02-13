import { describe, test, expect } from "bun:test";
import { RectangleTool } from "./rectangle-tool";
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

describe("RectangleTool", () => {
  test("first click creates active rectangle", () => {
    const tool = new RectangleTool();
    tool.onClick({ x: 10, y: 20 }, ctx());
    expect(tool.hasActiveMeasurement()).toBe(true);
    const ds = tool.getDrawState(ctx());
    expect(ds.activeMeasurement!.kind).toBe("rectangle");
  });

  test("second click completes rectangle", () => {
    const tool = new RectangleTool();
    tool.onClick({ x: 10, y: 20 }, ctx());
    const actions = tool.onClick({ x: 110, y: 120 }, ctx());
    expect(actions.completeMeasurement).toBeDefined();
    expect(actions.completeMeasurement!.kind).toBe("rectangle");
    if (actions.completeMeasurement!.kind === "rectangle") {
      expect(actions.completeMeasurement!.points[0]).toEqual({ x: 10, y: 20 });
      expect(actions.completeMeasurement!.points[1]).toEqual({ x: 110, y: 120 });
    }
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("mouse move updates second corner", () => {
    const tool = new RectangleTool();
    tool.onClick({ x: 10, y: 20 }, ctx());
    tool.onMouseMove({ x: 200, y: 300 }, ctx());
    const ds = tool.getDrawState(ctx());
    if (ds.activeMeasurement?.kind === "rectangle") {
      expect(ds.activeMeasurement.points[1]).toEqual({ x: 200, y: 300 });
    }
  });

  test("Escape cancels active rectangle", () => {
    const tool = new RectangleTool();
    tool.onClick({ x: 10, y: 20 }, ctx());
    const actions = tool.onKeyDown("Escape", false, ctx());
    expect(actions).toBeDefined();
    expect(actions!.completeMeasurement).toBeUndefined();
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("Escape with no active measurement returns null", () => {
    const tool = new RectangleTool();
    const actions = tool.onKeyDown("Escape", false, ctx());
    expect(actions).toBeNull();
  });

  test("onDeactivate completes active rectangle", () => {
    const tool = new RectangleTool();
    tool.onClick({ x: 10, y: 20 }, ctx());
    const actions = tool.onDeactivate(ctx());
    expect(actions.completeMeasurement).toBeDefined();
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("draw state has effectiveMousePos when active", () => {
    const tool = new RectangleTool();
    tool.onClick({ x: 10, y: 20 }, ctx());
    const ds = tool.getDrawState(ctx({ mousePos: { x: 50, y: 50 } }));
    expect(ds.effectiveMousePos).toEqual({ x: 50, y: 50 });
  });

  test("draw state has null effectiveMousePos when inactive", () => {
    const tool = new RectangleTool();
    const ds = tool.getDrawState(ctx());
    expect(ds.effectiveMousePos).toBeNull();
  });

  test("help hint changes based on state", () => {
    const tool = new RectangleTool();
    expect(tool.getHelpHint(ctx())).toContain("first corner");
    tool.onClick({ x: 10, y: 20 }, ctx());
    expect(tool.getHelpHint(ctx())).toContain("opposite corner");
  });
});
