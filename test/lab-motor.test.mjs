import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

const E = load(["lab/js/00-motor.js", "lab/js/01-gbdt.js"],
  ["monthNext", "fundAtMonth", "fwdRet", "zscores", "spearman", "metrics", "yearly", "universeAt", "crossSection", "scoreRows", "runBacktest", "convertSeries", "gbTrain", "gbScore"],
  { module: undefined });
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

test("monthNext yıl sonunu geçer", () => { assert.equal(E.monthNext("2025-12"), "2026-01"); assert.equal(E.monthNext("2025-01"), "2025-02"); });

test("fundAtMonth yalnızca o ay sonuna kadar yayımlanmış raporu verir", () => {
  const list = [{ pub: "2025-03-10", net: 1 }, { pub: "2025-05-31", net: 2 }, { pub: "2025-06-01", net: 3 }];
  assert.equal(E.fundAtMonth(list, "2025-02"), null);
  assert.equal(E.fundAtMonth(list, "2025-04").net, 1);
  assert.equal(E.fundAtMonth(list, "2025-05").net, 2);
});

test("fwdRet: boşluğu köprüler, veri hatası sıçramasını köprülemez", () => {
  const N = NaN;
  near(E.fwdRet([10, 11], 0), 0.1);
  near(E.fwdRet([10, N, N, 5], 0), -0.5);
  assert.equal(E.fwdRet([10, N, 50], 0), null);
  assert.equal(E.fwdRet([10, N, N], 0), null);
  assert.equal(E.fwdRet([N, 10], 0), null);
});

test("zscores ortalaması 0; eksikler null kalır", () => {
  const z = E.zscores([1, 2, 3, 4, 5, null]);
  assert.equal(z[5], null);
  near(z.slice(0, 5).reduce((a, b) => a + b, 0), 0);
  assert.deepEqual(E.zscores([1, 2, 3]), [null, null, null]);
});

test("spearman: tam sıralı 1, ters sıralı -1", () => {
  near(E.spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50]), 1);
  near(E.spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]), -1);
});

test("metrics: bileşik getiri ve en büyük düşüş", () => {
  const m = E.metrics([0.1, -0.5, 0.2]);
  near(m.total, 1.1 * 0.5 * 1.2 - 1); near(m.mdd, -0.5); assert.equal(m.n, 3);
});

// A her ay %10 artar, diğer beş hisse yatay: momentum A'yı seçmeli
function demoDB(M = 30) {
  const months = []; let m = "2020-01"; for (let i = 0; i < M; i++) { months.push(m); m = E.monthNext(m); }
  const codes = ["A", "B", "C", "D", "E", "F"], px = {}, tv = {};
  for (const c of codes) { px[c] = Float64Array.from({ length: M }, (_, i) => c === "A" ? 1.1 ** i : 1); tv[c] = new Float64Array(M).fill(1e6); }
  const flat = new Float64Array(M).fill(100);
  return { months, codes, px, tv, shares: {}, fund: {}, xu100: flat, usd: Float64Array.from({ length: M }, (_, i) => 1.02 ** i), tufe: flat, partialLast: true };
}

test("runBacktest: momentum kazananı seçer, maliyet yalnızca işlemde düşülür", () => {
  const DB = demoDB();
  const scorer = t => E.scoreRows(E.crossSection(DB, t, 6), { mom: 1 });
  const R = E.runBacktest(DB, { N: 6, K: 1, rebal: 1, cost: 0.01, start: 13, end: 27, scorer });
  assert.equal(R.months.length, 15);
  assert.deepEqual(R.holdings[0].codes, ["A"]);
  near(R.strat[0], 0.1 - 0.01);       // ilk ay: alım maliyeti
  near(R.strat[5], 0.1, 1e-6);        // sonra işlem yok
  near(R.ew[0], 0.1 / 6);
  assert.equal(R.bench[0], 0);
});

test("convertSeries: USD'ye çevirirken kur artışı getiriden düşülür", () => {
  const DB = demoDB();
  const out = E.convertSeries(DB, [DB.months[14]], [0.1], "usd");
  near(out[0], 1.1 / 1.02 - 1);
  assert.deepEqual(E.convertSeries(DB, [DB.months[14]], [0.1], "nom"), [0.1]);
});

test("gbTrain basit bir eşiği öğrenir", () => {
  const X = [], y = []; for (let i = 0; i < 400; i++) { const v = (i % 100) / 100; X.push([v, 0.5]); y.push(v > 0.5 ? 1 : 0); }
  const M = E.gbTrain(X, y, { nTrees: 40, minLeaf: 10 });
  assert.ok(E.gbScore(M, [0.9, 0.5]) > 1); assert.ok(E.gbScore(M, [0.1, 0.5]) < -1);
});
