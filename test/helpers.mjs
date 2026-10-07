// Test yardımcıları: kaynak parçalarını ya da derlenmiş sayfayı tarayıcı olmadan çalıştırır.
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = rel => readFileSync(join(root, rel), "utf8");

/** src/ altındaki parçaları sırayla birleştirip çalıştırır, istenen adları döndürür. */
export function load(files, names, globals = {}) {
  const src = files.map(f => read(join("src", f))).join("\n");
  const keys = Object.keys(globals);
  return new Function(...keys, `"use strict";\n${src}\nreturn {${names.join(",")}};`)(...keys.map(k => globals[k]));
}

/** Her erişime kendini döndüren sahte nesne: DOM, depolama ve gözlemciler için yeterli. */
function stub() {
  const f = function () {};
  const p = new Proxy(f, {
    get: (_, k) => k === Symbol.toPrimitive ? () => "" : k === Symbol.iterator ? function* () {} : k === "then" ? undefined : k === "length" ? 0 : p,
    set: () => true, apply: () => p, construct: () => p,
  });
  return p;
}

/** Derlenmiş sayfanın betiğini sahte tarayıcı ortamında yükler; yükleme sırasında hata varsa fırlatır. */
export function loadPage(file) {
  const html = read(join("dist", file));
  const js = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).sort((a, b) => b.length - a.length)[0];
  const s = stub();
  const env = { window: {}, document: s, localStorage: { getItem: () => null, setItem() {} }, indexedDB: s, matchMedia: s,
    MutationObserver: s, ResizeObserver: s, getComputedStyle: s, navigator: s, scrollTo: s, module: undefined };
  new Function(...Object.keys(env), js)(...Object.values(env));
}
