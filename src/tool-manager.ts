import type { Point, Measurement, ToolType, Unit, Calibration, PolylineMeasurement } from "./types";
import type { Tool, ToolContext, ToolActions, ToolDrawState } from "./tool";
import { dist, pointNear, screenToWorld } from "./utils";
import { POINT_HIT_RADIUS, CLOSE_SNAP_RADIUS } from "./polyline-arc";
import { saveMeasurements } from "./storage";

const DRAG_THRESHOLD = 3;

export class ToolManager {
  // --- Shared state ---
  measurements: Measurement[];
  calibration: Calibration | null;
  unit: Unit;
  mousePos: Point = { x: 0, y: 0 };
  panX: number;
  panY: number;
  isPanning = false;
  panStartScreen: Point | null = null;
  panStartPan: Point | null = null;
  panPointerId: number | null = null;
  spaceHeld = false;
  shiftHeld = false;

  // Drag state (cross-tool concern: any completed measurement point)
  dragInfo: { measurementId: string; pointIndex: number } | null = null;
  isDragging = false;
  dragCloseSnapPoint: Point | null = null;

  // Hover state (visual feedback on completed measurement points)
  hoveredMeasurementId: string | null = null;
  hoveredPointIdx: number | null = null;

  // Selection state (cross-tool: click-to-select, arrow-nudge, Tab-cycle)
  selectedMeasurementId: string | null = null;
  selectedPointIdx: number | null = null;
  nudgeHideLabelsUntil = 0;
  private dragPending = false;
  private dragStartPos: Point | null = null;

  // Persistence version (incremented on every measurement mutation)
  saveVersion = 0;

  // Tools
  private tools: Map<ToolType, Tool> = new Map();
  private _activeTool!: Tool;

  constructor(
    measurements: Measurement[],
    calibration: Calibration | null,
    unit: Unit,
    panX: number,
    panY: number,
  ) {
    this.measurements = measurements;
    this.calibration = calibration;
    this.unit = unit;
    this.panX = panX;
    this.panY = panY;
  }

  registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  setActiveTool(type: ToolType) {
    if (this._activeTool) {
      const actions = this._activeTool.onDeactivate(this.getContext());
      this.processActions(actions);
    }
    this.clearSelection();
    this._activeTool = this.tools.get(type)!;
    this._activeTool.onActivate(this.getContext());
  }

  clearSelection() {
    this.selectedMeasurementId = null;
    this.selectedPointIdx = null;
  }

  /** Save measurements to localStorage and bump version for URL sync */
  private persistMeasurements() {
    saveMeasurements(this.measurements);
    this.saveVersion++;
  }

  get activeTool(): Tool {
    return this._activeTool;
  }

  get activeToolName(): ToolType {
    return this._activeTool.name;
  }

  // --- Context factory ---
  getContext(): ToolContext {
    return {
      mousePos: this.mousePos,
      calibration: this.calibration,
      unit: this.unit,
      measurements: this.measurements,
      shiftHeld: this.shiftHeld,
    };
  }

  // --- Action processing ---
  processActions(actions: ToolActions) {
    if (actions.completeMeasurement) {
      this.measurements.push(actions.completeMeasurement);
      this.persistMeasurements();
    }
    if (actions.setCalibration) {
      this.calibration = actions.setCalibration;
    }
    if (actions.switchTool) {
      this.setActiveTool(actions.switchTool);
    }
  }

  // --- Event handlers ---
  handleMouseMove(screenPos: Point): void {
    if (this.isPanning) return;
    this.mousePos = screenToWorld(screenPos, this.panX, this.panY);

    // Promote pending drag after threshold
    if (this.dragPending && !this.isDragging && this.dragStartPos) {
      if (dist(screenPos, this.dragStartPos) > DRAG_THRESHOLD) {
        this.isDragging = true;
        this.dragPending = false;
      }
    }

    if (this.isDragging && this.dragInfo) {
      const m = this.measurements.find((m) => m.id === this.dragInfo!.measurementId);
      if (m) {
        setMeasurementPoint(m, this.dragInfo.pointIndex, this.mousePos);

        // Close snap during drag: snap to start/end when near enough (Shift bypasses)
        this.dragCloseSnapPoint = null;
        if (m.kind === "polyline" && !m.closed && m.segments.length >= 2 && !this.shiftHeld) {
          const lastEnd = m.segments[m.segments.length - 1]!.end;
          if (pointNear(lastEnd, m.start, CLOSE_SNAP_RADIUS)) {
            const pts = getMeasurementPoints(m);
            const lastPtIdx = pts.length - 1;

            if (this.dragInfo.pointIndex === 0) {
              // Dragging start near last endpoint → snap start to last end
              m.start = { ...lastEnd };
              this.dragCloseSnapPoint = lastEnd;
            } else if (this.dragInfo.pointIndex === lastPtIdx) {
              // Dragging last endpoint near start → snap to start
              m.segments[m.segments.length - 1]!.end = { ...m.start };
              this.dragCloseSnapPoint = m.start;
            } else {
              // Some other point moved → just show ring
              this.dragCloseSnapPoint = m.start;
            }
          }
        }

        this.persistMeasurements();
      }
      return;
    }

    // Delegate to active tool
    this._activeTool.onMouseMove(this.mousePos, this.getContext());

    // Hover detection (skip during pan or when tool has active measurement)
    if (!this._activeTool.hasActiveMeasurement() && !this.spaceHeld) {
      const hit = findHoveredPoint(this.measurements, this.mousePos);
      if (hit) {
        this.hoveredMeasurementId = hit.measurementId;
        this.hoveredPointIdx = hit.pointIndex;
      } else {
        this.hoveredMeasurementId = null;
        this.hoveredPointIdx = null;
      }
    }
  }

  /** Returns true if the event was consumed (drag started or click handled) */
  handleMouseDown(screenPos: Point): boolean {
    if (this.isPanning) return false;

    const pos = screenToWorld(screenPos, this.panX, this.panY);

    // Check if clicking on existing point to drag (only when no active measurement)
    if (!this._activeTool.hasActiveMeasurement()) {
      const hit = findHoveredPoint(this.measurements, pos);
      if (hit) {
        this.dragInfo = hit;
        this.dragPending = true;
        this.dragStartPos = screenPos;
        return true;
      }
      // Clicked on empty space — clear selection
      this.clearSelection();
    }

    const actions = this._activeTool.onClick(pos, this.getContext());
    this.processActions(actions);
    return true;
  }

  handleMouseUp(screenPos: Point): void {
    // Non-drag click on a point → select it
    if (this.dragPending && !this.isDragging && this.dragInfo) {
      this.selectedMeasurementId = this.dragInfo.measurementId;
      this.selectedPointIdx = this.dragInfo.pointIndex;
      this.dragPending = false;
      this.dragStartPos = null;
      this.dragInfo = null;
      return;
    }

    if (this.isDragging) {
      if (this.dragInfo) {
        const m = this.measurements.find((m) => m.id === this.dragInfo!.measurementId);
        if (m) {
          const releasePos = screenToWorld(screenPos, this.panX, this.panY);
          setMeasurementPoint(m, this.dragInfo.pointIndex, releasePos);
          // Check if drag closed a polyline (Shift bypasses)
          if (m.kind === "polyline" && !m.closed && m.segments.length >= 2 && !this.shiftHeld) {
            const lastEnd = m.segments[m.segments.length - 1]!.end;
            if (pointNear(lastEnd, m.start, CLOSE_SNAP_RADIUS)) {
              m.closed = true;
              m.segments[m.segments.length - 1]!.end = { ...m.start };
            }
          }
          this.persistMeasurements();
        }
      }
      this.isDragging = false;
      this.dragPending = false;
      this.dragStartPos = null;
      this.dragInfo = null;
      this.dragCloseSnapPoint = null;
      return;
    }

    const pos = screenToWorld(screenPos, this.panX, this.panY);
    const actions = this._activeTool.onMouseUp(pos, this.getContext());
    this.processActions(actions);
  }

  handleDblClick(): void {
    // Double-click on a completed polyline point to remove it
    if (!this._activeTool.hasActiveMeasurement()) {
      const hit = findHoveredPoint(this.measurements, this.mousePos);
      if (hit) {
        const mIdx = this.measurements.findIndex((m) => m.id === hit.measurementId);
        const m = mIdx >= 0 ? this.measurements[mIdx]! : null;
        if (m && m.kind === "polyline") {
          removePolylinePoint(m, hit.pointIndex);
          if (m.segments.length === 0) {
            this.measurements.splice(mIdx, 1);
          }
          this.persistMeasurements();
          this.hoveredMeasurementId = null;
          this.hoveredPointIdx = null;
          return;
        }
      }
    }

    const actions = this._activeTool.onDblClick(this.mousePos, this.getContext());
    this.processActions(actions);
  }

  /** Get the world-space position of the currently selected point, or null */
  getSelectedPointPos(): Point | null {
    if (this.selectedMeasurementId === null || this.selectedPointIdx === null) return null;
    const m = this.measurements.find((m) => m.id === this.selectedMeasurementId);
    if (!m) return null;
    const pts = getMeasurementPoints(m);
    return pts[this.selectedPointIdx] ?? null;
  }

  handleKeyDown(key: string, shiftKey: boolean): ToolActions | null {
    // Selection: arrow nudge, Tab cycle, Escape deselect
    if (this.selectedMeasurementId !== null && this.selectedPointIdx !== null) {
      const delta = getArrowDelta(key);
      if (delta) {
        const m = this.measurements.find((m) => m.id === this.selectedMeasurementId);
        if (m) {
          const pts = getMeasurementPoints(m);
          const cur = pts[this.selectedPointIdx!];
          if (cur) {
            setMeasurementPoint(m, this.selectedPointIdx!, { x: cur.x + delta.x, y: cur.y + delta.y });
            this.persistMeasurements();
            this.nudgeHideLabelsUntil = Date.now() + 1500;
          }
        }
        return {};
      }
      if (key === "Tab") {
        const m = this.measurements.find((m) => m.id === this.selectedMeasurementId);
        if (m) {
          const pts = getMeasurementPoints(m);
          this.selectedPointIdx = (this.selectedPointIdx! + 1) % pts.length;
        }
        return {};
      }
      if (key === "Escape" && !this._activeTool.hasActiveMeasurement()) {
        this.clearSelection();
        return {};
      }
      // Delete selected measurement
      if (key === "Delete" || key === "Backspace") {
        this.measurements = this.measurements.filter((m) => m.id !== this.selectedMeasurementId);
        this.persistMeasurements();
        this.clearSelection();
        return {};
      }
    }

    // Delete/Backspace: tool-specific or delete hovered measurement
    if (key === "Delete" || key === "Backspace") {
      const actions = this._activeTool.onKeyDown(key, shiftKey, this.getContext());
      if (actions) {
        this.processActions(actions);
        return actions;
      }
      // Fallback: delete hovered measurement
      if (this.hoveredMeasurementId) {
        this.measurements = this.measurements.filter((m) => m.id !== this.hoveredMeasurementId);
        this.persistMeasurements();
        this.hoveredMeasurementId = null;
        this.hoveredPointIdx = null;
        return {};
      }
      return null;
    }

    const actions = this._activeTool.onKeyDown(key, shiftKey, this.getContext());
    if (actions) {
      this.processActions(actions);
    }
    return actions;
  }

  // --- Draw state ---
  getDrawState(): ToolDrawState {
    return this._activeTool.getDrawState(this.getContext());
  }

  getHelpHint(): string {
    // Selection hint overrides tool base hint
    if (this.selectedMeasurementId !== null) {
      return "<kbd>←→↑↓</kbd> nudge 0.5px · <kbd>Tab</kbd> next point · <kbd>Esc</kbd> deselect";
    }
    const base = this._activeTool.getHelpHint(this.getContext());
    const drawState = this.getDrawState();
    // Cross-cutting snap hint
    if ((drawState.snapGuide || drawState.closeSnapRing) && !this.shiftHeld) {
      return base + " · hold <kbd>Shift</kbd> to ignore snap";
    }
    return base;
  }

  // --- Clear all ---
  clearAll() {
    this.measurements = [];
    this.saveVersion++;
    this.clearSelection();
    // Deactivate and reactivate to reset tool state
    this._activeTool.onDeactivate(this.getContext());
    this._activeTool.onActivate(this.getContext());
  }
}

// --- Arrow key delta for nudge (cross-tool concern) ---
function getArrowDelta(key: string): Point | null {
  switch (key) {
    case "ArrowLeft": return { x: -0.5, y: 0 };
    case "ArrowRight": return { x: 0.5, y: 0 };
    case "ArrowUp": return { x: 0, y: -0.5 };
    case "ArrowDown": return { x: 0, y: 0.5 };
    default: return null;
  }
}

// --- Hit-testing helpers (cross-tool concern) ---

export function getMeasurementPoints(m: Measurement): Point[] {
  switch (m.kind) {
    case "polyline": {
      const pts: Point[] = [m.start];
      for (const seg of m.segments) {
        if (seg.bulge) pts.push(seg.bulge);
        pts.push(seg.end);
      }
      return pts;
    }
    case "rectangle": return [m.points[0], m.points[1]];
    case "circle": return [m.center, { x: m.center.x + m.radiusPx, y: m.center.y }];
    default: return [];
  }
}

export function setMeasurementPoint(m: Measurement, idx: number, p: Point) {
  switch (m.kind) {
    case "polyline": {
      if (idx === 0) { m.start = p; break; }
      let ci = 1;
      for (const seg of m.segments) {
        if (seg.bulge) {
          if (ci === idx) { seg.bulge = p; return; }
          ci++;
        }
        if (ci === idx) { seg.end = p; return; }
        ci++;
      }
      break;
    }
    case "rectangle":
      m.points[idx] = p;
      break;
    case "circle":
      if (idx === 0) m.center = p;
      if (idx === 1) m.radiusPx = Math.sqrt((p.x - m.center.x) ** 2 + (p.y - m.center.y) ** 2);
      break;
  }
}

export function findHoveredPoint(measurements: readonly Measurement[], pos: Point): { measurementId: string; pointIndex: number } | null {
  for (let i = measurements.length - 1; i >= 0; i--) {
    const m = measurements[i]!;
    const points = getMeasurementPoints(m);
    for (let j = 0; j < points.length; j++) {
      if (pointNear(pos, points[j]!, POINT_HIT_RADIUS)) {
        return { measurementId: m.id, pointIndex: j };
      }
    }
  }
  return null;
}

function identifyPolylinePoint(m: PolylineMeasurement, idx: number): { type: "start" } | { type: "bulge"; segIndex: number } | { type: "end"; segIndex: number } | null {
  if (idx === 0) return { type: "start" };
  let ci = 1;
  for (let si = 0; si < m.segments.length; si++) {
    const seg = m.segments[si]!;
    if (seg.bulge) {
      if (ci === idx) return { type: "bulge", segIndex: si };
      ci++;
    }
    if (ci === idx) return { type: "end", segIndex: si };
    ci++;
  }
  return null;
}

export function removePolylinePoint(m: PolylineMeasurement, idx: number) {
  const info = identifyPolylinePoint(m, idx);
  if (!info) return;

  if (info.type === "bulge") {
    delete m.segments[info.segIndex]!.bulge;
    return;
  }

  if (info.type === "start") {
    if (m.segments.length === 0) return;
    m.start = m.segments[0]!.end;
    m.segments.splice(0, 1);
    return;
  }

  if (info.type === "end") {
    const si = info.segIndex;
    if (si === m.segments.length - 1) {
      m.segments.splice(si, 1);
    } else {
      m.segments.splice(si, 1);
    }
    return;
  }
}
