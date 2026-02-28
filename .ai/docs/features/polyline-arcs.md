# Polyline Arcs

Arc segments in polylines using bulge-point storage. Each segment optionally stores a `bulge: Point` that defines a circular arc through (start, bulge, end). Arcs are tangent-constrained to the previous segment for smooth G1 continuity.

```toon
status: stable
depends_on[1]: measurement-tools
entry_point: src/polyline-arc.ts
test_cmd: bun test src/polyline-arc.test.ts

files[3]{path,purpose}:
  src/polyline-arc.ts,"Arc gesture logic; tangent constraints; close snap; finalizeArc()"
  src/tools/line-tool.ts,Arc hold timer (200ms); updateArcSegment(); snapArcToClose()
  src/utils.ts,"circumscribedCircle(); computeTangentArcBulge(); angleSweepThrough()"
```

## Design Notes

- **Storage**: `PolylineSegment.bulge?: Point`. Absent = straight line. Present = circular arc through 3 points
- **Gesture**: Click = straight segment. Hold 200ms+ = arc mode. Drag shapes curve. Release finalizes
- **Tangent constraint**: `getPrevTangent()` computes exit direction of previous segment. `computeTangentArcBulge()` constrains bulge to maintain tangency
- **Close snap**: `shouldCloseSnap()` when mouse within `CLOSE_SNAP_RADIUS` (24px) of start with >= 2 segments. `snapArcToClose()` recomputes bulge for the snapped endpoint
- **Closing arc**: When closing with an arc, `isClosingSegment` flag makes mouse control bulge position directly (not endpoint)

## Gotchas

- Straight closing segments are popped on mouseUp (renderer draws implicit closing line for `closed: true`)
- Arc closing segments are kept (they carry bulge data the renderer needs)
- `circumscribedCircle()` can return null for collinear points — callers must handle this
- `POINT_HIT_RADIUS` (10px) vs `CLOSE_SNAP_RADIUS` (24px) — different thresholds for different interactions
