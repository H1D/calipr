import { describe, test, expect, beforeEach } from "bun:test";
import {
  saveCalibration,
  loadCalibration,
  saveMeasurements,
  loadMeasurements,
  clearStorage,
  savePan,
  loadPan,
} from "./storage";
import type { Calibration, Measurement } from "./types";

// Mock localStorage for Bun test environment
const store: Record<string, string> = {};

const mockLocalStorage = {
  getItem: (key: string) => store[key] ?? null,
  setItem: (key: string, value: string) => { store[key] = value; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k of Object.keys(store)) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

// @ts-ignore -- mocking localStorage in test env
globalThis.localStorage = mockLocalStorage;

beforeEach(() => {
  mockLocalStorage.clear();
});

describe("calibration storage", () => {
  test("returns null when no calibration stored", () => {
    expect(loadCalibration()).toBeNull();
  });

  test("saves and loads calibration", () => {
    const cal: Calibration = { pxPerMmX: 3.5, pxPerMmY: 3.8 };
    saveCalibration(cal);
    const loaded = loadCalibration();
    expect(loaded).toEqual(cal);
  });

  test("handles corrupt data gracefully", () => {
    store["ruler2_calibration"] = "not json";
    expect(loadCalibration()).toBeNull();
  });

  test("handles invalid shape gracefully", () => {
    store["ruler2_calibration"] = JSON.stringify({ foo: "bar" });
    expect(loadCalibration()).toBeNull();
  });
});

describe("measurements storage", () => {
  test("returns empty array when nothing stored", () => {
    expect(loadMeasurements()).toEqual([]);
  });

  test("saves and loads measurements", () => {
    const measurements: Measurement[] = [
      {
        kind: "polyline",
        id: "abc123",
        start: { x: 0, y: 0 },
        segments: [{ end: { x: 100, y: 100 } }],
      },
    ];
    saveMeasurements(measurements);
    const loaded = loadMeasurements();
    expect(loaded).toEqual(measurements);
  });

  test("migrates legacy kind:'line' to polyline on load", () => {
    // Simulate old format stored in localStorage
    store["ruler2_measurements"] = JSON.stringify([
      { kind: "line", id: "legacy1", points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
    ]);
    const loaded = loadMeasurements();
    expect(loaded).toEqual([
      { kind: "polyline", id: "legacy1", start: { x: 0, y: 0 }, segments: [{ end: { x: 100, y: 100 } }] },
    ]);
  });

  test("handles corrupt data gracefully", () => {
    store["ruler2_measurements"] = "broken";
    expect(loadMeasurements()).toEqual([]);
  });

  test("clear removes measurements", () => {
    const measurements: Measurement[] = [
      {
        kind: "circle",
        id: "xyz",
        center: { x: 50, y: 50 },
        radiusPx: 30,
      },
    ];
    saveMeasurements(measurements);
    expect(loadMeasurements().length).toBe(1);
    clearStorage();
    expect(loadMeasurements()).toEqual([]);
  });
});

describe("pan storage", () => {
  test("returns null when no pan stored", () => {
    expect(loadPan()).toBeNull();
  });

  test("saves and loads pan", () => {
    savePan(120, -40);
    const loaded = loadPan();
    expect(loaded).toEqual({ x: 120, y: -40 });
  });

  test("handles corrupt data gracefully", () => {
    store["ruler2_pan"] = "broken";
    expect(loadPan()).toBeNull();
  });

  test("handles invalid shape gracefully", () => {
    store["ruler2_pan"] = JSON.stringify({ foo: "bar" });
    expect(loadPan()).toBeNull();
  });
});
