# Export & Share

SVG export for offline use and URL hash sharing for sending measurements without a backend.

```toon
status: stable
entry_point: src/export-svg.ts
test_cmd: "bun test src/export-svg.test.ts && bun test src/share.test.ts"

files[3]{path,purpose}:
  src/export-svg.ts,"exportSVG() renders all measurement types; downloadSVG() triggers browser download"
  src/share.ts,"encodeMeasurements() → compact JSON → gzip → base64url; loadFromHash() decodes on page load"
  src/main.ts,scheduleHashSync() debounces URL updates; loadFromHash() on startup
```

## Design Notes

- **SVG export**: Renders polylines (with arc `<path>` commands), rectangles, circles with labels. Uses calibration for unit conversion
- **Compact JSON**: Short field names (k=kind, s=start, sg=segments, etc.) to minimize URL length
- **Gzip**: CompressionStream API for payloads > threshold. Falls back to uncompressed for small data
- **URL format**: `#d=<base64url-encoded-data>`. Auto-syncs on measurement changes (debounced 300ms)
- **Calibration gate**: SVG export and share both work without calibration (labels show px values)

## Gotchas

- `setHash()` uses `history.replaceState` (not pushState) to avoid polluting browser history
- Hash sync is throttled: if an async encode/compress is in flight, new syncs are skipped
- `loadFromHash()` runs once on page load — replaces all measurements with shared data
