// Ortak gradyan artırma çekirdeği, birleştirmeden önceki iki ayrı uygulamayla aynı modeli üretmeli.
// Beklenen özetler eski kodla (commit 2e85804) aynı sahte veri üzerinde alındı.
import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";
import { masaData, labData, digest } from "./gbdt-veri.mjs";

// eski Masa ağaçlarında "miss" alanı yoktu; karşılaştırma için çıkarılır
const noMiss = n => n.f === undefined ? { v: n.v } : { f: n.f, t: n.t, l: noMiss(n.l), r: noMiss(n.r) };

test("Masa: erken durdurmalı eğitim eski uygulamayla aynı", async () => {
  const M = load(["shared/format.js", "masa/js/04-indicators.js", "masa/js/13-ml.js"], ["trainGBDT", "predGBDT", "toCols"]);
  const d = masaData(), cols = M.toCols(d.rows);
  const m = await M.trainGBDT(cols, d.y, d.fit, d.val, d.opts);
  assert.equal(digest({ trees: m.trees.map(noMiss), base: m.base, bestN: m.bestN, imp: Array.from(m.imp) }), "f5e41baeb61886eb");
  assert.equal(M.predGBDT(m, cols, 550), 0.2456744624804642);
});

test("Lab: eksik değerli eğitim eski uygulamayla aynı", () => {
  const L = load(["lab/js/00-motor.js", "lab/js/01-gbdt.js"], ["gbTrain", "gbScore"], { module: undefined });
  const e = labData(), g = L.gbTrain(e.X, e.y, e.opts);
  assert.equal(digest(g), "dedf356e5684438c");
  assert.equal(L.gbScore(g, e.X[3]), -0.49039676610200406);
});
