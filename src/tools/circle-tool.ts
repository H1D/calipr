import type { Point, Measurement } from "../types";
import type { Tool, ToolContext, ToolActions, ToolDrawState } from "../tool";
import { dist, generateId } from "../utils";

export class CircleTool implements Tool {
  readonly name = "circle" as const;
  private activeMeasurement: Measurement | null = null;

  onActivate(_ctx: ToolContext): void {}

  onDeactivate(_ctx: ToolContext): ToolActions {
    if (this.activeMeasurement && this.activeMeasurement.kind === "circle" && this.activeMeasurement.radiusPx > 0) {
      const completed = this.activeMeasurement;
      this.activeMeasurement = null;
      return { completeMeasurement: completed };
    }
    this.activeMeasurement = null;
    return {};
  }

  onClick(pos: Point, _ctx: ToolContext): ToolActions {
    if (!this.activeMeasurement) {
      this.activeMeasurement = {
        kind: "circle",
        id: generateId(),
        center: pos,
        radiusPx: 0,
      };
      return {};
    }
    if (this.activeMeasurement.kind === "circle") {
      this.activeMeasurement.radiusPx = dist(this.activeMeasurement.center, pos);
      const completed = this.activeMeasurement;
      this.activeMeasurement = null;
      return { completeMeasurement: completed };
    }
    return {};
  }

  onMouseMove(pos: Point, _ctx: ToolContext): void {
    if (this.activeMeasurement?.kind === "circle") {
      this.activeMeasurement.radiusPx = dist(this.activeMeasurement.center, pos);
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
    return !this.activeMeasurement ? "Click to place center" : "Click to set radius";
  }

  hasActiveMeasurement(): boolean {
    return this.activeMeasurement !== null;
  }
}
