import { describe, test, expect } from "bun:test";
import {
  dist,
  distXY,
  distToUnit,
  pxToUnit,
  formatValue,
  midpoint,
  polygonArea,
  formatArea,
  generateId,
  pointNear,
  detectDefaultUnit,
  arcLength,
  arcLengthToUnit,
  circumscribedCircle,
  computeTangentArcBulge,
  screenToWorld,
  worldToScreen,
  gridVisibleRange,
  vertexAngleDeg,
} from "./utils";
import type { Calibration, Point, PolylineMeasurement } from "./types";
import { polylineVertexAngles } from "./utils";

describe("dist", () => {
  test("returns 0 for same point", () => {
    expect(dist({ x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });

  test("horizontal distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(10);
  });

  test("vertical distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 0, y: 7 })).toBe(7);
  });

  test("diagonal distance (3-4-5 triangle)", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  test("works with negative coordinates", () => {
    expect(dist({ x: -3, y: -4 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe("distXY", () => {
  test("without calibration uses default PPI", () => {
    const result = distXY({ x: 0, y: 0 }, { x: 37.8, y: 0 }, null);
    expect(result.px).toBeCloseTo(37.8, 1);
    expect(result.mm).toBeCloseTo(10, 0); // ~10mm at default 3.78 px/mm
  });

  test("with calibration uses per-axis conversion", () => {
    const cal: Calibration = { pxPerMmX: 4, pxPerMmY: 4 };
    const result = distXY({ x: 0, y: 0 }, { x: 40, y: 0 }, cal);
    expect(result.px).toBeCloseTo(40, 1);
    expect(result.mm).toBeCloseTo(10, 1); // 40px / 4 px/mm = 10mm
  });

  test("with anisotropic calibration", () => {
    const cal: Calibration = { pxPerMmX: 4, pxPerMmY: 2 };
    // Move 40px in X (= 10mm) and 20px in Y (= 10mm)
    const result = distXY({ x: 0, y: 0 }, { x: 40, y: 20 }, cal);
    expect(result.mm).toBeCloseTo(Math.sqrt(100 + 100), 1); // sqrt(10^2 + 10^2)
  });
});

describe("pxToUnit", () => {
  const cal: Calibration = { pxPerMmX: 4, pxPerMmY: 4 };

  test("mm conversion", () => {
    expect(pxToUnit(40, cal, "mm")).toBeCloseTo(10, 1);
  });

  test("cm conversion", () => {
    expect(pxToUnit(40, cal, "cm")).toBeCloseTo(1, 1);
  });

  test("inch conversion", () => {
    // 40px / 4 px/mm = 10mm = 10/25.4 inches
    expect(pxToUnit(40, cal, "in")).toBeCloseTo(10 / 25.4, 3);
  });

  test("without calibration uses default", () => {
    const mm = pxToUnit(37.8, null, "mm");
    expect(mm).toBeCloseTo(10, 0);
  });
});

describe("distToUnit", () => {
  test("mm with calibration", () => {
    const cal: Calibration = { pxPerMmX: 5, pxPerMmY: 5 };
    const d = distToUnit({ x: 0, y: 0 }, { x: 50, y: 0 }, cal, "mm");
    expect(d).toBeCloseTo(10, 1);
  });
});

describe("formatValue", () => {
  test("mm shows 1 decimal", () => {
    expect(formatValue(12.345, "mm")).toBe("12.3 mm");
  });

  test("cm shows 2 decimals", () => {
    expect(formatValue(1.234, "cm")).toBe("1.23 cm");
  });

  test("in shows 2 decimals", () => {
    expect(formatValue(0.5, "in")).toBe("0.50 in");
  });
});

describe("midpoint", () => {
  test("calculates midpoint correctly", () => {
    const mid = midpoint({ x: 0, y: 0 }, { x: 10, y: 10 });
    expect(mid.x).toBe(5);
    expect(mid.y).toBe(5);
  });

  test("works with negative coords", () => {
    const mid = midpoint({ x: -10, y: -10 }, { x: 10, y: 10 });
    expect(mid.x).toBe(0);
    expect(mid.y).toBe(0);
  });
});

describe("polygonArea", () => {
  test("square area in mm with 1:1 calibration", () => {
    const cal: Calibration = { pxPerMmX: 1, pxPerMmY: 1 };
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
      { x: 0, y: 100 },
    ];
    expect(polygonArea(square, cal, "mm")).toBe(10000);
  });

  test("triangle area in mm with 1:1 calibration", () => {
    const cal: Calibration = { pxPerMmX: 1, pxPerMmY: 1 };
    const tri: Point[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 0, y: 10 },
    ];
    expect(polygonArea(tri, cal, "mm")).toBe(50);
  });

  test("area with calibration in mm", () => {
    const cal: Calibration = { pxPerMmX: 2, pxPerMmY: 2 };
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    // 400 px² / (2 * 2) = 100 mm²
    expect(polygonArea(square, cal, "mm")).toBe(100);
  });

  test("area in cm²", () => {
    const cal: Calibration = { pxPerMmX: 2, pxPerMmY: 2 };
    const square: Point[] = [
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 20 },
      { x: 0, y: 20 },
    ];
    // 100 mm² = 1 cm²
    expect(polygonArea(square, cal, "cm")).toBe(1);
  });
});

describe("formatArea", () => {
  test("mm shows 1 decimal with ² symbol", () => {
    expect(formatArea(100.5, "mm")).toBe("100.5 mm²");
  });
});

describe("generateId", () => {
  test("returns string of length 8", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBe(8);
  });

  test("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("detectDefaultUnit", () => {
  test("en-US returns inches", () => {
    expect(detectDefaultUnit("en-US")).toBe("in");
  });

  test("en-LR returns inches", () => {
    expect(detectDefaultUnit("en-LR")).toBe("in");
  });

  test("en-MM returns inches", () => {
    expect(detectDefaultUnit("en-MM")).toBe("in");
  });

  test("en-GB returns mm", () => {
    expect(detectDefaultUnit("en-GB")).toBe("mm");
  });

  test("fr-FR returns mm", () => {
    expect(detectDefaultUnit("fr-FR")).toBe("mm");
  });

  test("de returns mm", () => {
    expect(detectDefaultUnit("de")).toBe("mm");
  });

  test("en returns mm (no region)", () => {
    expect(detectDefaultUnit("en")).toBe("mm");
  });
});

describe("pointNear", () => {
  test("returns true for same point", () => {
    expect(pointNear({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toBe(true);
  });

  test("returns true within threshold", () => {
    expect(pointNear({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
  });

  test("returns false outside threshold", () => {
    expect(pointNear({ x: 0, y: 0 }, { x: 3, y: 4 }, 4)).toBe(false);
  });

  test("returns true at exact threshold", () => {
    expect(pointNear({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
  });
});

describe("circumscribedCircle", () => {
  test("returns null for collinear points", () => {
    expect(circumscribedCircle({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 })).toBeNull();
  });

  test("finds circle through 3 points on a known circle", () => {
    // Points on circle centered at (5,0) with radius 5
    const c = circumscribedCircle({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 });
    expect(c).not.toBeNull();
    expect(c!.cx).toBeCloseTo(5, 1);
    expect(c!.cy).toBeCloseTo(0, 1);
    expect(c!.r).toBeCloseTo(5, 1);
  });
});

describe("arcLength", () => {
  test("collinear points return chord length", () => {
    expect(arcLength({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 })).toBe(10);
  });

  test("semicircle has length π*r", () => {
    // Semicircle: start (0,0), mid (5,5), end (10,0) on circle centered at (5,0) r=5
    const len = arcLength({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 10, y: 0 });
    expect(len).toBeCloseTo(Math.PI * 5, 1); // π*r
  });

  test("arc through offset point is longer than chord", () => {
    const len = arcLength({ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 10, y: 0 });
    expect(len).toBeGreaterThan(10);
  });
});

describe("arcLengthToUnit", () => {
  test("converts collinear arc to mm with calibration", () => {
    const cal: Calibration = { pxPerMmX: 4, pxPerMmY: 4 };
    expect(arcLengthToUnit({ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 40, y: 0 }, cal, "mm")).toBeCloseTo(10, 1);
  });
});

describe("screenToWorld", () => {
  test("returns same point when pan is zero", () => {
    expect(screenToWorld({ x: 100, y: 200 }, 0, 0)).toEqual({ x: 100, y: 200 });
  });

  test("subtracts positive pan offset", () => {
    expect(screenToWorld({ x: 300, y: 400 }, 100, 50)).toEqual({ x: 200, y: 350 });
  });

  test("handles negative pan (panned left/up)", () => {
    expect(screenToWorld({ x: 100, y: 100 }, -50, -30)).toEqual({ x: 150, y: 130 });
  });

  test("roundtrips with worldToScreen", () => {
    const screen = { x: 500, y: 300 };
    const world = screenToWorld(screen, 120, -40);
    const back = worldToScreen(world, 120, -40);
    expect(back).toEqual(screen);
  });
});

describe("worldToScreen", () => {
  test("returns same point when pan is zero", () => {
    expect(worldToScreen({ x: 100, y: 200 }, 0, 0)).toEqual({ x: 100, y: 200 });
  });

  test("adds positive pan offset", () => {
    expect(worldToScreen({ x: 200, y: 350 }, 100, 50)).toEqual({ x: 300, y: 400 });
  });
});

describe("computeTangentArcBulge", () => {
  test("returns null for coincident points", () => {
    expect(computeTangentArcBulge({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 1, y: 0 })).toBeNull();
  });

  test("returns null when endpoint lies on tangent line", () => {
    // endpoint is directly ahead along the tangent
    expect(computeTangentArcBulge({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 1, y: 0 })).toBeNull();
    // endpoint is directly behind along the tangent
    expect(computeTangentArcBulge({ x: 0, y: 0 }, { x: -10, y: 0 }, { x: 1, y: 0 })).toBeNull();
  });

  test("horizontal tangent, endpoint up-right → arc curves upward", () => {
    const bulge = computeTangentArcBulge({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 1, y: 0 });
    expect(bulge).not.toBeNull();
    // Verify the arc passes through a point that is to the upper side
    // Center should be at (0, 10), r=10, bulge at midpoint angle
    const circle = circumscribedCircle({ x: 0, y: 0 }, bulge!, { x: 10, y: 10 });
    expect(circle).not.toBeNull();
    expect(circle!.cx).toBeCloseTo(0, 1);
    expect(circle!.cy).toBeCloseTo(10, 1);
    expect(circle!.r).toBeCloseTo(10, 1);
  });

  test("horizontal tangent, endpoint down-right → arc curves downward", () => {
    const bulge = computeTangentArcBulge({ x: 0, y: 0 }, { x: 10, y: -10 }, { x: 1, y: 0 });
    expect(bulge).not.toBeNull();
    const circle = circumscribedCircle({ x: 0, y: 0 }, bulge!, { x: 10, y: -10 });
    expect(circle).not.toBeNull();
    expect(circle!.cx).toBeCloseTo(0, 1);
    expect(circle!.cy).toBeCloseTo(-10, 1);
  });

  test("vertical tangent, endpoint to the right → arc curves right", () => {
    const bulge = computeTangentArcBulge({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 1 });
    expect(bulge).not.toBeNull();
    const circle = circumscribedCircle({ x: 0, y: 0 }, bulge!, { x: 10, y: 10 });
    expect(circle).not.toBeNull();
    expect(circle!.cx).toBeCloseTo(10, 1);
    expect(circle!.cy).toBeCloseTo(0, 1);
  });

  test("arc tangent direction at start matches input tangent", () => {
    const start = { x: 0, y: 0 };
    const end = { x: 10, y: 10 };
    const tangent = { x: 1, y: 0 };
    const bulge = computeTangentArcBulge(start, end, tangent)!;
    expect(bulge).not.toBeNull();

    // Verify tangent: radius from center to start, rotated 90°
    const circle = circumscribedCircle(start, bulge, end)!;
    const rx = start.x - circle.cx;
    const ry = start.y - circle.cy;
    // Determine sweep direction to pick correct tangent rotation
    const a1 = Math.atan2(start.y - circle.cy, start.x - circle.cx);
    const a2 = Math.atan2(bulge.y - circle.cy, bulge.x - circle.cx);
    const a3 = Math.atan2(end.y - circle.cy, end.x - circle.cx);
    // Normalize to determine direction
    const d2 = ((a2 - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const d3 = ((a3 - a1) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    let tx: number, ty: number;
    if (d2 < d3) {
      // CCW
      tx = -ry; ty = rx;
    } else {
      // CW
      tx = ry; ty = -rx;
    }
    const tLen = Math.sqrt(tx * tx + ty * ty);
    tx /= tLen; ty /= tLen;
    expect(tx).toBeCloseTo(tangent.x, 3);
    expect(ty).toBeCloseTo(tangent.y, 3);
  });

  test("diagonal tangent produces correct arc", () => {
    const tangent = { x: Math.SQRT1_2, y: Math.SQRT1_2 }; // 45°
    const bulge = computeTangentArcBulge({ x: 0, y: 0 }, { x: 0, y: 10 }, tangent);
    expect(bulge).not.toBeNull();
    // Arc should curve from (0,0) going NE, ending at (0,10)
    // Center is on the normal to tangent at start: normal = (-√2/2, √2/2), i.e. to the upper-left
    const circle = circumscribedCircle({ x: 0, y: 0 }, bulge!, { x: 0, y: 10 });
    expect(circle).not.toBeNull();
    expect(circle!.cx).toBeCloseTo(-5, 1);
    expect(circle!.cy).toBeCloseTo(5, 1);
  });
});

describe("gridVisibleRange", () => {
  test("no pan: range covers viewport", () => {
    const r = gridVisibleRange(0, 0, 1920, 1080, 50);
    expect(r.startX).toBeCloseTo(0);
    expect(r.startY).toBeCloseTo(0);
    expect(r.endX).toBe(1920);
    expect(r.endY).toBe(1080);
  });

  test("panned right: visible range shifts left in world coords", () => {
    const r = gridVisibleRange(100, 0, 1920, 1080, 50);
    // visible world x range: -100 to 1820
    expect(r.startX).toBe(-100);
    expect(r.endX).toBe(1820);
  });

  test("panned left: visible range shifts right in world coords", () => {
    const r = gridVisibleRange(-200, 0, 1920, 1080, 50);
    // visible world x range: 200 to 2120
    expect(r.startX).toBe(200);
    expect(r.endX).toBe(2120);
  });

  test("start snaps to grid step boundary", () => {
    const r = gridVisibleRange(73, 0, 1920, 1080, 50);
    // minX = -73, floor(-73/50)*50 = floor(-1.46)*50 = -2*50 = -100
    expect(r.startX).toBe(-100);
  });

  test("vertical pan works", () => {
    const r = gridVisibleRange(0, 150, 1920, 1080, 50);
    expect(r.startY).toBe(-150);
    expect(r.endY).toBe(930);
  });
});

describe("vertexAngleDeg", () => {
  test("right angle (90°)", () => {
    // L-shape: horizontal then vertical
    expect(vertexAngleDeg({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 })).toBeCloseTo(90, 1);
  });

  test("straight line (180°)", () => {
    expect(vertexAngleDeg({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 })).toBeCloseTo(180, 1);
  });

  test("equilateral triangle (60°)", () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    const c = { x: 50, y: 86.6025 }; // ~100 * sin(60°)
    expect(vertexAngleDeg(a, b, c)).toBeCloseTo(60, 0);
  });

  test("acute angle (45°)", () => {
    // Vectors from origin: (100,0) and (100,100) → 45°
    expect(vertexAngleDeg({ x: 100, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 100 })).toBeCloseTo(45, 0);
  });

  test("obtuse angle (135°)", () => {
    // Vectors from origin: (100,0) and (-100,100) → 135°
    expect(vertexAngleDeg({ x: 100, y: 0 }, { x: 0, y: 0 }, { x: -100, y: 100 })).toBeCloseTo(135, 0);
  });

  test("coincident points return 0", () => {
    expect(vertexAngleDeg({ x: 5, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 10 })).toBe(0);
    expect(vertexAngleDeg({ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 5 })).toBe(0);
  });
});

describe("polylineVertexAngles", () => {
  test("single segment has no angles", () => {
    const m: PolylineMeasurement = {
      kind: "polyline", id: "p1",
      start: { x: 0, y: 0 },
      segments: [{ end: { x: 100, y: 0 } }],
    };
    expect(polylineVertexAngles(m)).toEqual([]);
  });

  test("two segments produce one angle at junction", () => {
    // Right angle at (100,0)
    const m: PolylineMeasurement = {
      kind: "polyline", id: "p1",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 } },
        { end: { x: 100, y: 100 } },
      ],
    };
    const angles = polylineVertexAngles(m);
    expect(angles).toHaveLength(1);
    expect(angles[0]!.vertex).toEqual({ x: 100, y: 0 });
    expect(angles[0]!.degrees).toBeCloseTo(90, 1);
  });

  test("closed triangle has angles at all 3 vertices", () => {
    // Right triangle
    const m: PolylineMeasurement = {
      kind: "polyline", id: "p1",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 } },
        { end: { x: 0, y: 100 } },
        { end: { x: 0, y: 0 } }, // closing segment
      ],
      closed: true,
    };
    const angles = polylineVertexAngles(m);
    expect(angles).toHaveLength(3);
    // Sum of interior angles of a triangle = 180°
    const sum = angles.reduce((s, a) => s + a.degrees, 0);
    expect(sum).toBeCloseTo(180, 0);
  });

  test("closed square has 4 right angles", () => {
    const m: PolylineMeasurement = {
      kind: "polyline", id: "p1",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 } },
        { end: { x: 100, y: 100 } },
        { end: { x: 0, y: 100 } },
        { end: { x: 0, y: 0 } },
      ],
      closed: true,
    };
    const angles = polylineVertexAngles(m);
    expect(angles).toHaveLength(4);
    for (const a of angles) {
      expect(a.degrees).toBeCloseTo(90, 1);
    }
  });
});
