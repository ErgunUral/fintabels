# Fintables - Borsa

Borsa İstanbul için iki tek sayfalık claude.ai artifact'i. Veri, sayfayı açan kişinin Fintables bağlayıcısından gelir; sunucu yok.

| Sayfa | Kaynak | Çıktı | Artifact |
|---|---|---|---|
| Hisse Analiz Masası | `src/masa/` | `dist/hisse-analiz-masasi.html` | https://claude.ai/artifact/TnTka4UxK9ApbxrzZThaVF |
| BIST Strateji Lab | `src/lab/` | `dist/bist-strateji-lab.html` | https://claude.ai/artifact/CxbqTgjBUvgJusp9uVJgW2 |

GitHub: `ErgunUral/fintabels` (public). Kullanıcıyla Türkçe konuş.

## Token tasarrufu kuralları

- `dist/` ve `src/masa/data/kalici-model.json` dosyalarını **okuma** (üretilmiş çıktı ve 88 KB'lık tek satır model ağırlığı). Gerekirse `grep -c`, `wc`, `cut -c1-200` kullan.
- Önce aşağıdaki bölüm haritasından dosyayı seç, sonra `grep -n` ile satırı bul, yalnızca o aralığı oku. Satırlar uzundur (800 karaktere kadar); grep çıktısını `cut -c1-200` ile kes.
- Canlı artifact'i `Artifact read` ile okuma: tüm HTML'i bağlama döker. Yayın akışına bak.
- Doğrulama için `npm test` yeter (çıktısı birkaç satır). Tek tek dosya derleyip okumaya gerek yok.

## Komutlar

- `npm test` — derler, 25 testi çalıştırır (sayfaların hatasız yüklenmesi + hesap fonksiyonları).
- `npm run build` — `dist/` altına iki HTML üretir.
- `node build.mjs --diff <dosya>` — bir canlı sürümü derlemeyle karşılaştırır, yalnızca farklı satırları kısaltarak basar.

## Yapı

`build.mjs`, `src/<sayfa>/page.html` içindeki `/*@css*/` ve `/*@js*/` satırlarını `style.css` ve `js/*.js` (ada göre sıralı) ile doldurur. JS içinde tek başına duran `//@include <src'ye göre yol>` satırı o dosyanın içeriğiyle değişir. Her sayfanın JS'i tek bir IIFE'dir: bölümler aynı kapsamı paylaşır, modül sistemi yok.

`src/shared/` (iki sayfaya gömülür): `format.js` (nf, fmt, esc, istDate, trDate, tick, css, niceStep) · `fintables.js` (isQuota, parseTable, sql, inList; sayfanın kendi `call()`'unu kullanır) · `idb.js` (makeIdb) · `md.js` (mdRender).

`src/masa/js/`:
- `00-giris` durum nesnesi `S` · `01-formatting` pct (yüzde değeri alır), big, istDateTime · `02-fintables-calls` errCopy, call
- `03-search` arama kutusu · `04-indicators` sma, ema, rsi, macd, boll, atr, stoch, swings · `05-charts` lightweight-charts
- `06-loaders` load(), teknik/temel/analist/KAP yükleyicileri, buildT, computeSignals · `07-kap-duygu-analizi`
- `08-takip-listesi` (`W`, refreshWatch) · `09-kalici-model` gömülü model (`FZ`) · `10-portfoy` (`P`) · `11-bist-30-tarama` (`SC`)
- `12-ai` Claude yorumu · `13-ml` saf hesap: adjustCorporate, stockFeatures, GBDT, lojistik regresyon, runModel, geri test
- `14-model-arayuzu` (`ML`), fetchUniverse, modelAge/modelExpired · `15-boot`

`src/lab/js/`:
- `00-motor` saf geri test motoru (universeAt, rawFactors, fwdRet, runBacktest, metrics) · `01-gbdt` gbTrain, makeMLScorer
- `02-uygulama` pct (oran alır: Masa'dakinden farklı), errCopy, call · `03-veri-indirme` syncData, buildDB
- `04-ayarlar` (`ST`) · `05-geri-test` runTest · `06-grafik` lineChart · `07-sonuclar` renderResults, duyarlılık, yapay zeka · `08-baslat`

## Yayın akışı

1. `npm test`, sonra `Artifact publish` ile `dist/<dosya>` ve tablodaki `url`.
2. Yayın "daha yeni sürüm var" diye reddedilirse sayfa başka yerde değişmiştir. Reddin verdiği kayıtlı dosyayı **okumadan** `node build.mjs --diff <o dosya>` çalıştır; çıkan farkları `src/`'ye işle, tekrar yayınla.
3. Yayından sonra aşağıdaki sürüm satırını güncelle, commit ve push et.

Son yayın: Masa sürüm 11, Lab sürüm 6 (7 Ekim 2026).

## Bilinen borçlar

- Sermaye işlemi kuralı üç yerde ayrı: Masa `adjustCorporate`, Lab `buildDB` olay düzeltmesi ve 4 kat sıçrama filtresi.
- Gradyan artırma iki kez yazılı (`masa/13-ml`, `lab/01-gbdt`; Lab'deki eksik değeri destekler).
- Eğitim ve geri test ana iş parçacığında çalışır.
- Kalıcı modelin eğitim kodu repoda yok.
- Fintables sınırları: sorgu başına 300 satır, günlük kota. TÜFE serisi Ocak 2026'da bitiyor.
