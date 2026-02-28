# Decisions

```toon
decisions[14]{id,date,title,status}:
  001,2026-02-12,Declarative ToolActions,accepted
  002,2026-02-12,World coords with pan offset,accepted
  003,2026-02-12,localStorage persistence,accepted
  004,2026-02-12,Credit card calibration,accepted
  005,2026-02-12,Bulge-point arcs,accepted
  006,2026-02-13,Dual-layer theming,accepted
  007,2026-02-13,Crosshair as cross-tool concern,accepted
  008,2026-02-13,Deferred drag for selection,accepted
  009,2026-02-13,Selection as cross-tool concern,accepted
  010,2026-02-13,URL hash sharing with gzip,accepted
  011,2026-02-16,Keybinding registry with forced labels,accepted
  012,2026-02-16,Per-point polyline deletion,accepted
  013,2026-02-16,Angle label suppression at arc junctions,accepted
  014,2026-02-18,Calibrate flash guard on empty canvas,accepted
```

## ADR-001: Declarative ToolActions

**Status**: accepted
**Date**: 2026-02-12
**Context**: Tools need to communicate results (new measurement, calibration change, tool switch) back to the manager.
**Decision**: Tools return `ToolActions` objects; manager interprets them. Tools never mutate shared state.
**Consequences**: Clean separation. Easy to test tools in isolation. Manager is sole state owner.

---

## ADR-002: World coords with pan offset

**Status**: accepted
**Date**: 2026-02-12
**Context**: Canvas needs scrolling/panning for large measurements.
**Decision**: `screenToWorld()`/`worldToScreen()` with simple pan vector offset. No zoom.
**Consequences**: All measurement data stored in world coords. Renderer applies pan via canvas translate.

---

## ADR-003: localStorage persistence

**Status**: accepted
**Date**: 2026-02-12
**Context**: Session persistence without backend.
**Decision**: localStorage with JSON serialization for calibration, measurements, and pan state.
**Consequences**: Simple, synchronous. Limited to ~5MB. No cross-device sync.

---

## ADR-004: Credit card calibration

**Status**: accepted
**Date**: 2026-02-12
**Context**: Need physical-to-pixel ratio for real-world measurements.
**Decision**: ISO 7810 credit card (85.6 x 53.98mm) overlay. User resizes to match card held against screen.
**Consequences**: Independent pxPerMmX/pxPerMmY (handles non-square pixels). Universally available reference object.

---

## ADR-005: Bulge-point arcs

**Status**: accepted
**Date**: 2026-02-12
**Context**: Arcs in polylines need compact, renderable storage.
**Decision**: Three-point storage (start/bulge/end) per segment. Bulge point lies on the arc.
**Consequences**: Compact (one optional Point per segment). Trivially renders via `circumscribedCircle()`. Tangent-constrained for smooth continuity.

---

## ADR-006: Dual-layer theming

**Status**: accepted
**Date**: 2026-02-13
**Context**: Dark mode needed for both CSS UI and canvas rendering.
**Decision**: CSS variables for DOM elements + `ThemeColors` palette objects for canvas. `setTheme(isDark)` swaps palette.
**Consequences**: Canvas colors not bound to CSS. Theme toggle is instant (no re-render needed).

---

## ADR-007: Crosshair as cross-tool concern

**Status**: accepted
**Date**: 2026-02-13
**Context**: Alignment guides needed during point placement and drag.
**Decision**: Computed in draw loop from existing manager state (isDragging, effectiveMousePos, selectedPos). No Tool interface changes.
**Consequences**: Zero tool awareness of crosshair. Works automatically for all tools and drag/select states.

---

## ADR-008: Deferred drag for selection

**Status**: accepted
**Date**: 2026-02-13
**Context**: Need click-to-select on measurement points without accidentally triggering drag.
**Decision**: 3px threshold. mouseDown sets `dragPending`; mouseMove past threshold promotes to `isDragging`; mouseUp without threshold = select.
**Consequences**: Natural feel. No mode switching needed. Works with all measurement types.

---

## ADR-009: Selection as cross-tool concern

**Status**: accepted
**Date**: 2026-02-13
**Context**: Point selection, arrow nudge (0.5px), Tab cycle needed across all tool types.
**Decision**: Selection state lives on ToolManager (like drag/hover). Not a separate Tool.
**Consequences**: Works identically for polylines, rectangles, circles. Selection cleared on tool switch.

---

## ADR-010: URL hash sharing with gzip

**Status**: accepted
**Date**: 2026-02-13
**Context**: Share measurements without backend.
**Decision**: Compact JSON (short field names) → gzip (CompressionStream API) → base64url in URL hash.
**Consequences**: No server needed. Works offline. URLs can be long for complex measurements but shareable.

---

## ADR-011: Keybinding registry with forced labels

**Status**: accepted
**Date**: 2026-02-16
**Context**: Keybindings scattered across tools and manager. Easy to add a key without visible hint.
**Decision**: Centralized `CONTEXTS` map with priority-sorted bindings. Tools declare `getActiveKeyContext()`. `getHintHTML()` composes visible hints.
**Consequences**: Every keybinding has a mandatory label. Hints auto-compose from active contexts. Adding a keybind without a label is structurally impossible.

---

## ADR-012: Per-point polyline deletion

**Status**: accepted
**Date**: 2026-02-16
**Context**: Delete on selected point deleted entire measurement — surprising for polylines with many points.
**Decision**: Polyline: `removePolylinePoint()` on selected point. Non-polyline: delete entire measurement. Double-click also removes selected polyline point.
**Consequences**: Granular editing for polylines. Bulge deletion converts arc to straight. 0-segment polyline auto-deleted.

---

## ADR-013: Angle label suppression at arc junctions

**Status**: accepted
**Date**: 2026-02-16
**Context**: Angles at line-arc junctions are always ~180° (tangent-constrained) — meaningless visual clutter.
**Decision**: `hasAdjacentArc` flag on `VertexAngle` set by `polylineVertexAngles()`. Renderer skips when true.
**Consequences**: Structural check (segment has bulge), not degree threshold. Accurate data preserved for other uses; only display filtered.

---

## ADR-014: Calibrate flash guard on empty canvas

**Status**: accepted
**Date**: 2026-02-18
**Context**: "CALIBRATE FIRST" button flash on empty canvas is annoying — nothing to calibrate yet.
**Decision**: `ToolManager.shouldFlashCalibrate()` returns false when no measurements and no active drawing.
**Consequences**: Flash only appears when there's actual content that needs calibration. Cleaner first-launch experience.
