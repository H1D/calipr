import { describe, test, expect } from "bun:test";
import { encodeMeasurements, decodeMeasurements } from "./share";
import type { Measurement } from "./types";

describe("share", () => {
  const sampleMeasurements: Measurement[] = [
    {
      kind: "polyline",
      id: "abc12345",
      start: { x: 10, y: 20 },
      segments: [{ end: { x: 100.123, y: 50.789 } }],
    },
    {
      kind: "rectangle",
      id: "def67890",
      points: [{ x: 0, y: 0 }, { x: 200, y: 150 }],
    },
    {
      kind: "circle",
      id: "ghi11111",
      center: { x: 300, y: 300 },
      radiusPx: 75.5,
    },
  ];

  test("roundtrips measurements through encode/decode", async () => {
    const encoded = await encodeMeasurements(sampleMeasurements);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);

    const decoded = await decodeMeasurements(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded!.length).toBe(3);

    // Polyline
    const poly = decoded![0]!;
    expect(poly.kind).toBe("polyline");
    if (poly.kind === "polyline") {
      expect(poly.start.x).toBe(10);
      expect(poly.start.y).toBe(20);
      expect(poly.segments[0]!.end.x).toBeCloseTo(100.1, 0);
      expect(poly.segments[0]!.end.y).toBeCloseTo(50.8, 0);
    }

    // Rectangle
    const rect = decoded![1]!;
    expect(rect.kind).toBe("rectangle");

    // Circle
    const circ = decoded![2]!;
    expect(circ.kind).toBe("circle");
    if (circ.kind === "circle") {
      expect(circ.radiusPx).toBeCloseTo(75.5, 0);
    }
  });

  test("handles closed polyline", async () => {
    const closed: Measurement[] = [{
      kind: "polyline",
      id: "closedpoly",
      start: { x: 0, y: 0 },
      segments: [
        { end: { x: 100, y: 0 } },
        { end: { x: 50, y: 80 } },
        { end: { x: 0, y: 0 } },
      ],
      closed: true,
    }];
    const encoded = await encodeMeasurements(closed);
    const decoded = await decodeMeasurements(encoded);
    expect(decoded).not.toBeNull();
    if (decoded![0]!.kind === "polyline") {
      expect(decoded![0]!.closed).toBe(true);
    }
  });

  test("handles arc bulge points", async () => {
    const arcPoly: Measurement[] = [{
      kind: "polyline",
      id: "arctest11",
      start: { x: 0, y: 0 },
      segments: [{ end: { x: 100, y: 0 }, bulge: { x: 50, y: 30 } }],
    }];
    const encoded = await encodeMeasurements(arcPoly);
    const decoded = await decodeMeasurements(encoded);
    expect(decoded).not.toBeNull();
    if (decoded![0]!.kind === "polyline") {
      expect(decoded![0]!.segments[0]!.bulge).toBeDefined();
      expect(decoded![0]!.segments[0]!.bulge!.x).toBe(50);
    }
  });

  test("returns null for invalid input", async () => {
    expect(await decodeMeasurements("!!!invalid!!!")).toBeNull();
    expect(await decodeMeasurements("")).toBeNull();
  });

  test("base64url has no padding or special chars", async () => {
    const encoded = await encodeMeasurements(sampleMeasurements);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });
});
