import { describe, test, expect } from "bun:test";
import { exportSVG } from "./export-svg.ts";
import type {
  CircleMeasurement,
  RectangleMeasurement,
  PolylineMeasurement,
  Calibration,
} from "./types.ts";

const cal: Calibration = { pxPerMmX: 4, pxPerMmY: 4 };
const svgWidth = 1920;
const svgHeight = 1080;

describe("exportSVG", () => {
  test("returns valid SVG string", () => {
    const svg = exportSVG([], cal, "mm", svgWidth, svgHeight);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  test("empty measurements produces no geometry elements", () => {
    const svg = exportSVG([], cal, "mm", svgWidth, svgHeight);
    expect(svg).toContain('viewBox="0 0 1920 1080"');
    expect(svg).not.toContain("<line");
    expect(svg).not.toContain("<circle");
    expect(svg).not.toContain("<rect");
    expect(svg).not.toContain("<path");
  });

  test("single-segment polyline produces bare <path>", () => {
    const line: PolylineMeasurement = {
      kind: "polyline",
      id: "line1",
      start: { x: 100, y: 100 },
      segments: [{ end: { x: 300, y: 100 } }],
    };
    const svg = exportSVG([line], cal, "mm", svgWidth, svgHeight);
    expect(svg).toContain("<path");
    expect(svg).toContain("M 100 100");
    expect(svg).toContain("L 300 100");
    // No labels
    expect(svg).not.toContain("<text");
    // No colors
    expect(svg).not.toContain("#6c47ff");
  });

  test("circle produces bare <circle> with no radius line", () => {
    const circle: CircleMeasurement = {
      kind: "circle",
      id: "circle1",
      center: { x: 400, y: 400 },
      radiusPx: 100,
    };
    const svg = exportSVG([circle], cal, "mm", svgWidth, svgHeight);
    expect(svg).toContain('cx="400"');
    expect(svg).toContain('r="100"');
    expect(svg).toContain('fill="none"');
    // No radius line
    expect(svg).not.toContain("<line");
    // No labels
    expect(svg).not.toContain("<text");
  });

  test("rectangle produces bare <rect>", () => {
    const rect: RectangleMeasurement = {
      kind: "rectangle",
      id: "rect1",
      points: [
        { x: 50, y: 50 },
        { x: 250, y: 150 },
      ],
    };
    const svg = exportSVG([rect], cal, "mm", svgWidth, svgHeight);
    expect(svg).toContain('x="50"');
    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="100"');
    expect(svg).toContain('fill="none"');
    // No labels
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain("rgba(");
  });

  test("multi-segment polyline produces <path> with correct commands", () => {
    const polyline: PolylineMeasurement = {
      kind: "polyline",
      id: "poly1",
      start: { x: 100, y: 100 },
      segments: [
        { end: { x: 200, y: 100 } },
        { end: { x: 200, y: 200 } },
      ],
    };
    const svg = exportSVG([polyline], cal, "mm", svgWidth, svgHeight);
    expect(svg).toContain("M 100 100");
    expect(svg).toContain("L 200 100");
    expect(svg).toContain("L 200 200");
    expect(svg).not.toContain(" Z");
    expect(svg).toContain('fill="none"');
  });

  test("closed polyline has Z but no fill", () => {
    const closedPoly: PolylineMeasurement = {
      kind: "polyline",
      id: "poly2",
      start: { x: 100, y: 100 },
      segments: [
        { end: { x: 200, y: 100 } },
        { end: { x: 200, y: 200 } },
      ],
      closed: true,
    };
    const svg = exportSVG([closedPoly], cal, "mm", svgWidth, svgHeight);
    expect(svg).toContain(" Z");
    expect(svg).toContain('fill="none"');
  });

  test("arc segment produces A command in path", () => {
    const arcPoly: PolylineMeasurement = {
      kind: "polyline",
      id: "poly3",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 }, bulge: { x: 50, y: 50 } },
      ],
    };
    const svg = exportSVG([arcPoly], cal, "mm", svgWidth, svgHeight);
    expect(svg).toContain(" A ");
  });

  test("SVG includes correct viewBox dimensions", () => {
    const svg = exportSVG([], cal, "mm", 800, 600);
    expect(svg).toContain('viewBox="0 0 800 600"');
    expect(svg).toContain('width="800"');
    expect(svg).toContain('height="600"');
  });

  test("root SVG sets default stroke and no fill", () => {
    const svg = exportSVG([], cal, "mm", svgWidth, svgHeight);
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="black"');
    expect(svg).toContain('stroke-width="1"');
  });

  test("no labels, vertex markers, or colored elements anywhere", () => {
    const poly: PolylineMeasurement = {
      kind: "polyline",
      id: "p1",
      start: { x: 10, y: 20 },
      segments: [{ end: { x: 30, y: 40 } }],
    };
    const svg = exportSVG([poly], cal, "mm", svgWidth, svgHeight);
    expect(svg).not.toContain("<text");
    expect(svg).not.toContain('fill="#');
    expect(svg).not.toContain('stroke="#');
  });
});
