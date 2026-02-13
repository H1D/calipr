import type { ToolType, Unit } from "./types";
import { detectDefaultUnit } from "./utils";
import { Renderer } from "./renderer";
import { loadCalibration, loadMeasurements, clearStorage, savePan, loadPan } from "./storage";
import { PRESETS, loadPresetIndex, savePresetIndex, getShortcutLabel, toolForKey } from "./keybindings";
import { exportSVG, downloadSVG } from "./export-svg";
import { ToolManager } from "./tool-manager";
import { CalibrateTool } from "./tools/calibrate-tool";
import { RectangleTool } from "./tools/rectangle-tool";
import { CircleTool } from "./tools/circle-tool";
import { LineTool } from "./tools/line-tool";

// --- Initialize State ---
const initialCal = loadCalibration();
const initialMeasurements = loadMeasurements();
const savedPan = loadPan();

const manager = new ToolManager(
  initialMeasurements,
  initialCal,
  detectDefaultUnit(navigator.language),
  savedPan?.x ?? 0,
  savedPan?.y ?? 0,
);

// Register all tools
const lineTool = new LineTool();
const rectangleTool = new RectangleTool();
const circleTool = new CircleTool();
const calibrateTool = new CalibrateTool(initialCal);

manager.registerTool(lineTool);
manager.registerTool(rectangleTool);
manager.registerTool(circleTool);
manager.registerTool(calibrateTool);
manager.setActiveTool("line");

// --- DOM ---
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const toolbar = document.getElementById("toolbar")!;
const helpHint = document.getElementById("help-hint")!;
const unitSelector = document.getElementById("unit-selector")!;
const settingsBtn = document.getElementById("settings-btn")!;
const settingsPanel = document.getElementById("settings-panel")!;
const keybindingSelect = document.getElementById("keybinding-select") as HTMLSelectElement;
const exportSvgBtn = document.getElementById("export-svg-btn")!;
const zoomToast = document.getElementById("zoom-toast")!;
const themeSelector = document.getElementById("theme-selector")!;

// --- Theme ---
type ThemePreference = "auto" | "light" | "dark";
const THEME_KEY = "ruler2_theme";
const darkMQ = window.matchMedia("(prefers-color-scheme: dark)");

function loadThemePreference(): ThemePreference {
  const v = localStorage.getItem(THEME_KEY);
  if (v === "light" || v === "dark") return v;
  return "auto";
}

function saveThemePreference(pref: ThemePreference) {
  localStorage.setItem(THEME_KEY, pref);
}

function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref === "auto") return darkMQ.matches ? "dark" : "light";
  return pref;
}

let themePref = loadThemePreference();

function applyTheme() {
  const resolved = resolveTheme(themePref);
  const isDark = resolved === "dark";
  document.documentElement.setAttribute("data-theme", resolved);
  renderer.setTheme(isDark);
}

function updateThemeUI() {
  themeSelector.querySelectorAll(".unit-btn").forEach((btn) => {
    const el = btn as HTMLElement;
    el.classList.toggle("active", el.dataset.themePref === themePref);
  });
}

darkMQ.addEventListener("change", () => {
  if (themePref === "auto") applyTheme();
});

// Keybinding preset
let presetIndex = loadPresetIndex();
let currentPreset = PRESETS[presetIndex]!;

// --- Initialize ---
applyTheme();
updateThemeUI();
renderer.setPan(manager.panX, manager.panY);
initSettingsPanel();
updateCalibrateButtonFlash();
updateToolbarUI();
updateUnitUI();
updateShortcutLabels();
requestAnimationFrame(draw);

// --- Drawing Loop ---
function draw() {
  updateHelpHint();
  renderer.clear();
  renderer.drawGrid();

  const drawState = manager.getDrawState();

  if (drawState.calibrationUI) {
    renderer.resetPan();
    const calResult = renderer.drawCalibrationUI(
      drawState.calibrationUI.widthPx,
      drawState.calibrationUI.heightPx,
      drawState.calibrationUI.corner,
    );
    // Store button hit areas back on the calibration tool
    const calTool = manager.activeTool as CalibrateTool;
    calTool.calButtons = calResult.buttons;
  } else {
    // Draw completed measurements
    for (const m of manager.measurements) {
      const hIdx = manager.hoveredMeasurementId === m.id ? manager.hoveredPointIdx : null;
      renderer.drawMeasurement(m, manager.calibration, manager.unit, null, hIdx);
    }

    // Draw close snap ring during drag (editing completed measurement)
    if (manager.dragCloseSnapPoint) {
      renderer.drawCloseSnapRing(manager.dragCloseSnapPoint);
    }

    // Draw active measurement
    if (drawState.activeMeasurement) {
      renderer.drawMeasurement(drawState.activeMeasurement, manager.calibration, manager.unit, drawState.effectiveMousePos, null);

      if (drawState.closeSnapRing) {
        renderer.drawCloseSnapRing(drawState.closeSnapRing);
      }
    }

    // Draw snap guide
    if (drawState.snapGuide) {
      renderer.drawSnapGuide(drawState.snapGuide.from, drawState.snapGuide.direction, drawState.snapGuide.snapType);
    }
  }

  requestAnimationFrame(draw);
}

// --- Tool Switching ---
function setTool(t: ToolType) {
  manager.setActiveTool(t);
  updateToolbarUI();
  updateCalibrateButtonFlash();
  updateHelpHint();

  if (t === "calibrate") {
    canvas.style.cursor = "default";
  } else {
    canvas.style.cursor = "crosshair";
  }
}

function updateToolbarUI() {
  toolbar.querySelectorAll(".tool-btn").forEach((btn) => {
    const el = btn as HTMLElement;
    el.classList.toggle("active", el.dataset.tool === manager.activeToolName);
  });
}

function updateUnitUI() {
  unitSelector.querySelectorAll(".unit-btn").forEach((btn) => {
    const el = btn as HTMLElement;
    el.classList.toggle("active", el.dataset.unit === manager.unit);
  });
}

function updateCalibrateButtonFlash() {
  const btn = toolbar.querySelector('.tool-btn[data-tool="calibrate"]') as HTMLElement | null;
  if (!btn) return;
  if (manager.calibration === null && manager.measurements.length > 0 && manager.activeToolName !== "calibrate") {
    btn.classList.add("flash-calibrate");
  } else {
    btn.classList.remove("flash-calibrate");
  }
}

let lastHintHTML = "";

function updateHelpHint() {
  const html = manager.getHelpHint();
  if (html === lastHintHTML) return;
  lastHintHTML = html;
  helpHint.innerHTML = html;
  helpHint.style.opacity = html ? "1" : "0";
}

// --- Mouse Events ---
canvas.addEventListener("mousemove", (e) => {
  manager.handleMouseMove({ x: e.clientX, y: e.clientY });

  // Update cursor based on hover/drag state
  if (!manager.isPanning && !manager.isDragging && !manager.activeTool.hasActiveMeasurement() && !manager.spaceHeld) {
    if (manager.hoveredMeasurementId) {
      canvas.style.cursor = "grab";
    } else {
      canvas.style.cursor = manager.activeToolName === "calibrate" ? "default" : "crosshair";
    }
  }
});

canvas.addEventListener("mousedown", (e) => {
  if (manager.isPanning) return;
  if (e.button !== 0) return;

  // Handle calibration button clicks (screen coords)
  if (manager.activeToolName === "calibrate") {
    const calTool = manager.activeTool as CalibrateTool;
    const actions = calTool.handleCalibrationClick({ x: e.clientX, y: e.clientY });
    manager.processActions(actions);
    updateCalibrateButtonFlash();
    updateToolbarUI();
    if (actions.switchTool) {
      canvas.style.cursor = actions.switchTool === "calibrate" ? "default" : "crosshair";
    }
    return;
  }

  const consumed = manager.handleMouseDown({ x: e.clientX, y: e.clientY });
  if (manager.isDragging) {
    canvas.style.cursor = "grabbing";
  }
  updateCalibrateButtonFlash();
});

canvas.addEventListener("mouseup", (e) => {
  if (e.button !== 0) return;
  const wasDragging = manager.isDragging;
  manager.handleMouseUp({ x: e.clientX, y: e.clientY });
  if (wasDragging) {
    canvas.style.cursor = "crosshair";
  }
  updateCalibrateButtonFlash();
});

canvas.addEventListener("dblclick", () => {
  manager.handleDblClick();
  updateCalibrateButtonFlash();
});

// --- Keyboard Events ---
document.addEventListener("keydown", (e) => {
  // Tool shortcuts via keybinding preset
  const mappedTool = toolForKey(currentPreset, e.key);
  if (mappedTool) {
    setTool(mappedTool);
    return;
  }

  // Calibrate tool needs preventDefault for arrow keys/tab/enter/escape
  if (manager.activeToolName === "calibrate") {
    if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Tab", "Enter", "Escape"].includes(e.key)) {
      e.preventDefault();
    }
  }

  const actions = manager.handleKeyDown(e.key, e.shiftKey);
  updateCalibrateButtonFlash();
  if (actions?.switchTool) {
    updateToolbarUI();
    canvas.style.cursor = actions.switchTool === "calibrate" ? "default" : "crosshair";
  }
});

// --- Shift key tracking ---
document.addEventListener("keydown", (e) => { if (e.key === "Shift") manager.shiftHeld = true; });
document.addEventListener("keyup", (e) => { if (e.key === "Shift") manager.shiftHeld = false; });

// --- Toolbar Clicks ---
toolbar.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest(".tool-btn") as HTMLElement | null;
  if (!btn) return;
  btn.blur();

  const t = btn.dataset.tool;
  if (t === "clear") {
    manager.clearAll();
    clearStorage();
    updateCalibrateButtonFlash();
    return;
  }
  if (t) {
    setTool(t as ToolType);
  }
});

// --- Unit Selector ---
unitSelector.addEventListener("click", (e) => {
  const btn = (e.target as HTMLElement).closest(".unit-btn") as HTMLElement | null;
  if (!btn) return;
  const u = btn.dataset.unit as Unit;
  if (u) {
    manager.unit = u;
    updateUnitUI();
  }
});

// --- Settings Panel ---
function initSettingsPanel() {
  for (let i = 0; i < PRESETS.length; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${PRESETS[i]!.name} (${PRESETS[i]!.description})`;
    keybindingSelect.appendChild(opt);
  }
  keybindingSelect.value = String(presetIndex);

  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.toggle("open");
    settingsBtn.classList.toggle("active", settingsPanel.classList.contains("open"));
  });

  document.addEventListener("mousedown", (e) => {
    if (settingsPanel.classList.contains("open") &&
        !settingsPanel.contains(e.target as Node) &&
        !settingsBtn.contains(e.target as Node)) {
      settingsPanel.classList.remove("open");
      settingsBtn.classList.remove("active");
    }
  });

  keybindingSelect.addEventListener("change", () => {
    presetIndex = parseInt(keybindingSelect.value, 10);
    currentPreset = PRESETS[presetIndex]!;
    savePresetIndex(presetIndex);
    updateShortcutLabels();
  });

  exportSvgBtn.addEventListener("click", () => {
    const svg = exportSVG(manager.measurements, manager.calibration, manager.unit);
    downloadSVG(svg, "ruler-measurements.svg");
  });

  themeSelector.addEventListener("click", (e) => {
    const btn = (e.target as HTMLElement).closest(".unit-btn") as HTMLElement | null;
    if (!btn) return;
    const pref = btn.dataset.themePref as ThemePreference | undefined;
    if (pref) {
      themePref = pref;
      saveThemePreference(pref);
      applyTheme();
      updateThemeUI();
    }
  });
}

function updateShortcutLabels() {
  toolbar.querySelectorAll(".tool-btn").forEach((btn) => {
    const el = btn as HTMLElement;
    const toolName = el.dataset.tool;
    if (!toolName) return;
    const shortcutSpan = el.querySelector(".shortcut");
    if (shortcutSpan) {
      shortcutSpan.textContent = getShortcutLabel(currentPreset, toolName);
    }
  });
}

// --- Panning (Space+drag or middle mouse button) ---
canvas.addEventListener("pointerdown", (e) => {
  if (e.button === 1 || (e.button === 0 && manager.spaceHeld)) {
    e.preventDefault();
    manager.isPanning = true;
    manager.panStartScreen = { x: e.clientX, y: e.clientY };
    manager.panStartPan = { x: manager.panX, y: manager.panY };
    manager.panPointerId = e.pointerId;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  }
});

canvas.addEventListener("pointermove", (e) => {
  if (!manager.isPanning || !manager.panStartScreen || !manager.panStartPan) return;
  manager.panX = manager.panStartPan.x + (e.clientX - manager.panStartScreen.x);
  manager.panY = manager.panStartPan.y + (e.clientY - manager.panStartScreen.y);
  renderer.setPan(manager.panX, manager.panY);
});

canvas.addEventListener("pointerup", () => {
  if (!manager.isPanning) return;
  manager.isPanning = false;
  manager.panStartScreen = null;
  manager.panStartPan = null;
  if (manager.panPointerId !== null) {
    canvas.releasePointerCapture(manager.panPointerId);
    manager.panPointerId = null;
  }
  canvas.style.cursor = manager.spaceHeld ? "grab" : (manager.activeToolName === "calibrate" ? "default" : "crosshair");
  savePan(manager.panX, manager.panY);
});

canvas.addEventListener("auxclick", (e) => {
  if (e.button === 1) e.preventDefault();
});

// Space key for pan mode
document.addEventListener("keydown", (e) => {
  if (e.key === " " && !manager.spaceHeld) {
    e.preventDefault();
    manager.spaceHeld = true;
    if (!manager.isPanning) canvas.style.cursor = "grab";
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === " ") {
    manager.spaceHeld = false;
    if (manager.isPanning) {
      manager.isPanning = false;
      manager.panStartScreen = null;
      manager.panStartPan = null;
      if (manager.panPointerId !== null) {
        canvas.releasePointerCapture(manager.panPointerId);
        manager.panPointerId = null;
      }
      savePan(manager.panX, manager.panY);
    }
    canvas.style.cursor = manager.activeToolName === "calibrate" ? "default" : "crosshair";
  }
});

// --- Zoom prevention ---
let zoomToastTimeout: ReturnType<typeof setTimeout> | null = null;

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  if (!zoomToastTimeout) {
    zoomToast.classList.add("visible");
  }
  if (zoomToastTimeout) clearTimeout(zoomToastTimeout);
  zoomToastTimeout = setTimeout(() => {
    zoomToast.classList.remove("visible");
    zoomToastTimeout = null;
  }, 2000);
}, { passive: false });

// --- Resize ---
window.addEventListener("resize", () => {
  renderer.resize();
});

// --- Initial hint ---
updateHelpHint();
