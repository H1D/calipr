import type { Point, Measurement, Calibration, Unit, PolylineSegment } from "./types";
import { distToUnit, formatValue, midpoint, pxToUnit, arcLengthToUnit, circumscribedCircle, angleSweepThrough, gridVisibleRange } from "./utils";

const POINT_RADIUS = 5;
const LINE_WIDTH = 2;
const LABEL_FONT = "13px 'Segoe UI', system-ui, sans-serif";
const GRID_STEP = 50;

export interface ThemeColors {
  bg: string;
  grid: string;
  point: string;
  pointHover: string;
  pointStroke: string;
  pointSelected: string;
  pointSelectedStroke: string;
  line: string;
  preview: string;
  labelBg: string;
  labelText: string;
  labelBorder: string;
  shapeFill: string;
  bulge: string;
  bulgeHover: string;
  bulgeStroke: string;
  closeSnapRing: string;
  closeSnapText: string;
  snapTangent: string;
  snapPerpendicular: string;
  crosshair: string;
  calFill: string;
  calStroke: string;
  calTitle: string;
  calText: string;
  calDim: string;
  calBtnBg: string;
  calBtnStroke: string;
  calBtnText: string;
  calBtnLabel: string;
  calConfirmBg: string;
  calConfirmText: string;
  calCancelBg: string;
  calCancelText: string;
  calCornerBg: string;
  calCornerText: string;
}

export const LIGHT_COLORS: ThemeColors = {
  bg: "#f8f9fa",
  grid: "rgba(0,0,0,0.04)",
  point: "#1e40af",
  pointHover: "#3b6cf5",
  pointStroke: "#fff",
  pointSelected: "#f59e0b",
  pointSelectedStroke: "#fff",
  line: "#1e40af",
  preview: "rgba(30, 64, 175, 0.5)",
  labelBg: "rgba(255, 255, 255, 0.92)",
  labelText: "#333",
  labelBorder: "#e0e0e0",
  shapeFill: "rgba(30, 64, 175, 0.12)",
  bulge: "#ff6b3d",
  bulgeHover: "#ff9b7a",
  bulgeStroke: "#fff",
  closeSnapRing: "rgba(30, 64, 175, 0.5)",
  closeSnapText: "rgba(30, 64, 175, 0.6)",
  snapTangent: "rgba(0, 180, 0, 0.3)",
  snapPerpendicular: "rgba(0, 120, 255, 0.3)",
  crosshair: "rgba(255, 60, 60, 0.3)",
  calFill: "rgba(220, 38, 38, 0.85)",
  calStroke: "#dc2626",
  calTitle: "#333",
  calText: "#666",
  calDim: "#999",
  calBtnBg: "#f5f5f5",
  calBtnStroke: "#ccc",
  calBtnText: "#333",
  calBtnLabel: "#333",
  calConfirmBg: "#dcfce7",
  calConfirmText: "#166534",
  calCancelBg: "#fee2e2",
  calCancelText: "#991b1b",
  calCornerBg: "#e8e8ff",
  calCornerText: "#444",
};

export const DARK_COLORS: ThemeColors = {
  bg: "#1a1a2e",
  grid: "rgba(255,255,255,0.06)",
  point: "#5b8def",
  pointHover: "#7da8ff",
  pointStroke: "#1a1a2e",
  pointSelected: "#fbbf24",
  pointSelectedStroke: "#1a1a2e",
  line: "#5b8def",
  preview: "rgba(91, 141, 239, 0.5)",
  labelBg: "rgba(42, 42, 62, 0.92)",
  labelText: "#e0e0e0",
  labelBorder: "#3a3a50",
  shapeFill: "rgba(91, 141, 239, 0.15)",
  bulge: "#ff6b3d",
  bulgeHover: "#ff9b7a",
  bulgeStroke: "#1a1a2e",
  closeSnapRing: "rgba(91, 141, 239, 0.5)",
  closeSnapText: "rgba(91, 141, 239, 0.6)",
  snapTangent: "rgba(0, 200, 0, 0.35)",
  snapPerpendicular: "rgba(60, 160, 255, 0.35)",
  crosshair: "rgba(255, 100, 100, 0.3)",
  calFill: "rgba(248, 113, 113, 0.8)",
  calStroke: "#f87171",
  calTitle: "#e0e0e0",
  calText: "#b0b0b0",
  calDim: "#808090",
  calBtnBg: "#3a3a4e",
  calBtnStroke: "#4a4a5e",
  calBtnText: "#e0e0e0",
  calBtnLabel: "#e0e0e0",
  calConfirmBg: "#1a3a2a",
  calConfirmText: "#6ee7b7",
  calCancelBg: "#3a1a1a",
  calCancelText: "#fca5a5",
  calCornerBg: "#2a2a4e",
  calCornerText: "#b0b0d0",
};

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private panX = 0;
  private panY = 0;
  colors: ThemeColors = LIGHT_COLORS;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
  }

  setTheme(isDark: boolean) {
    this.colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setPan(x: number, y: number) {
    this.panX = x;
    this.panY = y;
  }

  resetPan() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  clear() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = this.colors.bg;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.translate(this.panX, this.panY);
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = this.colors.grid;
    ctx.lineWidth = 1;
    const { startX, startY, endX, endY } = gridVisibleRange(this.panX, this.panY, this.width, this.height, GRID_STEP);
    for (let x = startX; x <= endX; x += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(x, -this.panY);
      ctx.lineTo(x, -this.panY + this.height);
      ctx.stroke();
    }
    for (let y = startY; y <= endY; y += GRID_STEP) {
      ctx.beginPath();
      ctx.moveTo(-this.panX, y);
      ctx.lineTo(-this.panX + this.width, y);
      ctx.stroke();
    }
  }

  drawPoint(p: Point, hovered = false, selected = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(p.x, p.y, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = selected ? this.colors.pointSelected : hovered ? this.colors.pointHover : this.colors.point;
    ctx.fill();
    ctx.strokeStyle = selected ? this.colors.pointSelectedStroke : this.colors.pointStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (selected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, POINT_RADIUS + 4, 0, Math.PI * 2);
      ctx.strokeStyle = this.colors.pointSelected;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawLine(a: Point, b: Point, preview = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = preview ? this.colors.preview : this.colors.line;
    ctx.lineWidth = LINE_WIDTH;
    ctx.setLineDash(preview ? [6, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawLabel(text: string, pos: Point, offset: Point = { x: 0, y: -18 }) {
    const ctx = this.ctx;
    ctx.font = LABEL_FONT;
    const metrics = ctx.measureText(text);
    const w = metrics.width + 12;
    const h = 22;
    const x = pos.x + offset.x - w / 2;
    const y = pos.y + offset.y - h / 2;

    ctx.fillStyle = this.colors.labelBg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = this.colors.labelBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = this.colors.labelText;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, pos.x + offset.x, pos.y + offset.y);
  }

  drawMeasurement(m: Measurement, cal: Calibration | null, unit: Unit, mousePos: Point | null, hoveredPointIdx: number | null, hideLabels = false, selectedPointIdx: number | null = null) {
    switch (m.kind) {
      case "polyline":
        this.drawPolylineMeasurement(m.start, m.segments, !!m.closed, cal, unit, mousePos, hoveredPointIdx, hideLabels, selectedPointIdx);
        break;
      case "rectangle":
        this.drawRectangleMeasurement(m.points[0], m.points[1], cal, unit, hoveredPointIdx, hideLabels, selectedPointIdx);
        break;
      case "circle":
        this.drawCircleMeasurement(m.center, m.radiusPx, cal, unit, hoveredPointIdx, hideLabels, selectedPointIdx);
        break;
    }
  }

  drawArc(start: Point, mid: Point, end: Point, preview = false) {
    const ctx = this.ctx;
    const circle = circumscribedCircle(start, mid, end);

    if (!circle) {
      this.drawLine(start, end, preview);
      return;
    }

    const a1 = Math.atan2(start.y - circle.cy, start.x - circle.cx);
    const a2 = Math.atan2(mid.y - circle.cy, mid.x - circle.cx);
    const a3 = Math.atan2(end.y - circle.cy, end.x - circle.cx);
    const sweep = angleSweepThrough(a1, a2, a3);
    const ccw = sweep < 0;

    ctx.beginPath();
    ctx.arc(circle.cx, circle.cy, circle.r, a1, a3, ccw);
    ctx.strokeStyle = preview ? this.colors.preview : this.colors.line;
    ctx.lineWidth = LINE_WIDTH;
    ctx.setLineDash(preview ? [6, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawPolylineMeasurement(start: Point, segments: PolylineSegment[], closed: boolean, cal: Calibration | null, unit: Unit, mousePos: Point | null, hoveredPointIdx: number | null, hideLabels = false, selectedPointIdx: number | null = null) {
    const ctx = this.ctx;

    // Draw fill if closed
    if (closed && segments.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      let prev = start;
      for (const seg of segments) {
        if (seg.bulge) {
          const circle = circumscribedCircle(prev, seg.bulge, seg.end);
          if (circle) {
            const a1 = Math.atan2(prev.y - circle.cy, prev.x - circle.cx);
            const a2 = Math.atan2(seg.bulge.y - circle.cy, seg.bulge.x - circle.cx);
            const a3 = Math.atan2(seg.end.y - circle.cy, seg.end.x - circle.cx);
            const sweep = angleSweepThrough(a1, a2, a3);
            ctx.arc(circle.cx, circle.cy, circle.r, a1, a3, sweep < 0);
          } else {
            ctx.lineTo(seg.end.x, seg.end.y);
          }
        } else {
          ctx.lineTo(seg.end.x, seg.end.y);
        }
        prev = seg.end;
      }
      ctx.closePath();
      ctx.fillStyle = this.colors.shapeFill;
      ctx.fill();
    }

    let pointIdx = 0;

    // Draw start point
    this.drawPoint(start, hoveredPointIdx === pointIdx, selectedPointIdx === pointIdx);
    pointIdx++;

    let prev = start;
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i]!;
      if (seg.bulge) {
        // Arc segment
        this.drawArc(prev, seg.bulge, seg.end);
        if (!hideLabels) {
          const len = arcLengthToUnit(prev, seg.bulge, seg.end, cal, unit);
          const mid = midpoint(prev, seg.end);
          this.drawLabel(formatValue(len, unit), mid, { x: 0, y: -20 });
        }
        // Draw bulge control point
        this.drawBulgePoint(seg.bulge, hoveredPointIdx === pointIdx, selectedPointIdx === pointIdx);
        pointIdx++;
      } else {
        // Straight segment
        this.drawLine(prev, seg.end);
        if (!hideLabels) {
          const len = distToUnit(prev, seg.end, cal, unit);
          const mid = midpoint(prev, seg.end);
          this.drawLabel(formatValue(len, unit), mid, { x: 0, y: -20 });
        }
      }
      // Draw endpoint (skip if closed and this is the closing segment overlapping start)
      const isClosingDup = closed && i === segments.length - 1
        && (seg.end.x - start.x) ** 2 + (seg.end.y - start.y) ** 2 < 0.25;
      if (!isClosingDup) {
        this.drawPoint(seg.end, hoveredPointIdx === pointIdx, selectedPointIdx === pointIdx);
      }
      pointIdx++;
      prev = seg.end;
    }

    // Implicit closing segment (when closed and last endpoint isn't already at start)
    if (closed && segments.length >= 2) {
      const dx = prev.x - start.x;
      const dy = prev.y - start.y;
      if (dx * dx + dy * dy > 0.25) {
        this.drawLine(prev, start);
        if (!hideLabels) {
          const len = distToUnit(prev, start, cal, unit);
          const mid = midpoint(prev, start);
          this.drawLabel(formatValue(len, unit), mid, { x: 0, y: -20 });
        }
      }
    }

    // Preview line to mouse (only when not closed)
    if (!closed && mousePos) {
      this.drawLine(prev, mousePos, true);
      if (!hideLabels) {
        const len = distToUnit(prev, mousePos, cal, unit);
        const mid = midpoint(prev, mousePos);
        this.drawLabel(formatValue(len, unit), mid, { x: 0, y: -20 });
      }
    }
  }

  drawBulgePoint(p: Point, hovered = false, selected = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = selected ? this.colors.pointSelected : hovered ? this.colors.bulgeHover : this.colors.bulge;
    ctx.fill();
    ctx.strokeStyle = selected ? this.colors.pointSelectedStroke : this.colors.bulgeStroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (selected) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = this.colors.pointSelected;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawCloseSnapRing(p: Point) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = this.colors.closeSnapRing;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = "10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = this.colors.closeSnapText;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("close", p.x + 18, p.y);
  }

  drawSnapGuide(from: Point, direction: Point, snapType: "tangent" | "perpendicular") {
    const ctx = this.ctx;
    const extent = 2000;

    const color = snapType === "tangent"
      ? this.colors.snapTangent
      : this.colors.snapPerpendicular;

    const x1 = from.x - direction.x * extent;
    const y1 = from.y - direction.y * extent;
    const x2 = from.x + direction.x * extent;
    const y2 = from.y + direction.y * extent;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    const labelX = from.x + 12;
    const labelY = from.y - 12;
    ctx.font = "10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(snapType, labelX, labelY);
  }

  drawCrosshair(p: Point) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(p.x, -this.panY);
    ctx.lineTo(p.x, -this.panY + this.height);
    ctx.moveTo(-this.panX, p.y);
    ctx.lineTo(-this.panX + this.width, p.y);
    ctx.strokeStyle = this.colors.crosshair;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawRectangleMeasurement(a: Point, b: Point, cal: Calibration | null, unit: Unit, hoveredPointIdx: number | null, hideLabels = false, selectedPointIdx: number | null = null) {
    const ctx = this.ctx;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);

    ctx.fillStyle = this.colors.shapeFill;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = this.colors.line;
    ctx.lineWidth = LINE_WIDTH;
    ctx.strokeRect(x, y, w, h);

    if (!hideLabels) {
      const topMid: Point = { x: x + w / 2, y };
      const wVal = distToUnit({ x: a.x, y: 0 }, { x: b.x, y: 0 }, cal, unit);
      this.drawLabel(formatValue(wVal, unit), topMid, { x: 0, y: -18 });

      const rightMid: Point = { x: x + w, y: y + h / 2 };
      const hVal = distToUnit({ x: 0, y: a.y }, { x: 0, y: b.y }, cal, unit);
      this.drawLabel(formatValue(hVal, unit), rightMid, { x: 24, y: 0 });
    }

    this.drawPoint(a, hoveredPointIdx === 0, selectedPointIdx === 0);
    this.drawPoint(b, hoveredPointIdx === 1, selectedPointIdx === 1);
  }

  drawCircleMeasurement(center: Point, radiusPx: number, cal: Calibration | null, unit: Unit, hoveredPointIdx: number | null, hideLabels = false, selectedPointIdx: number | null = null) {
    const ctx = this.ctx;

    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = this.colors.shapeFill;
    ctx.fill();
    ctx.strokeStyle = this.colors.line;
    ctx.lineWidth = LINE_WIDTH;
    ctx.stroke();

    const edgePoint: Point = { x: center.x + radiusPx, y: center.y };
    this.drawLine(center, edgePoint);

    if (!hideLabels) {
      const rVal = pxToUnit(radiusPx, cal, unit);
      const mid = midpoint(center, edgePoint);
      this.drawLabel("r = " + formatValue(rVal, unit), mid, { x: 0, y: -20 });
      this.drawLabel("d = " + formatValue(rVal * 2, unit), center, { x: 0, y: 20 });
    }

    this.drawPoint(center, hoveredPointIdx === 0, selectedPointIdx === 0);
    this.drawPoint(edgePoint, hoveredPointIdx === 1, selectedPointIdx === 1);
  }


  drawCalibrationRect(x: number, y: number, widthPx: number, heightPx: number) {
    const ctx = this.ctx;
    const cornerRadiusPx = 3.18 * (widthPx / 85.6);

    ctx.fillStyle = this.colors.calFill;
    ctx.beginPath();
    ctx.roundRect(x, y, widthPx, heightPx, cornerRadiusPx);
    ctx.fill();

    ctx.strokeStyle = this.colors.calStroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, widthPx, heightPx, cornerRadiusPx);
    ctx.stroke();
  }

  drawCalibrationUI(widthPx: number, heightPx: number, corner: "left" | "right"): { x: number; y: number; buttons: Array<{ rect: { x: number; y: number; w: number; h: number }; action: string }> } {
    const padding = 0;
    const x = corner === "left" ? padding : this.width - widthPx - padding;
    const y = this.height - heightPx - padding;

    this.drawCalibrationRect(x, y, widthPx, heightPx);

    const ctx = this.ctx;
    const buttons: Array<{ rect: { x: number; y: number; w: number; h: number }; action: string }> = [];

    const textAlign: CanvasTextAlign = corner === "left" ? "left" : "right";
    const textX = corner === "left" ? Math.max(x, 16) : Math.min(x + widthPx, this.width - 16);
    const textBaseY = Math.max(80, y - 100);

    ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = this.colors.calTitle;
    ctx.textAlign = textAlign;
    ctx.textBaseline = "middle";
    ctx.fillText("Place your \u{1F4B3}credit card against the screen corner", textX, textBaseY);

    ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = this.colors.calText;
    ctx.textAlign = textAlign;
    ctx.fillText("Adjust size until card covers the red rectangle", textX, textBaseY + 22);
    ctx.textAlign = textAlign;
    ctx.fillText("[\u2190\u2192] adjust width \u00B7 [\u2191\u2193] adjust height \u00B7 hold [Shift] for fine", textX, textBaseY + 42);
    ctx.textAlign = textAlign;
    ctx.fillText("[TAB] switch corner \u00B7 [\u23CE Enter] confirm \u00B7 [Esc] cancel", textX, textBaseY + 62);

    ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = this.colors.calDim;
    ctx.textAlign = textAlign;
    ctx.fillText(`${widthPx.toFixed(1)} \u00D7 ${heightPx.toFixed(1)} px`, textX, textBaseY + 82);

    const arrowBtnW = 32;
    const arrowBtnH = 26;
    const labelW = 100;
    const btnGap = 4;
    const rowH = arrowBtnH + btnGap;

    const panelW = arrowBtnW * 4 + labelW + btnGap * 4;
    const panelX = corner === "left"
      ? Math.max(x + widthPx + 40, this.width / 2 - panelW / 2)
      : Math.min(x - 40 - panelW, this.width / 2 - panelW / 2);
    const panelY = this.height - 240;

    const drawBtn = (bx: number, by: number, bw: number, bh: number, label: string, action: string, color: string, textColor: string, rotation = 0) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = this.colors.calBtnStroke;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = "12px 'Consolas', 'SF Mono', 'Menlo', monospace";
      ctx.fillStyle = textColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (rotation !== 0) {
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      } else {
        ctx.fillText(label, bx + bw / 2, by + bh / 2);
      }

      buttons.push({ rect: { x: bx, y: by, w: bw, h: bh }, action });
    };

    const drawArrowRow = (rowY: number, label: string, actions: { coarseMinus: string; fineMinus: string; finePlus: string; coarsePlus: string }, rotation = 0) => {
      let cx = panelX;

      drawBtn(cx, rowY, arrowBtnW, arrowBtnH, "\u00AB", actions.coarseMinus, this.colors.calBtnBg, this.colors.calBtnText, rotation);
      cx += arrowBtnW + btnGap;

      drawBtn(cx, rowY, arrowBtnW, arrowBtnH, "\u2039", actions.fineMinus, this.colors.calBtnBg, this.colors.calBtnText, rotation);
      cx += arrowBtnW + btnGap;

      ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = this.colors.calBtnLabel;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx + labelW / 2, rowY + arrowBtnH / 2);
      cx += labelW + btnGap;

      drawBtn(cx, rowY, arrowBtnW, arrowBtnH, "\u203A", actions.finePlus, this.colors.calBtnBg, this.colors.calBtnText, rotation);
      cx += arrowBtnW + btnGap;

      drawBtn(cx, rowY, arrowBtnW, arrowBtnH, "\u00BB", actions.coarsePlus, this.colors.calBtnBg, this.colors.calBtnText, rotation);
    };

    let rowY = panelY;
    drawArrowRow(rowY, "Width", {
      coarseMinus: "width-",
      fineMinus: "width-fine",
      finePlus: "width+fine",
      coarsePlus: "width+",
    });

    rowY += rowH + 2;
    drawArrowRow(rowY, "Height", {
      coarseMinus: "height-",
      fineMinus: "height-fine",
      finePlus: "height+fine",
      coarsePlus: "height+",
    }, -Math.PI / 2);

    rowY += rowH + 8;
    drawBtn(panelX, rowY, panelW, arrowBtnH, "Switch Corner", "switch-corner", this.colors.calCornerBg, this.colors.calCornerText);

    rowY += arrowBtnH + btnGap;
    const halfW = (panelW - btnGap) / 2;
    drawBtn(panelX, rowY, halfW, arrowBtnH, "Confirm", "confirm", this.colors.calConfirmBg, this.colors.calConfirmText);
    drawBtn(panelX + halfW + btnGap, rowY, halfW, arrowBtnH, "Cancel", "cancel", this.colors.calCancelBg, this.colors.calCancelText);

    return { x, y, buttons };
  }
}
