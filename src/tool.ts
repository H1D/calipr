import type { Point, Measurement, Calibration, Unit, ToolType } from "./types";

/** Read-only context passed to every tool method */
export interface ToolContext {
  readonly mousePos: Point;
  readonly calibration: Calibration | null;
  readonly unit: Unit;
  readonly measurements: readonly Measurement[];
  readonly shiftHeld: boolean;
}

/** Actions a tool can request — ToolManager interprets these */
export interface ToolActions {
  completeMeasurement?: Measurement;
  setCalibration?: Calibration;
  switchTool?: ToolType;
}

/** Visual state the draw loop reads from each tool */
export interface ToolDrawState {
  activeMeasurement: Measurement | null;
  effectiveMousePos: Point | null;
  closeSnapRing: Point | null;
  snapGuide: { from: Point; direction: Point; snapType: "tangent" | "perpendicular" } | null;
  calibrationUI: { widthPx: number; heightPx: number; corner: "left" | "right" } | null;
}

/** Strategy interface implemented by each drawing tool */
export interface Tool {
  readonly name: ToolType;
  onActivate(ctx: ToolContext): void;
  onDeactivate(ctx: ToolContext): ToolActions;
  onClick(pos: Point, ctx: ToolContext): ToolActions;
  onMouseMove(pos: Point, ctx: ToolContext): void;
  onMouseUp(pos: Point, ctx: ToolContext): ToolActions;
  onDblClick(pos: Point, ctx: ToolContext): ToolActions;
  onKeyDown(key: string, shiftKey: boolean, ctx: ToolContext): ToolActions | null;
  getDrawState(ctx: ToolContext): ToolDrawState;
  getHelpHint(ctx: ToolContext): string;
  hasActiveMeasurement(): boolean;
}
