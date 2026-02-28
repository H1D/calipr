# Measurement Tools

Strategy-pattern tool system for drawing measurements on a canvas. Three measurement types: polylines (with optional arc segments), rectangles (two-click corners), and circles (center + edge). Tools return declarative `ToolActions` — never mutate shared state.

```toon
status: stable
entry_point: src/tool.ts
test_cmd: bun test src/tools/

files[7]{path,purpose}:
  src/tool.ts,Tool interface; ToolContext; ToolActions; ToolDrawState
  src/tool-manager.ts,Event delegation; state ownership; cross-tool concerns
  src/tools/line-tool.ts,"Polyline with arcs; snap (tangent/perp); close detect; ~310 LOC"
  src/tools/rectangle-tool.ts,Two-click corner flow; ~78 LOC
  src/tools/circle-tool.ts,Two-click center+edge flow; ~80 LOC
  src/renderer.ts,Canvas 2D drawing for all measurement types
  src/polyline-arc.ts,Arc gesture math; tangent constraints; close snap
```

## Design Notes

- **Tool interface**: `onClick`, `onMouseMove`, `onMouseUp`, `onDblClick`, `onKeyDown`, `getDrawState`, `getHelpHint`, `getActiveKeyContext`, `hasActiveMeasurement`
- **ToolActions**: `{ completeMeasurement?, setCalibration?, switchTool? }` — manager interprets, never tools
- **ToolManager.processActions()**: sole state mutator. Pushes completed measurements, updates calibration, switches tools
- **LineTool is the complex one** (310 LOC): arc hold gesture (200ms timer), tangent/perpendicular snap, close detection, per-segment undo

## Gotchas

- Tools receive world coordinates (already pan-adjusted). Exception: CalibrateTool uses screen coords
- `onKeyDown` returning `null` means "not handled" — manager checks fallback (delete hovered, etc.)
- LineTool's arc gesture uses a 200ms setTimeout that can be cancelled by mouseUp before it fires
- Close snap requires >= 2 segments and mouse within 24px of start point
