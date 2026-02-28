# Theming

Dual-layer dark/light mode: CSS variables for DOM elements and ThemeColors palette objects for canvas rendering. Three modes: auto (follows system), light, dark.

```toon
status: stable
entry_point: src/main.ts
test_cmd: (no dedicated test — visual feature)

files[3]{path,purpose}:
  index.html,"CSS variables (--bg, --text, etc.) in :root and [data-theme=dark]"
  src/main.ts,"Theme preference (auto/light/dark); matchMedia listener; applyTheme()"
  src/renderer.ts,"LIGHT_COLORS / DARK_COLORS palettes; setTheme(isDark) swaps active palette"
```

## Design Notes

- **CSS layer**: `[data-theme]` attribute on `<html>` toggles CSS variables for toolbar, settings panel, toast
- **Canvas layer**: `ThemeColors` interface (35 color properties). `renderer.setTheme(isDark)` swaps between `LIGHT_COLORS` and `DARK_COLORS`
- **Auto mode**: Uses `window.matchMedia("(prefers-color-scheme: dark)")` with change listener
- **Persistence**: Theme preference saved in localStorage as "auto", "light", or "dark"

## Gotchas

- Canvas colors can't use CSS variables (canvas API needs explicit color strings)
- Theme change is instant (no transition needed — canvas redraws every frame)
- Calibration overlay has its own color subset within ThemeColors (calFill, calStroke, calBtnBg, etc.)
