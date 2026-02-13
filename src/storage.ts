import type { Calibration, Measurement } from "./types";

const CALIBRATION_KEY = "ruler2_calibration";
const MEASUREMENTS_KEY = "ruler2_measurements";
const PAN_KEY = "ruler2_pan";

export function saveCalibration(cal: Calibration): void {
  localStorage.setItem(CALIBRATION_KEY, JSON.stringify(cal));
}

export function loadCalibration(): Calibration | null {
  const raw = localStorage.getItem(CALIBRATION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.pxPerMmX === "number" && typeof parsed.pxPerMmY === "number") {
      return parsed as Calibration;
    }
  } catch {}
  return null;
}

export function saveMeasurements(measurements: Measurement[]): void {
  localStorage.setItem(MEASUREMENTS_KEY, JSON.stringify(measurements));
}

export function loadMeasurements(): Measurement[] {
  const raw = localStorage.getItem(MEASUREMENTS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Migrate legacy LineMeasurement (kind:"line") → single-segment PolylineMeasurement
    return parsed.map((m: any) => {
      if (m.kind === "line" && Array.isArray(m.points) && m.points.length === 2) {
        return { kind: "polyline", id: m.id, start: m.points[0], segments: [{ end: m.points[1] }] };
      }
      return m;
    }) as Measurement[];
  } catch {}
  return [];
}

export function savePan(x: number, y: number): void {
  localStorage.setItem(PAN_KEY, JSON.stringify({ x, y }));
}

export function loadPan(): { x: number; y: number } | null {
  const raw = localStorage.getItem(PAN_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.x === "number" && typeof parsed.y === "number") {
      return parsed;
    }
  } catch {}
  return null;
}

export function clearStorage(): void {
  localStorage.removeItem(MEASUREMENTS_KEY);
}
