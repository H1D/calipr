export interface Point {
  x: number;
  y: number;
}

export type ToolType = "line" | "rectangle" | "circle" | "calibrate";

export type Unit = "mm" | "cm" | "in";

export interface Calibration {
  pxPerMmX: number;
  pxPerMmY: number;
}

export interface RectangleMeasurement {
  kind: "rectangle";
  id: string;
  points: [Point, Point];
}

export interface PolylineSegment {
  end: Point;
  /** If set, this segment is an arc passing through this bulge point */
  bulge?: Point;
}

export interface PolylineMeasurement {
  kind: "polyline";
  id: string;
  start: Point;
  segments: PolylineSegment[];
  closed?: boolean;
}

export interface CircleMeasurement {
  kind: "circle";
  id: string;
  center: Point;
  radiusPx: number;
}

export type Measurement =
  | RectangleMeasurement
  | PolylineMeasurement
  | CircleMeasurement;

export interface AppState {
  tool: ToolType;
  unit: Unit;
  calibration: Calibration | null;
  measurements: Measurement[];
}

export const CREDIT_CARD_WIDTH_MM = 85.6;
export const CREDIT_CARD_HEIGHT_MM = 53.98;

export const DEFAULT_PX_PER_MM = 3.78; // ~96 DPI fallback
