import { describe, test, expect } from "bun:test";
import { getHintHTML, getContextBindings } from "./keybind-registry";

describe("keybind-registry", () => {
  describe("completeness", () => {
    const contextIds = ["selection", "line.empty", "line.drawing", "rect.drawing", "circle.drawing", "snap"];

    test("every binding has a non-empty label and at least one key", () => {
      for (const id of contextIds) {
        for (const b of getContextBindings(id)) {
          expect(b.label.length).toBeGreaterThan(0);
          expect(b.keys.length).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  describe("hint generation", () => {
    test("selection context produces all selection labels in priority order", () => {
      const hint = getHintHTML(["selection"]);
      expect(hint).toContain("nudge");
      expect(hint).toContain("Tab");
      expect(hint).toContain("Del");
      expect(hint).toContain("Esc");
      // Check priority order: nudge before Tab before Del before Esc
      const nudgeIdx = hint.indexOf("nudge");
      const tabIdx = hint.indexOf("Tab");
      const delIdx = hint.indexOf("Del");
      const escIdx = hint.indexOf("Esc");
      expect(nudgeIdx).toBeLessThan(tabIdx);
      expect(tabIdx).toBeLessThan(delIdx);
      expect(delIdx).toBeLessThan(escIdx);
    });

    test("combined contexts merge and sort by priority", () => {
      const hint = getHintHTML(["line.drawing", "snap"]);
      expect(hint).toContain("Enter");
      expect(hint).toContain("Shift");
      // line.drawing priorities (10-12) come before snap priority (20)
      const enterIdx = hint.indexOf("Enter");
      const shiftIdx = hint.indexOf("Shift");
      expect(enterIdx).toBeLessThan(shiftIdx);
    });

    test("empty context returns empty string", () => {
      expect(getHintHTML(["line.empty"])).toBe("");
    });

    test("unknown context returns empty string", () => {
      expect(getHintHTML(["nonexistent"])).toBe("");
    });
  });
});
