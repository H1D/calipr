import type { Point, Measurement, Calibration, Unit, PolylineSegment } from "./types";
import { distToUnit, formatValue, midpoint, pxToUnit, arcLengthToUnit, circumscribedCircle, angleSweepThrough, gridVisibleRange } from "./utils";

const POINT_RADIUS = 5;
const POINT_COLOR = "#6c47ff";
const POINT_HOVER_COLOR = "#9b7aff";
const LINE_COLOR = "#6c47ff";
const LINE_WIDTH = 2;
const PREVIEW_COLOR = "rgba(108, 71, 255, 0.5)";
const LABEL_BG = "rgba(255, 255, 255, 0.92)";
const LABEL_COLOR = "#333";
const LABEL_FONT = "13px 'Segoe UI', system-ui, sans-serif";
const GRID_COLOR = "rgba(0,0,0,0.04)";
const GRID_STEP = 50;

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private dpr = 1;
  private panX = 0;
  private panY = 0;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
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
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.translate(this.panX, this.panY);
  }

  drawGrid() {
    const ctx = this.ctx;
    ctx.strokeStyle = GRID_COLOR;
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

  drawPoint(p: Point, hovered = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(p.x, p.y, POINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = hovered ? POINT_HOVER_COLOR : POINT_COLOR;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawLine(a: Point, b: Point, preview = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = preview ? PREVIEW_COLOR : LINE_COLOR;
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

    ctx.fillStyle = LABEL_BG;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = LABEL_COLOR;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, pos.x + offset.x, pos.y + offset.y);
  }

  drawMeasurement(m: Measurement, cal: Calibration | null, unit: Unit, mousePos: Point | null, hoveredPointIdx: number | null) {
    switch (m.kind) {
      case "polyline":
        this.drawPolylineMeasurement(m.start, m.segments, !!m.closed, cal, unit, mousePos, hoveredPointIdx);
        break;
      case "rectangle":
        this.drawRectangleMeasurement(m.points[0], m.points[1], cal, unit, hoveredPointIdx);
        break;
      case "circle":
        this.drawCircleMeasurement(m.center, m.radiusPx, cal, unit, hoveredPointIdx);
        break;
    }
  }

  /**
   * Draw a circular arc through 3 points (start, mid, end).
   * The "mid" point lies on the arc between start and end.
   */
  drawArc(start: Point, mid: Point, end: Point, preview = false) {
    const ctx = this.ctx;
    const circle = circumscribedCircle(start, mid, end);

    if (!circle) {
      // Collinear: just draw a straight line
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
    ctx.strokeStyle = preview ? PREVIEW_COLOR : LINE_COLOR;
    ctx.lineWidth = LINE_WIDTH;
    ctx.setLineDash(preview ? [6, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawPolylineMeasurement(start: Point, segments: PolylineSegment[], closed: boolean, cal: Calibration | null, unit: Unit, mousePos: Point | null, hoveredPointIdx: number | null) {
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
      ctx.fillStyle = "rgba(108, 71, 255, 0.06)";
      ctx.fill();
    }

    let pointIdx = 0;

    // Draw start point
    this.drawPoint(start, hoveredPointIdx === pointIdx);
    pointIdx++;

    let prev = start;
    for (const seg of segments) {
      if (seg.bulge) {
        // Arc segment
        this.drawArc(prev, seg.bulge, seg.end);
        const len = arcLengthToUnit(prev, seg.bulge, seg.end, cal, unit);
        const mid = midpoint(prev, seg.end);
        this.drawLabel(formatValue(len, unit), mid, { x: 0, y: -20 });
        // Draw bulge control point (smaller, different style)
        this.drawBulgePoint(seg.bulge, hoveredPointIdx === pointIdx);
        pointIdx++;
      } else {
        // Straight segment
        this.drawLine(prev, seg.end);
        const len = distToUnit(prev, seg.end, cal, unit);
        const mid = midpoint(prev, seg.end);
        this.drawLabel(formatValue(len, unit), mid, { x: 0, y: -20 });
      }
      // Draw endpoint
      this.drawPoint(seg.end, hoveredPointIdx === pointIdx);
      pointIdx++;
      prev = seg.end;
    }

    // Implicit closing segment (when closed and last endpoint isn't already at start)
    if (closed && segments.length >= 2) {
      const dx = prev.x - start.x;
      const dy = prev.y - start.y;
      if (dx * dx + dy * dy > 0.25) {
        this.drawLine(prev, start);
        const len = distToUnit(prev, start, cal, unit);
        const mid = midpoint(prev, start);
        this.drawLabel(formatValue(len, unit), mid, { x: 0, y: -20 });
      }
    }

    // Preview line to mouse (only when not closed)
    if (!closed && mousePos) {
      this.drawLine(prev, mousePos, true);
      const len = distToUnit(prev, mousePos, cal, unit);
      const mid = midpoint(prev, mousePos);
      this.drawLabel(formatValue(len, unit), mid, { x: 0, y: -20 });
    }
  }

  drawBulgePoint(p: Point, hovered = false) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = hovered ? "#ff9b7a" : "#ff6b3d";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  drawCloseSnapRing(p: Point) {
    const ctx = this.ctx;
    // Outer pulsing ring
    ctx.beginPath();
    ctx.arc(p.x, p.y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(108, 71, 255, 0.5)";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Label
    ctx.font = "10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "rgba(108, 71, 255, 0.6)";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText("close", p.x + 18, p.y);
  }

  drawSnapGuide(from: Point, direction: Point, snapType: "tangent" | "perpendicular") {
    const ctx = this.ctx;
    const extent = 2000;

    const color = snapType === "tangent"
      ? "rgba(0, 180, 0, 0.3)"
      : "rgba(0, 120, 255, 0.3)";

    // Draw dashed guide line extending in both directions
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

    // Draw label near the from point
    const labelX = from.x + 12;
    const labelY = from.y - 12;
    ctx.font = "10px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(snapType, labelX, labelY);
  }

  drawRectangleMeasurement(a: Point, b: Point, cal: Calibration | null, unit: Unit, hoveredPointIdx: number | null) {
    const ctx = this.ctx;
    const x = Math.min(a.x, b.x);
    const y = Math.min(a.y, b.y);
    const w = Math.abs(b.x - a.x);
    const h = Math.abs(b.y - a.y);

    // Fill
    ctx.fillStyle = "rgba(108, 71, 255, 0.06)";
    ctx.fillRect(x, y, w, h);

    // Stroke
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = LINE_WIDTH;
    ctx.strokeRect(x, y, w, h);

    // Width label (top)
    const topMid: Point = { x: x + w / 2, y };
    const wVal = distToUnit({ x: a.x, y: 0 }, { x: b.x, y: 0 }, cal, unit);
    this.drawLabel(formatValue(wVal, unit), topMid, { x: 0, y: -18 });

    // Height label (right)
    const rightMid: Point = { x: x + w, y: y + h / 2 };
    const hVal = distToUnit({ x: 0, y: a.y }, { x: 0, y: b.y }, cal, unit);
    this.drawLabel(formatValue(hVal, unit), rightMid, { x: 24, y: 0 });

    // Corner points
    this.drawPoint(a, hoveredPointIdx === 0);
    this.drawPoint(b, hoveredPointIdx === 1);
  }

  drawCircleMeasurement(center: Point, radiusPx: number, cal: Calibration | null, unit: Unit, hoveredPointIdx: number | null) {
    const ctx = this.ctx;

    // Fill
    ctx.beginPath();
    ctx.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(108, 71, 255, 0.06)";
    ctx.fill();
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = LINE_WIDTH;
    ctx.stroke();

    // Radius line
    const edgePoint: Point = { x: center.x + radiusPx, y: center.y };
    this.drawLine(center, edgePoint);

    // Radius label
    const rVal = pxToUnit(radiusPx, cal, unit);
    const mid = midpoint(center, edgePoint);
    this.drawLabel("r = " + formatValue(rVal, unit), mid, { x: 0, y: -20 });

    // Diameter label
    this.drawLabel("d = " + formatValue(rVal * 2, unit), center, { x: 0, y: 20 });

    // Center point and edge point (both draggable)
    this.drawPoint(center, hoveredPointIdx === 0);
    this.drawPoint(edgePoint, hoveredPointIdx === 1);
  }

  drawCalibrationRect(x: number, y: number, widthPx: number, heightPx: number) {
    const ctx = this.ctx;
    // ISO 7810 credit card corner radius: 3.18mm on an 85.6mm wide card
    const cornerRadiusPx = 3.18 * (widthPx / 85.6);

    ctx.fillStyle = "rgba(220, 38, 38, 0.85)";
    ctx.beginPath();
    ctx.roundRect(x, y, widthPx, heightPx, cornerRadiusPx);
    ctx.fill();

    ctx.strokeStyle = "#dc2626";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, widthPx, heightPx, cornerRadiusPx);
    ctx.stroke();
  }

  drawCalibrationUI(widthPx: number, heightPx: number, corner: "left" | "right"): { x: number; y: number; buttons: Array<{ rect: { x: number; y: number; w: number; h: number }; action: string }> } {
    // Position at bottom-left or bottom-right using screen frame as guide
    const padding = 0;
    const x = corner === "left" ? padding : this.width - widthPx - padding;
    const y = this.height - heightPx - padding;

    this.drawCalibrationRect(x, y, widthPx, heightPx);

    const ctx = this.ctx;
    const buttons: Array<{ rect: { x: number; y: number; w: number; h: number }; action: string }> = [];

    // --- Instructions: positioned near the calibration rectangle ---
    // Align text based on which corner the rect is in to avoid off-screen overflow
    const textAlign: CanvasTextAlign = corner === "left" ? "left" : "right";
    const textX = corner === "left" ? Math.max(x, 16) : Math.min(x + widthPx, this.width - 16);
    const textBaseY = Math.max(80, y - 100); // ensure text stays within screen bounds

    ctx.font = "bold 14px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#333";
    ctx.textAlign = textAlign;
    ctx.textBaseline = "middle";
    ctx.fillText("Place your 💳credit card against the screen corner", textX, textBaseY);

    ctx.font = "13px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#666";
    ctx.textAlign = textAlign;
    ctx.fillText("Adjust size until card covers the red rectangle", textX, textBaseY + 22);
    ctx.textAlign = textAlign;
    ctx.fillText("[\u2190\u2192] adjust width \u00B7 [\u2191\u2193] adjust height \u00B7 hold [Shift] for fine", textX, textBaseY + 42);
    ctx.textAlign = textAlign;
    ctx.fillText("[TAB] switch corner \u00B7 [\u23CE Enter] confirm \u00B7 [Esc] cancel", textX, textBaseY + 62);

    // Show current dimensions
    ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
    ctx.fillStyle = "#999";
    ctx.textAlign = textAlign;
    ctx.fillText(`${widthPx.toFixed(1)} \u00D7 ${heightPx.toFixed(1)} px`, textX, textBaseY + 82);

    // --- Draw on-screen calibration buttons ---
    // Compact layout: [<<] [<] Label [>] [>>] per row
    const arrowBtnW = 32;
    const arrowBtnH = 26;
    const labelW = 100;
    const btnGap = 4;
    const rowH = arrowBtnH + btnGap;

    // Total row width: 4 arrow buttons + label + gaps
    const panelW = arrowBtnW * 4 + labelW + btnGap * 4;
    const panelX = corner === "left"
      ? Math.max(x + widthPx + 40, this.width / 2 - panelW / 2)
      : Math.min(x - 40 - panelW, this.width / 2 - panelW / 2);
    const panelY = this.height - 240;

    // Helper to draw a small button and register its hit area
    const drawBtn = (bx: number, by: number, bw: number, bh: number, label: string, action: string, color = "#f5f5f5", textColor = "#333", rotation = 0) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, 4);
      ctx.fill();
      ctx.strokeStyle = "#ccc";
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

    // Helper to draw a compact arrow row: [<<] [<] Label [>] [>>]
    const drawArrowRow = (rowY: number, label: string, actions: { coarseMinus: string; fineMinus: string; finePlus: string; coarsePlus: string }, rotation = 0) => {
      let cx = panelX;

      // [<<] coarse minus
      drawBtn(cx, rowY, arrowBtnW, arrowBtnH, "\u00AB", actions.coarseMinus, "#f5f5f5", "#333", rotation);
      cx += arrowBtnW + btnGap;

      // [<] fine minus
      drawBtn(cx, rowY, arrowBtnW, arrowBtnH, "\u2039", actions.fineMinus, "#f5f5f5", "#333", rotation);
      cx += arrowBtnW + btnGap;

      // Center label
      ctx.font = "12px 'Segoe UI', system-ui, sans-serif";
      ctx.fillStyle = "#333";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx + labelW / 2, rowY + arrowBtnH / 2);
      cx += labelW + btnGap;

      // [>] fine plus
      drawBtn(cx, rowY, arrowBtnW, arrowBtnH, "\u203A", actions.finePlus, "#f5f5f5", "#333", rotation);
      cx += arrowBtnW + btnGap;

      // [>>] coarse plus
      drawBtn(cx, rowY, arrowBtnW, arrowBtnH, "\u00BB", actions.coarsePlus, "#f5f5f5", "#333", rotation);
    };

    // Row 1: Width  [«] [‹] Width [›] [»]
    let rowY = panelY;
    drawArrowRow(rowY, "Width", {
      coarseMinus: "width-",
      fineMinus: "width-fine",
      finePlus: "width+fine",
      coarsePlus: "width+",
    });

    // Row 2: Height — same «‹›» symbols rotated -90° (CCW → pointing up/down)
    rowY += rowH + 2;
    drawArrowRow(rowY, "Height", {
      coarseMinus: "height+",
      fineMinus: "height+fine",
      finePlus: "height-fine",
      coarsePlus: "height-",
    }, -Math.PI / 2);

    // Row 3: Switch Corner (full width)
    rowY += rowH + 8;
    drawBtn(panelX, rowY, panelW, arrowBtnH, "Switch Corner", "switch-corner", "#e8e8ff", "#444");

    // Row 4: Confirm / Cancel
    rowY += arrowBtnH + btnGap;
    const halfW = (panelW - btnGap) / 2;
    drawBtn(panelX, rowY, halfW, arrowBtnH, "Confirm", "confirm", "#dcfce7", "#166534");
    drawBtn(panelX + halfW + btnGap, rowY, halfW, arrowBtnH, "Cancel", "cancel", "#fee2e2", "#991b1b");

    return { x, y, buttons };
  }
}
