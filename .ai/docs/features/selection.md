# Selection

Cross-tool concern for selecting, nudging, cycling, and deleting measurement points. Click a point to select, arrow keys to nudge 0.5px, Tab to cycle, Delete to remove. Works identically across all measurement types.

```toon
status: stable
depends_on[1]: measurement-tools
entry_point: src/tool-manager.ts
test_cmd: bun test src/tool-manager.test.ts

files[3]{path,purpose}:
  src/tool-manager.ts,"Selection state; drag (deferred 3px threshold); hover; nudge; Tab cycle; Del/dblclick removal"
  src/keybind-registry.ts,"Selection context bindings; getHintHTML() for bottom bar"
  src/renderer.ts,Selected point highlight (yellow ring); crosshair on selected point
```

## Design Notes

- **Deferred drag**: mouseDown sets `dragPending`; mouseMove past 3px promotes to `isDragging`; mouseUp without threshold = select
- **Per-point polyline deletion**: Del on selected polyline point removes only that point (via `removePolylinePoint()`). Del on rectangle/circle deletes entire measurement
- **Double-click removal**: dblclick on selected polyline point removes it. dblclick on unselected polyline point also removes it
- **Bulge deletion**: Deleting a bulge point converts arc to straight line (segment preserved, just `delete seg.bulge`)
- **Keybinding registry**: Selection context has nudge/Tab/Del/Esc bindings with priority order for hint display
- **Nudge hide**: Labels hidden for 1.5s during nudge (avoids visual jitter) via `nudgeHideLabelsUntil`

## Gotchas

- Selection cleared on tool switch (`setActiveTool` calls `clearSelection()`)
- `getMeasurementPoints()` skips duplicate end point on closed polylines with explicit closing segment
- `setMeasurementPoint()` syncs closing segment end when moving start of closed polyline with arc
- Drag close snap during editing: dragging endpoint near start on unclosed polyline snaps and closes
