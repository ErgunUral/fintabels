// Gradyan artırma testleri için tekrarlanabilir sahte veri ve özet (digest) yardımcıları.
import { createHash } from "node:crypto";

export function lcg(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
export const digest = o => createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 16);

/** Masa biçimi: 24 özellikli satırlar ({x: Float64Array}), eksik değer yok. */
export function masaData(N = 600) {
  const r = lcg(42), rows = [], y = new Int8Array(N);
  for (let j = 0; j < N; j++) { const x = Float64Array.from({ length: 24 }, () => r() * 2 - 1); rows.push({ x }); y[j] = x[3] + 0.5 * x[7] + 0.3 * (r() - 0.5) > 0 ? 1 : 0; }
  const idx = (a, b) => Array.from({ length: b - a }, (_, k) => a + k);
  return { rows, y, fit: idx(0, 400), val: idx(400, 500), opts: { nTrees: 40, minLeaf: 20, patience: 10 } };
}

/** Lab biçimi: 11 özellikli satır dizileri, her 7. değer eksik (null). */
export function labData(N = 500) {
  const r = lcg(7), X = [], y = [];
  for (let j = 0; j < N; j++) { const full = Array.from({ length: 11 }, () => r() * 2 - 1); y.push(full[2] - 0.7 * full[5] > 0 ? 1 : 0); X.push(full.map((v, f) => (j * 11 + f) % 7 === 0 ? null : v)); }
  return { X, y, opts: { nTrees: 25, minLeaf: 15 } };
}
