import type { ToolType } from "./types";

export interface KeybindingPreset {
  name: string;
  description: string;
  bindings: Record<string, string>; // tool name → key
}

export const PRESETS: KeybindingPreset[] = [
  {
    name: "CAD Standard",
    description: "L, R, C, M",
    bindings: { line: "l", rectangle: "r", circle: "c", calibrate: "m" },
  },
  {
    name: "Fusion 360",
    description: "L, R, C, I",
    bindings: { line: "l", rectangle: "r", circle: "c", calibrate: "i" },
  },
  {
    name: "Onshape",
    description: "L, G, C, D",
    bindings: { line: "l", rectangle: "g", circle: "c", calibrate: "d" },
  },
  {
    name: "Numeric",
    description: "1, 2, 3, C",
    bindings: { line: "1", rectangle: "2", circle: "3", calibrate: "c" },
  },
];

const STORAGE_KEY = "ruler2_keybinding_preset";

/** Build a reverse map: key → ToolType */
function buildKeyMap(preset: KeybindingPreset): Map<string, ToolType> {
  const map = new Map<string, ToolType>();
  for (const [tool, key] of Object.entries(preset.bindings)) {
    map.set(key.toLowerCase(), tool as ToolType);
  }
  return map;
}

export function loadPresetIndex(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) {
      const idx = parseInt(stored, 10);
      if (idx >= 0 && idx < PRESETS.length) return idx;
    }
  } catch {}
  return 0;
}

export function savePresetIndex(idx: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(idx));
  } catch {}
}

/** Get the shortcut key label for a given tool in the current preset */
export function getShortcutLabel(preset: KeybindingPreset, tool: string): string {
  const key = preset.bindings[tool];
  if (!key) return "";
  return key.toUpperCase();
}

/** Look up which tool a key press maps to, or null */
export function toolForKey(preset: KeybindingPreset, key: string): ToolType | null {
  const keyMap = buildKeyMap(preset);
  return keyMap.get(key.toLowerCase()) ?? null;
}
