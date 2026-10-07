import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

const C = load(["shared/format.js", "masa/js/04-indicators.js", "masa/js/13-ml.js"],
  ["sma", "ema", "rsi", "boll", "adjustCorporate", "auc", "btCurves", "backtestData", "fundAt"]);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);
const days = n => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 5) + i * 864e5).toISOString().slice(0, 10));
const candles = c => ({ t: days(c.length), o: c.slice(), h: c.slice(), l: c.slice(), c: c.slice(), v: c.map(() => 100) });

test("sma: ilk n-1 değer boş", () => assert.deepEqual(C.sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]));

test("rsi: hep yükselen seride 100, hep düşende 0", () => {
  const up = Array.from({ length: 30 }, (_, i) => 10 + i), dn = up.slice().reverse();
  assert.equal(C.rsi(up).at(-1), 100); near(C.rsi(dn).at(-1), 0);
  assert.equal(C.rsi(up)[13], null);
});

test("adjustCorporate: bölünme düzeltilir, hacim ters ölçeklenir", () => {
  const A = C.adjustCorporate(candles([100, 100, 100, 20, 20, 21]));
  assert.equal(A.adj, 1); assert.deepEqual(A.c.map(x => +x.toFixed(6)), [20, 20, 20, 20, 20, 21]); near(A.v[0], 500);
});

test("adjustCorporate: geri dönen sıçrama ve uzun aradan sonraki hareket düzeltilmez", () => {
  assert.equal(C.adjustCorporate(candles([100, 100, 130, 100, 100, 101])).adj, 0);
  const T = candles([100, 100, 70, 70]); T.t[2] = "2026-03-01"; T.t[3] = "2026-03-02";
  const A = C.adjustCorporate(T); assert.equal(A.adj, 0); assert.deepEqual(A.c, [100, 100, 70, 70]);
});

test("auc: kusursuz ayrım 1, ters ayrım 0, eşit skor 0,5", () => {
  assert.equal(C.auc([0.1, 0.2, 0.8, 0.9], [0, 0, 1, 1]), 1);
  assert.equal(C.auc([0.9, 0.8, 0.2, 0.1], [0, 0, 1, 1]), 0);
  assert.equal(C.auc([0.5, 0.5, 0.5, 0.5], [0, 1, 0, 1]), 0.5);
});

test("fundAt yalnızca tarihten önce yayımlanmış raporu verir", () => {
  const F = { rep: [{ pub: "2025-03-10", net: 1 }, { pub: "2025-05-15", net: 2 }] };
  assert.equal(C.fundAt(F, "2025-03-10"), null);
  assert.equal(C.fundAt(F, "2025-03-11").net, 1);
  assert.equal(C.fundAt(F, "2026-01-01").net, 2);
});

test("btCurves: komisyon yalnızca değişen hisse oranında düşülür", () => {
  const bt = [{ d: "2026-01-05", top: ["A", "B"], rt: 0.1, rm: 0.05, rb: 0 }, { d: "2026-01-12", top: ["A", "C"], rt: 0.1, rm: 0.05, rb: 0 }];
  const B = C.btCurves(bt, 1);                    // %1 komisyon
  near(B.top, (1 + 0.1 - 0.01) * (1 + 0.1 - 0.005) - 1);
  near(B.mkt, 1.05 ** 2 - 1); assert.equal(B.n, 2); assert.equal(B.win, 1);
});

const O = load(["shared/format.js", "masa/js/07a-sahiplik.js"], ["ownMonths", "shortStats"]);

test("ownMonths: eksik son ay atlanır, bozuk ay değerleri elenir", () => {
  const rows = [{ yil: 2026, ay: null, fon_sayisi: 48, toplam_lot: 1 }, { yil: 2026, ay: 36, fon_sayisi: 1, toplam_lot: 1 },
    { yil: 2026, ay: 9, fon_sayisi: 147, toplam_lot: 39e6 }, { yil: 2026, ay: 8, fon_sayisi: 222, toplam_lot: 48e6 }, { yil: 2026, ay: 7, fon_sayisi: 257, toplam_lot: 47e6 }];
  const r = O.ownMonths(rows, "2026-10-07");
  assert.equal(r.M.length, 3); assert.equal(r.partial, true); assert.equal(r.cur.ay, 8); assert.equal(r.prev.ay, 7);
  const late = O.ownMonths(rows, "2026-10-20"); assert.equal(late.partial, false); assert.equal(late.cur.ay, 9);   // rapor dönemi kapandıysa düşüş gerçektir
  const full = O.ownMonths(rows.slice(3), "2026-10-07"); assert.equal(full.partial, false); assert.equal(full.cur.ay, 8);
  assert.equal(O.ownMonths([], "2026-01-05").cur, null);
});

test("shortStats: oran hacim ağırlıklıdır", () => {
  const s = O.shortStats([{ tarih_europe_istanbul: "2026-10-07T00:00:00.000Z", aciga_satis_hacmi_tl: 30, toplam_islem_hacmi_tl: 100, ortalama_aciga_satis_fiyati: 5 },
    { tarih_europe_istanbul: "2026-10-06T00:00:00.000Z", aciga_satis_hacmi_tl: 10, toplam_islem_hacmi_tl: 300, ortalama_aciga_satis_fiyati: 5 }]);
  assert.equal(s.R[0].d, "2026-10-07"); near(s.r5, 10); assert.equal(O.shortStats([]).r5, null);
});

const B = load(["shared/format.js", "masa/js/06-loaders.js"], ["balMap", "balRows"], { S: {}, $: () => ({}) });

test("finansal özet: çift geçen kalem toplanır, toplam yükümlülük hesaplanır, TTM satırları çeyrekten gelir", () => {
  const k = (kalem, v, yil = 2026) => ({ yil, kalem, try_donemsel: v });
  const M = B.balMap([k("Finansal Yatırımlar", null), k("Finansal Yatırımlar", 37), k("Toplam Dönen Varlıklar", 248), k("Toplam Kısa Vadeli Yükümlülükler", 169),
    k("Toplam Uzun Vadeli Yükümlülükler", 72), k("Ödenmiş Sermaye", 4.56), k("Toplam Dönen Varlıklar", 200, 2025)]);
  assert.equal(M[2026]["Finansal Yatırımlar"], 37);
  const rows = B.balRows(M[2026], M[2025], { ttmEbitda: 90, ttmNet: 40 }, { ttmEbitda: 60, ttmNet: null });
  const get = n => rows.find(r => r.n === n);
  assert.deepEqual(get("Dönen varlıklar"), { n: "Dönen varlıklar", a: 248, b: 200 });
  assert.equal(get("Toplam yükümlülükler").a, 241); assert.equal(get("Toplam yükümlülükler").b, null);
  assert.deepEqual(get("FAVÖK (son 12 ay)"), { n: "FAVÖK (son 12 ay)", a: 90, b: 60 });
  assert.equal(get("Net dönem kârı (son 12 ay)").b, null);
  assert.equal(get("Net borç"), undefined);            // veride yoksa satır çıkmaz
  assert.deepEqual(rows.map(r => r.n).slice(0, 2), ["Dönen varlıklar", "Kısa vadeli yükümlülükler"]);
});
