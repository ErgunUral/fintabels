import test from "node:test";
import assert from "node:assert/strict";
import { load } from "./helpers.mjs";

const F = load(["shared/format.js", "shared/fintables.js", "shared/md.js"],
  ["fmt", "esc", "istDate", "trDate", "niceStep", "parseTable", "inList", "isQuota", "mdRender"], { call: null });

test("parseTable: sayı, boş hücre ve mantıksal değerler", () => {
  const rows = F.parseTable("| kod | fiyat | ad | aktif |\n| --- | --- | --- | --- |\n| ASELS | 12.5 |  | true |\n| THYAO | -3e2 | Türk Hava | false |");
  assert.deepEqual(rows, [{ kod: "ASELS", fiyat: 12.5, ad: null, aktif: true }, { kod: "THYAO", fiyat: -300, ad: "Türk Hava", aktif: false }]);
  assert.deepEqual(F.parseTable(""), []);
  assert.deepEqual(F.parseTable(null), []);
});

test("istDate: UTC 21:00 İstanbul'da ertesi gündür", () => {
  assert.equal(F.istDate("2025-08-31T21:00:00.000Z"), "2025-09-01");
  assert.equal(F.istDate("2025-08-31T20:59:00.000Z"), "2025-08-31");
  assert.equal(F.istDate("bozuk"), null);
});

test("trDate: gün ve ay biçimleri", () => {
  assert.equal(F.trDate("2026-10-07"), "07.10.2026");
  assert.equal(F.trDate("2026-10"), "10.2026");
  assert.equal(F.trDate(null), "—");
});

test("inList tek tırnağı kaçışlar", () => assert.equal(F.inList(["A", "B'C", 5]), "'A','B''C','5'"));

test("mdRender HTML'i kaçışlar, sonra biçimler", () => {
  const h = F.mdRender("### Başlık\n- **kalın** <script>x</script>\nparagraf");
  assert.equal(h, "<h4>Başlık</h4><ul><li><strong>kalın</strong> &lt;script&gt;x&lt;/script&gt;</li></ul><p>paragraf</p>");
});

test("isQuota kota mesajını tanır", () => {
  assert.equal(F.isQuota({ message: "Günlük istek sınırına ulaşıldı" }), true);
  assert.equal(F.isQuota({ message: "zaman aşımı" }), false);
  assert.equal(F.isQuota(null), false);
});

test("niceStep ve fmt", () => {
  assert.equal(F.niceStep(3), 5); assert.equal(F.niceStep(0), 1);
  assert.equal(F.fmt(1234.5), "1.234,50"); assert.equal(F.fmt(null), "—");
});
