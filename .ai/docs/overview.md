# Ruler2

Canvas-based screen measurement tool. Draw polylines, rectangles, and circles on a full-screen canvas, calibrate with a credit card, and read measurements in mm/cm/in. No frameworks, no backend — vanilla TypeScript with Canvas 2D API and localStorage persistence.

## Stack

```toon
language: TypeScript (strict)
runtime: Bun
build: Vite
hosting: GitHub Pages (calipr.artems.net)
package_manager: bun
test: bun:test
```

## Quick Start

```bash
bun install
bun run dev        # http://localhost:3000
bun test           # 285 tests
npx tsc --noEmit   # type check
bunx vite build    # production build → dist/
```

## Project Structure

```toon
dirs[4]{path,purpose}:
  src/,Core modules (types/tool/manager/renderer/utils) and persistence
  src/tools/,Tool implementations (line/rectangle/circle/calibrate)
  public/,Static assets copied to dist (CNAME for GitHub Pages)
  .github/workflows/,CI/CD (GitHub Pages deploy on push to main)
```

## Key Entry Points

- **App bootstrap**: `src/main.ts` — DOM events, theme, draw loop, tool wiring
- **Tool interface**: `src/tool.ts` — Strategy pattern contract
- **State management**: `src/tool-manager.ts` — Event delegation, shared state
- **Rendering**: `src/renderer.ts` — Canvas 2D drawing (706 LOC, largest module)
- **HTML**: `index.html` — Single-page canvas + toolbar
