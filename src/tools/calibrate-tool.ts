import type { Point, Calibration } from "../types";
import { CREDIT_CARD_WIDTH_MM, CREDIT_CARD_HEIGHT_MM, DEFAULT_PX_PER_MM } from "../types";
import type { Tool, ToolContext, ToolActions, ToolDrawState } from "../tool";
import { saveCalibration } from "../storage";

export class CalibrateTool implements Tool {
  readonly name = "calibrate" as const;

  calWidthPx: number;
  calHeightPx: number;
  calCorner: "left" | "right" = "left";
  calButtons: Array<{ rect: { x: number; y: number; w: number; h: number }; action: string }> = [];

  constructor(calibration: Calibration | null) {
    this.calWidthPx = calibration ? CREDIT_CARD_WIDTH_MM * calibration.pxPerMmX : CREDIT_CARD_WIDTH_MM * DEFAULT_PX_PER_MM;
    this.calHeightPx = calibration ? CREDIT_CARD_HEIGHT_MM * calibration.pxPerMmY : CREDIT_CARD_HEIGHT_MM * DEFAULT_PX_PER_MM;
  }

  onActivate(_ctx: ToolContext): void {}
  onDeactivate(_ctx: ToolContext): ToolActions { return {}; }
  onClick(_pos: Point, _ctx: ToolContext): ToolActions { return {}; }
  onMouseMove(_pos: Point, _ctx: ToolContext): void {}
  onMouseUp(_pos: Point, _ctx: ToolContext): ToolActions { return {}; }
  onDblClick(_pos: Point, _ctx: ToolContext): ToolActions { return {}; }

  onKeyDown(key: string, shiftKey: boolean, _ctx: ToolContext): ToolActions | null {
    const step = shiftKey ? 0.5 : 3;
    switch (key) {
      case "ArrowRight":
        this.calWidthPx += step;
        return {};
      case "ArrowLeft":
        this.calWidthPx = Math.max(20, this.calWidthPx - step);
        return {};
      case "ArrowUp":
        this.calHeightPx += step;
        return {};
      case "ArrowDown":
        this.calHeightPx = Math.max(20, this.calHeightPx - step);
        return {};
      case "Tab":
        this.calCorner = this.calCorner === "left" ? "right" : "left";
        return {};
      case "Enter": {
        const cal: Calibration = {
          pxPerMmX: this.calWidthPx / CREDIT_CARD_WIDTH_MM,
          pxPerMmY: this.calHeightPx / CREDIT_CARD_HEIGHT_MM,
        };
        saveCalibration(cal);
        return { setCalibration: cal, switchTool: "line" };
      }
      case "Escape":
        return { switchTool: "line" };
    }
    return null;
  }

  getDrawState(_ctx: ToolContext): ToolDrawState {
    return {
      activeMeasurement: null,
      effectiveMousePos: null,
      closeSnapRing: null,
      snapGuide: null,
      calibrationUI: {
        widthPx: this.calWidthPx,
        heightPx: this.calHeightPx,
        corner: this.calCorner,
      },
    };
  }

  getHelpHint(_ctx: ToolContext): string {
    return "";
  }

  getActiveKeyContext(_ctx: ToolContext): string | null {
    return null;
  }

  hasActiveMeasurement(): boolean {
    return false;
  }

  // --- Calibration-specific: button click in screen coords ---
  handleCalibrationClick(screenPos: Point): ToolActions {
    for (const btn of this.calButtons) {
      const r = btn.rect;
      if (screenPos.x >= r.x && screenPos.x <= r.x + r.w && screenPos.y >= r.y && screenPos.y <= r.y + r.h) {
        return this.handleCalibrationAction(btn.action);
      }
    }
    return {};
  }

  private handleCalibrationAction(action: string): ToolActions {
    switch (action) {
      case "width+":
        this.calWidthPx += 3;
        break;
      case "width-":
        this.calWidthPx = Math.max(20, this.calWidthPx - 3);
        break;
      case "height+":
        this.calHeightPx += 3;
        break;
      case "height-":
        this.calHeightPx = Math.max(20, this.calHeightPx - 3);
        break;
      case "width+fine":
        this.calWidthPx += 0.5;
        break;
      case "width-fine":
        this.calWidthPx = Math.max(20, this.calWidthPx - 0.5);
        break;
      case "height+fine":
        this.calHeightPx += 0.5;
        break;
      case "height-fine":
        this.calHeightPx = Math.max(20, this.calHeightPx - 0.5);
        break;
      case "confirm": {
        const cal: Calibration = {
          pxPerMmX: this.calWidthPx / CREDIT_CARD_WIDTH_MM,
          pxPerMmY: this.calHeightPx / CREDIT_CARD_HEIGHT_MM,
        };
        saveCalibration(cal);
        return { setCalibration: cal, switchTool: "line" };
      }
      case "cancel":
        return { switchTool: "line" };
      case "switch-corner":
        this.calCorner = this.calCorner === "left" ? "right" : "left";
        break;
    }
    return {};
  }
}
