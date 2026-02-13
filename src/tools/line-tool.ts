import type { Point, Measurement, PolylineMeasurement } from "../types";
import type { Tool, ToolContext, ToolActions, ToolDrawState } from "../tool";
import { generateId, pointNear } from "../utils";
import {
  CLOSE_SNAP_RADIUS,
  getPrevTangent, computeArcHoldAction, updateArcSegment,
  shouldCloseSnap, snapArcToClose, finalizeArc,
} from "../polyline-arc";

// --- Snap computation (polyline-specific) ---
function computeSnap(from: Point, to: Point, tangentDir: Point): { snapped: Point; snapType: "tangent" | "perpendicular" | null } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const mouseAngle = Math.atan2(dy, dx);

  const tangentAngle = Math.atan2(tangentDir.y, tangentDir.x);
  const perpAngle = tangentAngle + Math.PI / 2;

  const SNAP_THRESHOLD = 0.087; // ~5 degrees

  const angleDiff = (a: number, b: number) => {
    let d = a - b;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d);
  };

  const tangentDiffFwd = angleDiff(mouseAngle, tangentAngle);
  const tangentDiffBwd = angleDiff(mouseAngle, tangentAngle + Math.PI);
  const perpDiffFwd = angleDiff(mouseAngle, perpAngle);
  const perpDiffBwd = angleDiff(mouseAngle, perpAngle + Math.PI);

  let snapType: "tangent" | "perpendicular" | null = null;
  let snapDir: Point = { x: 0, y: 0 };

  if (tangentDiffFwd < SNAP_THRESHOLD || tangentDiffBwd < SNAP_THRESHOLD) {
    snapType = "tangent";
    snapDir = tangentDir;
  } else if (perpDiffFwd < SNAP_THRESHOLD || perpDiffBwd < SNAP_THRESHOLD) {
    snapType = "perpendicular";
    snapDir = { x: -tangentDir.y, y: tangentDir.x };
  }

  if (snapType === null) {
    return { snapped: to, snapType: null };
  }

  const dot = dx * snapDir.x + dy * snapDir.y;
  const snapped: Point = {
    x: from.x + dot * snapDir.x,
    y: from.y + dot * snapDir.y,
  };

  return { snapped, snapType };
}

export class LineTool implements Tool {
  readonly name = "line" as const;

  // Active polyline being drawn
  private activeMeasurement: PolylineMeasurement | null = null;

  // Arc creation state
  private isHoldingForArc = false;
  private arcDragTimeout: ReturnType<typeof setTimeout> | null = null;
  private isClosingSegment = false;
  private arcIsNewSegment = false;

  // Snap state
  private currentSnap: { snapped: Point; snapType: "tangent" | "perpendicular" | null; from: Point; direction: Point } | null = null;
  private closeSnapActive = false;

  onActivate(_ctx: ToolContext): void {}

  onDeactivate(_ctx: ToolContext): ToolActions {
    return this.finalize();
  }

  onClick(pos: Point, ctx: ToolContext): ToolActions {
    if (!this.activeMeasurement) {
      this.activeMeasurement = {
        kind: "polyline",
        id: generateId(),
        start: pos,
        segments: [],
      };
      return {};
    }

    const snapPos = (this.currentSnap && this.currentSnap.snapType) ? this.currentSnap.snapped : pos;

    // Check for close (need >= 2 segments, Shift bypasses)
    if (!ctx.shiftHeld && this.activeMeasurement.segments.length >= 2 && pointNear(pos, this.activeMeasurement.start, CLOSE_SNAP_RADIUS)) {
      this.activeMeasurement.segments.push({ end: { ...this.activeMeasurement.start } });
      this.isClosingSegment = true;
      this.arcDragTimeout = setTimeout(() => { this.isHoldingForArc = true; this.arcDragTimeout = null; }, 200);
    } else {
      this.activeMeasurement.segments.push({ end: snapPos });
      const mRef = this.activeMeasurement;
      this.arcDragTimeout = setTimeout(() => {
        this.isHoldingForArc = true;
        this.arcDragTimeout = null;
        if (!this.isClosingSegment && mRef.kind === "polyline") {
          const action = computeArcHoldAction(mRef, ctx.mousePos);
          if (action.addNewSegment && action.newSegmentEnd) {
            mRef.segments.push({ end: action.newSegmentEnd });
            this.arcIsNewSegment = true;
          }
        }
      }, 200);
    }

    return {};
  }

  onMouseMove(pos: Point, ctx: ToolContext): void {
    if (!this.activeMeasurement) return;

    // Arc drag update
    if (this.isHoldingForArc && this.activeMeasurement.segments.length > 0) {
      updateArcSegment(this.activeMeasurement, pos, this.isClosingSegment);
    }

    // Tangent/perpendicular snap
    if (!this.isHoldingForArc && !ctx.shiftHeld && !this.isClosingSegment && this.activeMeasurement.segments.length > 0) {
      const lastEndpoint = this.activeMeasurement.segments[this.activeMeasurement.segments.length - 1]!.end;
      const tangent = getPrevTangent(this.activeMeasurement, this.activeMeasurement.segments.length);
      const snap = computeSnap(lastEndpoint, pos, tangent);
      if (snap.snapType) {
        const snapDir = snap.snapType === "tangent"
          ? tangent
          : { x: -tangent.y, y: tangent.x };
        this.currentSnap = { snapped: snap.snapped, snapType: snap.snapType, from: lastEndpoint, direction: snapDir };
      } else {
        this.currentSnap = null;
      }
    } else {
      this.currentSnap = null;
    }

    // Close snap (takes precedence over tangent/perpendicular)
    this.closeSnapActive = shouldCloseSnap(this.activeMeasurement, pos, ctx.shiftHeld, this.isClosingSegment);
    if (this.closeSnapActive) {
      this.currentSnap = null;
    }
    if (this.closeSnapActive && this.isHoldingForArc) {
      snapArcToClose(this.activeMeasurement);
    }
  }

  onMouseUp(_pos: Point, ctx: ToolContext): ToolActions {
    // Clear arc drag timeout
    if (this.arcDragTimeout) { clearTimeout(this.arcDragTimeout); this.arcDragTimeout = null; }

    // Finalize closing segment
    if (this.isClosingSegment && this.activeMeasurement) {
      this.isHoldingForArc = false;
      this.isClosingSegment = false;
      this.activeMeasurement.closed = true;
      // Remove explicit closing segment if straight (no arc bulge) —
      // the renderer's implicit closing logic draws the line back to start
      const lastSeg = this.activeMeasurement.segments[this.activeMeasurement.segments.length - 1];
      if (lastSeg && !lastSeg.bulge) {
        this.activeMeasurement.segments.pop();
      }
      const completed = this.activeMeasurement;
      this.activeMeasurement = null;
      this.currentSnap = null;
      return { completeMeasurement: completed };
    }

    // Finalize arc on mouse release
    if (this.isHoldingForArc && this.activeMeasurement) {
      this.isHoldingForArc = false;
      const wasNewSegment = this.arcIsNewSegment;
      this.arcIsNewSegment = false;
      const result = finalizeArc(this.activeMeasurement, ctx.shiftHeld, wasNewSegment);
      if (result.closed) {
        const completed = this.activeMeasurement;
        this.activeMeasurement = null;
        this.currentSnap = null;
        return { completeMeasurement: completed };
      }
    }

    return {};
  }

  onDblClick(_pos: Point, _ctx: ToolContext): ToolActions {
    if (this.activeMeasurement && this.activeMeasurement.segments.length >= 1) {
      const completed = this.activeMeasurement;
      this.activeMeasurement = null;
      this.currentSnap = null;
      return { completeMeasurement: completed };
    }
    return {};
  }

  onKeyDown(key: string, _shiftKey: boolean, _ctx: ToolContext): ToolActions | null {
    if (key === "Escape") {
      if (this.activeMeasurement) {
        if (this.activeMeasurement.segments.length >= 1) {
          const completed = this.activeMeasurement;
          this.activeMeasurement = null;
          this.currentSnap = null;
          return { completeMeasurement: completed };
        }
        this.activeMeasurement = null;
        this.currentSnap = null;
        return {};
      }
      return null;
    }

    if (key === "Enter") {
      if (this.activeMeasurement && this.activeMeasurement.segments.length >= 1) {
        const completed = this.activeMeasurement;
        this.activeMeasurement = null;
        this.currentSnap = null;
        return { completeMeasurement: completed };
      }
      return null;
    }

    if (key === "Delete" || key === "Backspace") {
      if (this.activeMeasurement && this.activeMeasurement.segments.length > 0) {
        this.activeMeasurement.segments.pop();
        return {};
      }
      return null; // Let ToolManager handle hovered measurement deletion
    }

    return null;
  }

  getDrawState(ctx: ToolContext): ToolDrawState {
    let effectiveMousePos: Point | null = null;
    let closeSnapRing: Point | null = null;
    let snapGuide: ToolDrawState["snapGuide"] = null;

    if (this.activeMeasurement) {
      if (this.isClosingSegment) {
        effectiveMousePos = null;
      } else if (this.closeSnapActive) {
        effectiveMousePos = this.activeMeasurement.start;
        closeSnapRing = this.activeMeasurement.start;
      } else if (this.currentSnap && this.currentSnap.snapType) {
        effectiveMousePos = this.currentSnap.snapped;
      } else {
        effectiveMousePos = ctx.mousePos;
      }
    }

    if (this.currentSnap && this.currentSnap.snapType) {
      snapGuide = {
        from: this.currentSnap.from,
        direction: this.currentSnap.direction,
        snapType: this.currentSnap.snapType,
      };
    }

    return {
      activeMeasurement: this.activeMeasurement,
      effectiveMousePos,
      closeSnapRing,
      snapGuide,
      calibrationUI: null,
    };
  }

  getHelpHint(_ctx: ToolContext): string {
    if (!this.activeMeasurement) {
      return "Click to place first point";
    }
    if (this.isHoldingForArc) {
      return "Drag to shape the arc · release to set";
    }
    if (this.activeMeasurement.segments.length === 0) {
      return "Click next point · hold & drag for arc";
    }
    const parts = ["Click next point · hold & drag for arc"];
    if (this.activeMeasurement.segments.length >= 2) {
      parts.push("click first point to close");
    }
    parts.push("<kbd>Enter</kbd> to finish");
    return parts.join(" · ");
  }

  hasActiveMeasurement(): boolean {
    return this.activeMeasurement !== null;
  }

  private finalize(): ToolActions {
    if (!this.activeMeasurement) return {};

    const valid = this.activeMeasurement.segments.length >= 1;
    const result: ToolActions = {};
    if (valid) {
      result.completeMeasurement = this.activeMeasurement;
    }
    this.activeMeasurement = null;
    this.currentSnap = null;
    this.closeSnapActive = false;
    this.isClosingSegment = false;
    this.isHoldingForArc = false;
    this.arcIsNewSegment = false;
    if (this.arcDragTimeout) { clearTimeout(this.arcDragTimeout); this.arcDragTimeout = null; }
    return result;
  }
}
