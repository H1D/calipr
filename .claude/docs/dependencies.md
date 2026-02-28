# Dependencies

## Runtime

No runtime dependencies. Vanilla TypeScript with browser APIs only.

## Dev

```toon
dev[2]{name,version,purpose}:
  @types/bun,latest,Bun runtime type definitions
  typescript,^5,Type checking (strict mode)
```

## Build Tools

```toon
build[2]{name,purpose}:
  vite,Production bundler (npx vite build → dist/)
  bun,Dev server (serve.ts with hot reload) and test runner
```

## Browser APIs Used

```toon
apis[6]{api,used_by,purpose}:
  Canvas 2D,renderer.ts,All drawing and measurement rendering
  localStorage,storage.ts,Persist calibration/measurements/pan across sessions
  CompressionStream,share.ts,Gzip compression for URL hash sharing
  Pointer Events,main.ts,Pan gesture (space+drag or middle mouse)
  Clipboard API,main.ts,Copy share link
  matchMedia,main.ts,Detect system dark mode preference
```

## Internal Module Dependencies

```toon
modules[12]{module,depends_on}:
  main,"types; utils; renderer; storage; keybindings; export-svg; share; tool-manager; tools/*"
  types,(none)
  tool,types
  tool-manager,"types; tool; utils; polyline-arc; storage; keybind-registry"
  renderer,"types; utils"
  utils,types
  storage,types
  keybindings,types
  keybind-registry,(none)
  export-svg,"types; utils"
  polyline-arc,"types; utils"
  share,types
```
