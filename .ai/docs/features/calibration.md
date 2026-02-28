# Calibration

Credit card overlay (ISO 7810: 85.6 x 53.98mm) for establishing physical-to-pixel ratios. User holds a credit card against the screen and resizes the overlay to match. Produces independent pxPerMmX and pxPerMmY values to handle non-square pixels.

```toon
status: stable
entry_point: src/tools/calibrate-tool.ts
test_cmd: bun test src/tools/calibrate-tool.test.ts

files[4]{path,purpose}:
  src/tools/calibrate-tool.ts,"Overlay UI; corner selection (left/right); button hit-testing; keyboard controls"
  src/renderer.ts,"drawCalibrationUI() renders overlay; drawCalibrationGate() shows uncalibrated warning"
  src/storage.ts,saveCalibration()/loadCalibration() in localStorage
  src/tool-manager.ts,shouldFlashCalibrate() — only flash when canvas has content
```

## Design Notes

- **Screen coordinates**: CalibrateTool is the only tool that uses screen coords (UI pinned to screen corners, not affected by pan)
- **Per-axis calibration**: `Calibration { pxPerMmX, pxPerMmY }` — not uniform, handles display DPI variance
- **Flash guard**: Calibrate button only flashes when uncalibrated AND canvas has measurements or active drawing. Empty canvas = no flash
- **Calibration gate**: Renderer hides measurement labels until calibrated (shows "PLEASE CALIBRATE" overlay)

## Gotchas

- CalibrateTool handles its own button hit-testing (`handleCalibrationClick`) — bypasses normal ToolManager event flow
- `calButtons` property set by renderer after drawing (renderer returns button hit areas)
- `renderer.resetPan()` called before drawing calibration UI to keep it screen-pinned
