import { describe, test, expect } from "bun:test";
import { captureFingerprint, fingerprintChanged } from "./screen-monitor";
import type { ScreenFingerprint } from "./screen-monitor";

// Mock window globals for test environment
// @ts-ignore
globalThis.window = globalThis.window ?? {};
// @ts-ignore
window.devicePixelRatio = 2;
// @ts-ignore
window.screen = { width: 1920, height: 1080 };

describe("captureFingerprint", () => {
  test("captures current DPR and screen dimensions", () => {
    const fp = captureFingerprint();
    expect(fp.dpr).toBe(2);
    expect(fp.screenWidth).toBe(1920);
    expect(fp.screenHeight).toBe(1080);
  });
});

describe("fingerprintChanged", () => {
  const base: ScreenFingerprint = { dpr: 2, screenWidth: 1920, screenHeight: 1080 };

  test("returns false for identical fingerprints", () => {
    expect(fingerprintChanged(base, { ...base })).toBe(false);
  });

  test("detects DPR change", () => {
    expect(fingerprintChanged(base, { ...base, dpr: 1 })).toBe(true);
  });

  test("detects screen width change", () => {
    expect(fingerprintChanged(base, { ...base, screenWidth: 2560 })).toBe(true);
  });

  test("detects screen height change", () => {
    expect(fingerprintChanged(base, { ...base, screenHeight: 1440 })).toBe(true);
  });

  test("detects combined DPR and dimension change", () => {
    expect(fingerprintChanged(base, { dpr: 1, screenWidth: 1366, screenHeight: 768 })).toBe(true);
  });
});
