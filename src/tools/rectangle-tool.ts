import type { Point, Measurement } from "../types";
import type { Tool, ToolContext, ToolActions, ToolDrawState } from "../tool";
import { generateId } from "../utils";

export class RectangleTool implements Tool {
  readonly name = "rectangle" as const;
  private activeMeasurement: Measurement | null = null;

  onActivate(_ctx: ToolContext): void {}

  onDeactivate(_ctx: ToolContext): ToolActions {
    if (this.activeMeasurement) {
      const completed = this.activeMeasurement;
      this.activeMeasurement = null;
      return { completeMeasurement: completed };
    }
    return {};
  }

  onClick(pos: Point, _ctx: ToolContext): ToolActions {
    if (!this.activeMeasurement) {
      this.activeMeasurement = {
        kind: "rectangle",
        id: generateId(),
        points: [pos, { ...pos }],
      };
      return {};
    }
    if (this.activeMeasurement.kind === "rectangle") {
      this.activeMeasurement.points[1] = pos;
      const completed = this.activeMeasurement;
      this.activeMeasurement = null;
      return { completeMeasurement: completed };
    }
    return {};
  }

  onMouseMove(pos: Point, _ctx: ToolContext): void {
    if (this.activeMeasurement?.kind === "rectangle") {
      this.activeMeasurement.points[1] = pos;
    }
  }

  onMouseUp(_pos: Point, _ctx: ToolContext): ToolActions { return {}; }
  onDblClick(_pos: Point, _ctx: ToolContext): ToolActions { return {}; }

  onKeyDown(key: string, _shiftKey: boolean, _ctx: ToolContext): ToolActions | null {
    if (key === "Escape") {
      if (this.activeMeasurement) {
        this.activeMeasurement = null;
        return {};
      }
    }
    return null;
  }

  getDrawState(ctx: ToolContext): ToolDrawState {
    return {
      activeMeasurement: this.activeMeasurement,
      effectiveMousePos: this.activeMeasurement ? ctx.mousePos : null,
      closeSnapRing: null,
      snapGuide: null,
      calibrationUI: null,
    };
  }

  getHelpHint(_ctx: ToolContext): string {
    return !this.activeMeasurement ? "Click first corner" : "Click opposite corner";
  }

  getActiveKeyContext(_ctx: ToolContext): string | null {
    return this.activeMeasurement ? "rect.drawing" : null;
  }

  hasActiveMeasurement(): boolean {
    return this.activeMeasurement !== null;
  }
}
