# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev            # Dev server at http://localhost:3000 (hot reload via serve.ts)
bun test               # Run all tests (bun:test runner)
bun test src/tools/    # Run tests in a directory
bun test --filter "LineTool"  # Run tests matching a pattern
npx tsc --noEmit       # Type check (strict mode, no output)
npx vite build         # Production build to dist/
```

After any code change, verify with: `npx tsc --noEmit && bun test`

## Architecture

Canvas-based screen measurement tool. No frameworks, no backend — vanilla TypeScript with Canvas 2D API and localStorage persistence.

### Tool-Based Strategy Pattern

The app uses the Strategy pattern where each drawing tool is a class implementing the `Tool` interface (`src/tool.ts`). The `ToolManager` (`src/tool-manager.ts`) holds shared state and delegates events to the active tool.

**Event flow:**
```
DOM event → main.ts → ToolManager.handle*() → activeTool.on*() → ToolActions
                                                                      ↓
                                              ToolManager.processActions() ← interprets
```

Tools return `ToolActions` objects (declarative) rather than mutating shared state directly. The ToolManager interprets actions: `completeMeasurement` adds to the measurements array, `setCalibration` updates calibration, `switchTool` changes the active tool.

**Tool implementations** (`src/tools/`):
- `LineTool` — polyline with arc segments; manages arc hold timeout (200ms), tangent/perpendicular snap, close detection. Most complex tool (~300 lines). `computeSnap()` lives here.
- `RectangleTool` / `CircleTool` — simple two-click flows (~75 lines each)
- `CalibrateTool` — credit card overlay UI with keyboard/button controls. Uses screen coordinates (not world coordinates) for button hit-testing.

**Cross-tool concerns** handled by ToolManager:
- Dragging completed measurement points (priority over tool clicks)
- Hover detection on completed measurement points
- Double-click to remove polyline points
- Delete/Backspace to remove hovered measurement (fallback when tool returns null)
- Snap hint suffix in help text

### Polyline Arc System (`src/polyline-arc.ts`)

Polyline segments have optional `bulge` points that define circular arcs through three points (start, bulge, end). Arc creation uses a hold-to-drag gesture: click adds a straight segment, holding 200ms+ switches to arc mode where dragging shapes the curve. Arcs are tangent-constrained to the previous segment for smooth continuity.

### Key Modules

- `types.ts` — `Point`, `Measurement` (union of polyline/rectangle/circle), `Calibration`, `ToolType`, `Unit`
- `renderer.ts` — Canvas 2D drawing (parameter-driven, no state). Handles grid, measurements, labels, calibration UI, snap guides.
- `utils.ts` — Geometry math (distance, area, arc length, circumscribed circle, tangent arc bulge computation, coordinate transforms)
- `storage.ts` — localStorage persistence for calibration, measurements, pan position
- `keybindings.ts` — 4 keyboard presets (CAD Standard, Fusion 360, Onshape, Numeric)
- `export-svg.ts` — SVG export with arc segments (SVG `A` command)

### Coordinate System

World coordinates with pan offset. `screenToWorld()` / `worldToScreen()` convert between screen pixels and world position. The calibration tool is the exception — it uses screen coordinates directly since its UI is pinned to screen corners.

### Calibration

Physical measurements use a credit card (85.6 x 53.98mm, ISO 7810) as reference. Users resize an on-screen rectangle to match their card, establishing px-per-mm ratios for X and Y independently (handles non-square pixels).
