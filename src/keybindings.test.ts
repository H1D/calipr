import { describe, test, expect, beforeEach } from "bun:test";
import { PRESETS, loadPresetIndex, savePresetIndex, getShortcutLabel, toolForKey } from "./keybindings";

beforeEach(() => {
  localStorage.clear();
});

describe("PRESETS", () => {
  test("has at least 2 presets", () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(2);
  });

  test("every preset has name, description, and all tool bindings", () => {
    const requiredTools = ["line", "rectangle", "circle", "calibrate"];
    for (const preset of PRESETS) {
      expect(typeof preset.name).toBe("string");
      expect(typeof preset.description).toBe("string");
      for (const tool of requiredTools) {
        expect(preset.bindings[tool]).toBeDefined();
      }
    }
  });

  test("no preset has duplicate keys", () => {
    for (const preset of PRESETS) {
      const keys = Object.values(preset.bindings).map((k) => k.toLowerCase());
      const unique = new Set(keys);
      expect(unique.size).toBe(keys.length);
    }
  });
});

describe("loadPresetIndex / savePresetIndex", () => {
  test("returns 0 when nothing stored", () => {
    expect(loadPresetIndex()).toBe(0);
  });

  test("saves and loads a valid index", () => {
    savePresetIndex(2);
    expect(loadPresetIndex()).toBe(2);
  });

  test("returns 0 for out-of-range index", () => {
    localStorage.setItem("ruler2_keybinding_preset", "999");
    expect(loadPresetIndex()).toBe(0);
  });

  test("returns 0 for corrupt data", () => {
    localStorage.setItem("ruler2_keybinding_preset", "garbage");
    expect(loadPresetIndex()).toBe(0);
  });
});

describe("getShortcutLabel", () => {
  test("returns uppercase key for CAD Standard (default) preset", () => {
    expect(getShortcutLabel(PRESETS[0]!, "line")).toBe("L");
    expect(getShortcutLabel(PRESETS[0]!, "calibrate")).toBe("M");
  });

  test("returns uppercase key for Fusion 360 preset", () => {
    const fusion = PRESETS.find((p) => p.name === "Fusion 360")!;
    expect(getShortcutLabel(fusion, "line")).toBe("L");
    expect(getShortcutLabel(fusion, "rectangle")).toBe("R");
  });

  test("returns empty string for unknown tool", () => {
    expect(getShortcutLabel(PRESETS[0]!, "nonexistent")).toBe("");
  });
});

describe("toolForKey", () => {
  test("maps keys to tools in CAD Standard (default) preset", () => {
    const preset = PRESETS[0]!;
    expect(toolForKey(preset, "l")).toBe("line");
    expect(toolForKey(preset, "r")).toBe("rectangle");
    expect(toolForKey(preset, "c")).toBe("circle");
    expect(toolForKey(preset, "m")).toBe("calibrate");
  });

  test("is case-insensitive", () => {
    const preset = PRESETS[0]!;
    expect(toolForKey(preset, "M")).toBe("calibrate");
  });

  test("maps keys to tools in Fusion 360 preset", () => {
    const fusion = PRESETS.find((p) => p.name === "Fusion 360")!;
    expect(toolForKey(fusion, "l")).toBe("line");
    expect(toolForKey(fusion, "r")).toBe("rectangle");
    expect(toolForKey(fusion, "c")).toBe("circle");
    expect(toolForKey(fusion, "i")).toBe("calibrate");
  });

  test("returns null for unmapped key", () => {
    expect(toolForKey(PRESETS[0]!, "z")).toBeNull();
    expect(toolForKey(PRESETS[0]!, "Enter")).toBeNull();
  });
});
