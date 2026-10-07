import test from "node:test";
import { loadPage } from "./helpers.mjs";

// Tanım sırası hatalarını (henüz tanımlanmamış sabite erişim gibi) yakalar; veri çekmez.
for (const f of ["hisse-analiz-masasi.html", "bist-strateji-lab.html"])
  test(`${f} hatasız yükleniyor`, () => loadPage(f));
