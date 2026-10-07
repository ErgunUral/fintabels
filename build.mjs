// İki sayfayı src/ altındaki parçalardan üretir.
//   node build.mjs                 -> dist/ altına iki HTML dosyasını yazar
//   node build.mjs --check         -> yazmadan, dist/ ile aynı mı diye bakar
//   node build.mjs --diff <dosya>  -> bir canlı sürümü (adından sayfa anlaşılır) derlemeyle karşılaştırır;
//                                     yalnızca farklı satırları, kısaltarak basar
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const PAGES = { masa: "hisse-analiz-masasi.html", lab: "bist-strateji-lab.html" };
const read = p => readFileSync(p, "utf8");

// "//@include shared/x.js" satırı, src/ altındaki o dosyanın içeriğiyle değiştirilir
function expand(text, from) {
  return text.replace(/^\/\/@include (\S+)\n/gm, (_, rel) => {
    const p = join(root, "src", rel);
    if (!existsSync(p)) throw new Error(`${from}: bulunamadı: ${rel}`);
    const body = read(p);
    return body.endsWith("\n") ? body : body + "\n";
  });
}

function build(page) {
  const dir = join(root, "src", page);
  const js = readdirSync(join(dir, "js")).filter(f => f.endsWith(".js")).sort()
    .map(f => expand(read(join(dir, "js", f)), `${page}/js/${f}`)).join("");
  const html = read(join(dir, "page.html"));
  for (const mark of ["/*@css*/\n", "/*@js*/\n"])
    if (html.split(mark).length !== 2) throw new Error(`${page}/page.html: ${mark.trim()} tam bir kez olmalı`);
  // işlev biçiminde replace: içerikteki "$" karakterleri özel anlam taşımasın
  return html.replace("/*@css*/\n", () => read(join(dir, "style.css"))).replace("/*@js*/\n", () => js);
}

const dist = join(root, "dist");
mkdirSync(dist, { recursive: true });

const di = process.argv.indexOf("--diff");
if (di > 0) {
  const other = process.argv[di + 1];
  const page = /lab/i.test(other) || read(other).includes("<title>BIST Strateji Lab</title>") ? "lab" : "masa";
  const mine = join(dist, PAGES[page]);
  writeFileSync(mine, build(page));
  const r = spawnSync("git", ["diff", "--no-index", "-U0", "--no-color", mine, other], { encoding: "utf8", maxBuffer: 1 << 28 });
  const lines = r.stdout.split("\n").filter(l => /^[-+@]/.test(l) && !/^(---|\+\+\+) /.test(l));
  console.log(lines.length ? lines.map(l => l.length > 220 ? l.slice(0, 220) + ` …(+${l.length - 220})` : l).join("\n") : `${PAGES[page]}: fark yok`);
  process.exit(0);
}

const check = process.argv.includes("--check");
let differ = false;
for (const [page, file] of Object.entries(PAGES)) {
  const out = build(page), target = join(dist, file);
  if (check) {
    const same = existsSync(target) && read(target) === out;
    console.log(`${file}: ${same ? "aynı" : "FARKLI"}`);
    differ ||= !same;
  } else {
    writeFileSync(target, out);
    console.log(`${file}: ${Buffer.byteLength(out)} bayt`);
  }
}
if (differ) process.exit(1);
