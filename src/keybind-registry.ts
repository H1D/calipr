export interface KeyBinding {
  keys: string[];
  label: string;
  priority: number;
}

export interface KeyContext {
  bindings: KeyBinding[];
}

const CONTEXTS: Record<string, KeyContext> = {
  "selection": {
    bindings: [
      { keys: ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"], label: "<kbd>←→↑↓</kbd> nudge 0.5px", priority: 0 },
      { keys: ["Tab"], label: "<kbd>Tab</kbd> next point", priority: 1 },
      { keys: ["Delete", "Backspace"], label: "<kbd>Del</kbd> delete", priority: 2 },
      { keys: ["Escape"], label: "<kbd>Esc</kbd> deselect", priority: 3 },
    ],
  },
  "line.empty": {
    bindings: [],
  },
  "line.drawing": {
    bindings: [
      { keys: ["Enter"], label: "<kbd>Enter</kbd> finish", priority: 10 },
      { keys: ["Escape"], label: "<kbd>Esc</kbd> finish", priority: 11 },
      { keys: ["Delete", "Backspace"], label: "<kbd>Del</kbd> undo last", priority: 12 },
    ],
  },
  "rect.drawing": {
    bindings: [
      { keys: ["Escape"], label: "<kbd>Esc</kbd> cancel", priority: 10 },
    ],
  },
  "circle.drawing": {
    bindings: [
      { keys: ["Escape"], label: "<kbd>Esc</kbd> cancel", priority: 10 },
    ],
  },
  "snap": {
    bindings: [
      { keys: ["Shift"], label: "hold <kbd>Shift</kbd> to ignore snap", priority: 20 },
    ],
  },
};

export function getContextBindings(contextId: string): KeyBinding[] {
  return CONTEXTS[contextId]?.bindings ?? [];
}

export function getHintHTML(contextIds: string[]): string {
  const allBindings: KeyBinding[] = [];
  for (const id of contextIds) {
    allBindings.push(...getContextBindings(id));
  }
  allBindings.sort((a, b) => a.priority - b.priority);
  return allBindings.map((b) => b.label).join(" · ");
}
