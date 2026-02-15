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

## Documentation Index

Structured .toon files in `docs/` provide LLM-optimized project metadata (TOON = Token-Oriented Object Notation). Read `docs/index.toon` first.

- `docs/index.toon` — feature registry, module catalog, file map
- `docs/decisions.toon` — architectural decision records
- `docs/tools.toon` — tool system (strategy pattern, implementations)

**After implementing a feature:** update `docs/index.toon` (add feature row, bump count), update or create the relevant domain .toon file, and add a decision record to `docs/decisions.toon` if a non-trivial architectural choice was made. If a new .toon file is created, add it to the list above and to the `toon_files` table in `docs/index.toon`.

## Architecture

Canvas-based screen measurement tool. No frameworks, no backend — vanilla TypeScript with Canvas 2D API and localStorage persistence. See `docs/index.toon` for the full module catalog.

**Strategy pattern:** Tools implement the `Tool` interface and return declarative `ToolActions` — never mutate shared state. `ToolManager` delegates events and interprets actions. See `docs/tools.toon` for event flow, tool details, and cross-tool concerns.

**Coordinate system:** World coordinates with pan offset via `screenToWorld()` / `worldToScreen()`. Exception: `CalibrateTool` uses screen coordinates (UI pinned to screen corners).

**Calibration:** Credit card (85.6 x 53.98mm, ISO 7810) overlay establishes independent px-per-mm ratios for X and Y.

## Key Rules

- Tools must return `ToolActions` objects, never mutate `ToolManager` state directly
- `CalibrateTool` uses screen coordinates; all other tools use world coordinates
- Polyline arcs use bulge-point storage (start, bulge, end) — not center+radius+angles
- `renderer.ts` is parameter-driven with no internal state — all draw data passed in
