/** Screen fingerprint captured at calibration time */
export interface ScreenFingerprint {
  dpr: number;
  screenWidth: number;
  screenHeight: number;
}

/** Capture the current screen fingerprint */
export function captureFingerprint(): ScreenFingerprint {
  return {
    dpr: window.devicePixelRatio || 1,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

/** Check if two fingerprints differ enough to warrant recalibration */
export function fingerprintChanged(a: ScreenFingerprint, b: ScreenFingerprint): boolean {
  if (a.dpr !== b.dpr) return true;
  if (a.screenWidth !== b.screenWidth || a.screenHeight !== b.screenHeight) return true;
  return false;
}

/**
 * Watch for screen/display changes (DPR change, screen resize).
 * Calls `onChange` when a change is detected.
 * Returns a cleanup function.
 */
export function watchScreenChanges(onChange: () => void): () => void {
  let currentDpr = window.devicePixelRatio || 1;
  let mql: MediaQueryList | null = null;

  function setupDprWatch() {
    // matchMedia fires when DPR changes (e.g., moving window between monitors)
    mql = window.matchMedia(`(resolution: ${currentDpr}dppx)`);
    mql.addEventListener("change", handleDprChange);
  }

  function handleDprChange() {
    // DPR changed — re-setup watcher for the new value
    if (mql) mql.removeEventListener("change", handleDprChange);
    currentDpr = window.devicePixelRatio || 1;
    setupDprWatch();
    onChange();
  }

  // Also detect screen dimension changes (e.g., docking/undocking external monitor)
  let lastScreenWidth = window.screen.width;
  let lastScreenHeight = window.screen.height;

  function handleResize() {
    const w = window.screen.width;
    const h = window.screen.height;
    if (w !== lastScreenWidth || h !== lastScreenHeight) {
      lastScreenWidth = w;
      lastScreenHeight = h;
      onChange();
    }
  }

  setupDprWatch();
  window.addEventListener("resize", handleResize);

  return () => {
    if (mql) mql.removeEventListener("change", handleDprChange);
    window.removeEventListener("resize", handleResize);
  };
}
