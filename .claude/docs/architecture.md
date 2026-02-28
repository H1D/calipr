# Architecture

## Component Map

```toon
components[12]{name,type,path,responsibility}:
  main,entry,src/main.ts,DOM events; theme logic; draw loop; URL decode
  types,model,src/types.ts,Point; Measurement; Calibration; ToolType; Unit
  tool,interface,src/tool.ts,Tool strategy interface; ToolActions; ToolDrawState
  tool-manager,service,src/tool-manager.ts,Event delegation; shared state; drag/hover/selection; processActions()
  renderer,service,src/renderer.ts,Canvas 2D drawing; ThemeColors palettes; grid; labels; angle indicators
  utils,util,src/utils.ts,"Geometry (dist, circumscribedCircle, polylineVertexAngles); coordinate transforms"
  storage,repository,src/storage.ts,localStorage CRUD for calibration/measurements/pan
  keybindings,config,src/keybindings.ts,4 keyboard presets (CAD Standard/Fusion 360/Onshape/Numeric)
  keybind-registry,service,src/keybind-registry.ts,Centralized keybinding contexts; priority-sorted hint generation
  export-svg,service,src/export-svg.ts,SVG rendering with arc segments
  polyline-arc,util,src/polyline-arc.ts,Arc hold gesture; tangent constraints; close snap; bulge math
  share,service,src/share.ts,URL hash encode/decode with gzip (CompressionStream API)
```

## Data Flow

1. DOM event (mousedown/mousemove/keydown) fires on canvas
2. `main.ts` handler calls `ToolManager.handle*()` with screen coordinates
3. ToolManager converts to world coords via `screenToWorld()`
4. ToolManager delegates to `activeTool.on*()` passing world coords + context
5. Tool returns declarative `ToolActions` (never mutates shared state)
6. ToolManager interprets actions: push measurement, set calibration, or switch tool
7. Draw loop calls `manager.getDrawState()` → passes to `renderer.draw*()`
8. Renderer draws in world coordinates (canvas transform includes pan offset)

## Patterns

- **Strategy**: Tools implement `Tool` interface; ToolManager selects/delegates. Adding a tool = implement interface + register
- **Declarative actions**: Tools return `ToolActions` objects. Manager is sole state mutator
- **Cross-tool concerns**: Drag, hover, selection, keybind hints, calibrate flash — all on ToolManager, not per-tool
- **Deferred drag**: 3px threshold distinguishes click-to-select from drag-to-move
- **Dual-layer theming**: CSS variables for DOM elements + ThemeColors palette objects for canvas rendering
- **Bulge-point arcs**: Circular arcs stored as 3 points (start/bulge/end) — compact, renderer-friendly

## Boundaries

- **Persistence**: localStorage only (no backend). Keys: `ruler2_calibration`, `ruler2_measurements`, `ruler2_pan`
- **URL sharing**: Compact JSON → gzip → base64url in URL hash fragment. No server.
- **Coordinate systems**: World coords everywhere except CalibrateTool (screen coords for UI pinned to corners)
