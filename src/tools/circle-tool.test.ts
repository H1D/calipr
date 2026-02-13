import { describe, test, expect } from "bun:test";
import { CircleTool } from "./circle-tool";
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

describe("CircleTool", () => {
  test("first click creates active circle", () => {
    const tool = new CircleTool();
    tool.onClick({ x: 50, y: 50 }, ctx());
    expect(tool.hasActiveMeasurement()).toBe(true);
    const ds = tool.getDrawState(ctx());
    expect(ds.activeMeasurement!.kind).toBe("circle");
    if (ds.activeMeasurement!.kind === "circle") {
      expect(ds.activeMeasurement!.center).toEqual({ x: 50, y: 50 });
      expect(ds.activeMeasurement!.radiusPx).toBe(0);
    }
  });

  test("second click completes circle with correct radius", () => {
    const tool = new CircleTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    const actions = tool.onClick({ x: 30, y: 40 }, ctx());
    expect(actions.completeMeasurement).toBeDefined();
    if (actions.completeMeasurement?.kind === "circle") {
      expect(actions.completeMeasurement.radiusPx).toBeCloseTo(50, 1); // 3-4-5 triangle
    }
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("mouse move updates radius", () => {
    const tool = new CircleTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onMouseMove({ x: 100, y: 0 }, ctx());
    const ds = tool.getDrawState(ctx());
    if (ds.activeMeasurement?.kind === "circle") {
      expect(ds.activeMeasurement.radiusPx).toBeCloseTo(100, 1);
    }
  });

  test("Escape cancels active circle", () => {
    const tool = new CircleTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    const actions = tool.onKeyDown("Escape", false, ctx());
    expect(actions).toBeDefined();
    expect(actions!.completeMeasurement).toBeUndefined();
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("Escape with no active measurement returns null", () => {
    const tool = new CircleTool();
    const actions = tool.onKeyDown("Escape", false, ctx());
    expect(actions).toBeNull();
  });

  test("onDeactivate completes circle with radius > 0", () => {
    const tool = new CircleTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    tool.onMouseMove({ x: 50, y: 0 }, ctx());
    const actions = tool.onDeactivate(ctx());
    expect(actions.completeMeasurement).toBeDefined();
  });

  test("onDeactivate discards circle with radius 0", () => {
    const tool = new CircleTool();
    tool.onClick({ x: 0, y: 0 }, ctx());
    const actions = tool.onDeactivate(ctx());
    expect(actions.completeMeasurement).toBeUndefined();
  });

  test("help hint changes based on state", () => {
    const tool = new CircleTool();
    expect(tool.getHelpHint(ctx())).toContain("center");
    tool.onClick({ x: 0, y: 0 }, ctx());
    expect(tool.getHelpHint(ctx())).toContain("radius");
  });
});
