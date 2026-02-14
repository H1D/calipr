import type { Measurement } from "./types";

/** Base64url encode (no padding) */
function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Base64url decode */
function fromBase64url(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Compact a measurement for URL encoding: round coords to 1 decimal, short IDs */
function compact(m: Measurement): any {
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const rp = (p: { x: number; y: number }) => ({ x: r1(p.x), y: r1(p.y) });
  const id = parseInt(m.id.slice(0, 6), 36).toString(36).slice(0, 4);

  switch (m.kind) {
    case "polyline":
      return {
        k: "p", id,
        s: rp(m.start),
        sg: m.segments.map(seg => {
          const o: any = { e: rp(seg.end) };
          if (seg.bulge) o.b = rp(seg.bulge);
          return o;
        }),
        ...(m.closed ? { c: 1 } : {}),
      };
    case "rectangle":
      return { k: "r", id, p: m.points.map(rp) };
    case "circle":
      return { k: "c", id, ct: rp(m.center), r: r1(m.radiusPx) };
  }
}

/** Expand a compacted measurement back to full form */
function expand(c: any): Measurement | null {
  try {
    const id = String(c.id ?? Math.random().toString(36).slice(2, 10));
    switch (c.k) {
      case "p":
        return {
          kind: "polyline", id,
          start: c.s,
          segments: (c.sg as any[]).map((seg: any) => {
            const o: any = { end: seg.e };
            if (seg.b) o.bulge = seg.b;
            return o;
          }),
          ...(c.c ? { closed: true } : {}),
        };
      case "r":
        return { kind: "rectangle", id, points: c.p };
      case "c":
        return { kind: "circle", id, center: c.ct, radiusPx: c.r };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/** Gzip magic bytes: 0x1f 0x8b */
function isGzipped(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

async function gzipCompress(data: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream("gzip");
  const writer = cs.writable.getWriter();
  writer.write(new Uint8Array(data));
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = cs.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

async function gzipDecompress(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream("gzip");
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(data));
  writer.close();
  const chunks: Uint8Array[] = [];
  const reader = ds.readable.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

export async function encodeMeasurements(measurements: Measurement[]): Promise<string> {
  const compacted = measurements.map(compact);
  const json = JSON.stringify(compacted);
  const raw = new TextEncoder().encode(json);

  // Gzip if payload is large enough and CompressionStream is available
  if (raw.length > 500 && typeof CompressionStream !== "undefined") {
    const compressed = await gzipCompress(raw);
    return toBase64url(compressed);
  }
  return toBase64url(raw);
}

export async function decodeMeasurements(encoded: string): Promise<Measurement[] | null> {
  try {
    const bytes = fromBase64url(encoded);
    let json: string;
    if (isGzipped(bytes)) {
      const decompressed = await gzipDecompress(bytes);
      json = new TextDecoder().decode(decompressed);
    } else {
      json = new TextDecoder().decode(bytes);
    }
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return null;
    const measurements = parsed.map(expand).filter((m): m is Measurement => m !== null);
    return measurements.length > 0 ? measurements : null;
  } catch {
    return null;
  }
}

export async function loadFromHash(): Promise<Measurement[] | null> {
  const hash = location.hash;
  if (!hash.startsWith("#d=")) return null;
  const encoded = hash.slice(3);
  if (!encoded) return null;
  return decodeMeasurements(encoded);
}

export async function setHash(measurements: Measurement[]): Promise<string> {
  const encoded = await encodeMeasurements(measurements);
  const url = `${location.origin}${location.pathname}#d=${encoded}`;
  history.replaceState(null, "", url);
  return url;
}
