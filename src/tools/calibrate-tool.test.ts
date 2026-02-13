import { describe, test, expect } from "bun:test";
import { CalibrateTool } from "./calibrate-tool";
import { CREDIT_CARD_WIDTH_MM, CREDIT_CARD_HEIGHT_MM, DEFAULT_PX_PER_MM } from "../types";
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

describe("CalibrateTool", () => {
  test("initializes with default dimensions when no calibration", () => {
    const tool = new CalibrateTool(null);
    expect(tool.calWidthPx).toBeCloseTo(CREDIT_CARD_WIDTH_MM * DEFAULT_PX_PER_MM, 1);
    expect(tool.calHeightPx).toBeCloseTo(CREDIT_CARD_HEIGHT_MM * DEFAULT_PX_PER_MM, 1);
  });

  test("initializes with calibration-based dimensions", () => {
    const cal = { pxPerMmX: 5, pxPerMmY: 5 };
    const tool = new CalibrateTool(cal);
    expect(tool.calWidthPx).toBeCloseTo(CREDIT_CARD_WIDTH_MM * 5, 1);
    expect(tool.calHeightPx).toBeCloseTo(CREDIT_CARD_HEIGHT_MM * 5, 1);
  });

  test("ArrowRight increases width by 3", () => {
    const tool = new CalibrateTool(null);
    const initial = tool.calWidthPx;
    tool.onKeyDown("ArrowRight", false, ctx());
    expect(tool.calWidthPx).toBeCloseTo(initial + 3, 1);
  });

  test("ArrowRight with Shift increases width by 0.5", () => {
    const tool = new CalibrateTool(null);
    const initial = tool.calWidthPx;
    tool.onKeyDown("ArrowRight", true, ctx());
    expect(tool.calWidthPx).toBeCloseTo(initial + 0.5, 1);
  });

  test("ArrowLeft decreases width (minimum 20)", () => {
    const tool = new CalibrateTool(null);
    tool.calWidthPx = 22;
    tool.onKeyDown("ArrowLeft", false, ctx());
    expect(tool.calWidthPx).toBe(20);
  });

  test("ArrowUp increases height by 3", () => {
    const tool = new CalibrateTool(null);
    const initial = tool.calHeightPx;
    tool.onKeyDown("ArrowUp", false, ctx());
    expect(tool.calHeightPx).toBeCloseTo(initial + 3, 1);
  });

  test("ArrowDown decreases height (minimum 20)", () => {
    const tool = new CalibrateTool(null);
    tool.calHeightPx = 22;
    tool.onKeyDown("ArrowDown", false, ctx());
    expect(tool.calHeightPx).toBe(20);
  });

  test("Tab toggles corner", () => {
    const tool = new CalibrateTool(null);
    expect(tool.calCorner).toBe("left");
    tool.onKeyDown("Tab", false, ctx());
    expect(tool.calCorner).toBe("right");
    tool.onKeyDown("Tab", false, ctx());
    expect(tool.calCorner).toBe("left");
  });

  test("Enter confirms calibration and switches tool", () => {
    const tool = new CalibrateTool(null);
    tool.calWidthPx = 200;
    tool.calHeightPx = 150;
    const actions = tool.onKeyDown("Enter", false, ctx());
    expect(actions).not.toBeNull();
    expect(actions!.setCalibration).toBeDefined();
    expect(actions!.setCalibration!.pxPerMmX).toBeCloseTo(200 / CREDIT_CARD_WIDTH_MM, 3);
    expect(actions!.setCalibration!.pxPerMmY).toBeCloseTo(150 / CREDIT_CARD_HEIGHT_MM, 3);
    expect(actions!.switchTool).toBe("line");
  });

  test("Escape cancels and switches to line", () => {
    const tool = new CalibrateTool(null);
    const actions = tool.onKeyDown("Escape", false, ctx());
    expect(actions).not.toBeNull();
    expect(actions!.switchTool).toBe("line");
    expect(actions!.setCalibration).toBeUndefined();
  });

  test("unrecognized key returns null", () => {
    const tool = new CalibrateTool(null);
    const actions = tool.onKeyDown("a", false, ctx());
    expect(actions).toBeNull();
  });

  test("draw state reports calibration UI", () => {
    const tool = new CalibrateTool(null);
    const ds = tool.getDrawState(ctx());
    expect(ds.calibrationUI).not.toBeNull();
    expect(ds.calibrationUI!.widthPx).toBe(tool.calWidthPx);
    expect(ds.calibrationUI!.heightPx).toBe(tool.calHeightPx);
    expect(ds.calibrationUI!.corner).toBe("left");
    expect(ds.activeMeasurement).toBeNull();
  });

  test("hasActiveMeasurement is always false", () => {
    const tool = new CalibrateTool(null);
    expect(tool.hasActiveMeasurement()).toBe(false);
  });

  test("help hint is empty", () => {
    const tool = new CalibrateTool(null);
    expect(tool.getHelpHint(ctx())).toBe("");
  });

  test("handleCalibrationClick with confirm action sets calibration", () => {
    const tool = new CalibrateTool(null);
    tool.calWidthPx = 200;
    tool.calHeightPx = 150;
    tool.calButtons = [
      { rect: { x: 10, y: 10, w: 50, h: 30 }, action: "confirm" },
    ];
    const actions = tool.handleCalibrationClick({ x: 30, y: 25 });
    expect(actions.setCalibration).toBeDefined();
    expect(actions.switchTool).toBe("line");
  });

  test("handleCalibrationClick outside buttons returns empty", () => {
    const tool = new CalibrateTool(null);
    tool.calButtons = [
      { rect: { x: 10, y: 10, w: 50, h: 30 }, action: "confirm" },
    ];
    const actions = tool.handleCalibrationClick({ x: 200, y: 200 });
    expect(actions.setCalibration).toBeUndefined();
    expect(actions.switchTool).toBeUndefined();
  });

  test("handleCalibrationClick switch-corner toggles corner", () => {
    const tool = new CalibrateTool(null);
    tool.calButtons = [
      { rect: { x: 0, y: 0, w: 100, h: 100 }, action: "switch-corner" },
    ];
    expect(tool.calCorner).toBe("left");
    tool.handleCalibrationClick({ x: 50, y: 50 });
    expect(tool.calCorner).toBe("right");
  });
});
