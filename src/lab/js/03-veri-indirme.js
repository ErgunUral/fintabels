/* ---------------- VERİ İNDİRME ---------------- */
//@include shared/sermaye.js
const START_M="2014-07", START_UTC="2014-06-30 21:00:00";
const curMonth=()=>istDate(new Date().toISOString()).slice(0,7);
function monthsBetween(a,b){const out=[];let m=a;while(m<=b){out.push(m);m=monthNext(m);}return out;}
function prog(msg,f){if(f!=null)L.stage=msg.replace(/[:…].*$/,"");$("dSub").textContent=msg;const p=$("dProg");p.hidden=f==null;if(f!=null)p.firstElementChild.style.width=Math.round(f*100)+"%";}
async function pool(jobs,n,onDone){let i=0,done=0,fatal=null;const errs=[];
  const w=async()=>{while(i<jobs.length&&!fatal){const j=jobs[i++];try{await j();}catch(e){if(AUTH.includes(e&&e.code)||isQuota(e)||(e&&e.code==="upstream_error"))fatal=e;else errs.push(e);}done++;onDone&&onDone(done,jobs.length);}};
  await Promise.all(Array.from({length:n},w));if(fatal)throw fatal;return errs;}

const VOL=t=>t==="mumlar_gunluk_gh"?"SUM(hacim_15_dk_gecikmeli)":"0";
const MONTHLY_SQL=(codes,fromUtc,toUtc,T="mumlar_gunluk_gh")=>`SELECT a.kod, a.ay, m.kapanis, a.hacim FROM (SELECT kod, date_trunc('month', zaman_utc + INTERVAL '3 hour') AS ay, ${VOL(T)} AS hacim, MAX(zaman_utc) AS son_t FROM ${T} WHERE kod IN (${inList(codes)}) AND zaman_utc >= TIMESTAMP '${fromUtc}'${toUtc?` AND zaman_utc < TIMESTAMP '${toUtc}'`:""} GROUP BY kod, date_trunc('month', zaman_utc + INTERVAL '3 hour')) a JOIN ${T} m ON m.kod = a.kod AND m.zaman_utc = a.son_t ORDER BY a.kod, a.ay LIMIT 300`;
/* zaman aşımında önce hisseleri, sonra dönemi bölerek yeniden dener */
/* yedek 1: JOIN yok, pencere toplamı + DISTINCT ON */
const MONTHLY_SQL_B=(codes,fromUtc,toUtc,T="mumlar_gunluk_gh")=>`SELECT DISTINCT ON (x.kod, x.ay) x.kod, x.ay, x.kapanis, x.hacim FROM (SELECT kod, zaman_utc, kapanis, date_trunc('month', zaman_utc + INTERVAL '3 hour') AS ay, ${T==="mumlar_gunluk_gh"?"SUM(hacim_15_dk_gecikmeli) OVER (PARTITION BY kod, date_trunc('month', zaman_utc + INTERVAL '3 hour'))":"0"} AS hacim FROM ${T} WHERE kod IN (${inList(codes)}) AND zaman_utc >= TIMESTAMP '${fromUtc}'${toUtc?` AND zaman_utc < TIMESTAMP '${toUtc}'`:""}) x ORDER BY x.kod, x.ay, x.zaman_utc DESC LIMIT 300`;
/* yedek 2: en sade iki adım — ay sonu zamanı + hacim, sonra o günlerin kapanışı */
const tbase=t=>String(t).replace(" ","T").replace(/(\.\d+)?(Z|[+-]\d\d(:?\d\d)?)?$/,"");
async function monthlyPlain(codes,fromUtc,toUtc,purpose,T="mumlar_gunluk_gh"){
  const where=`kod IN (${inList(codes)}) AND zaman_utc >= TIMESTAMP '${fromUtc}'${toUtc?` AND zaman_utc < TIMESTAMP '${toUtc}'`:""}`;
  const agg=await sql(`SELECT kod, date_trunc('month', zaman_utc + INTERVAL '3 hour') AS ay, MAX(zaman_utc) AS son_t, ${VOL(T)} AS hacim FROM ${T} WHERE ${where} GROUP BY kod, date_trunc('month', zaman_utc + INTERVAL '3 hour') ORDER BY kod LIMIT 300`,purpose);
  const ts=[...new Set(agg.map(r=>String(r.son_t)))];const close={};
  for(let i=0;i<ts.length;i+=60){const part=ts.slice(i,i+60).map(t=>`TIMESTAMP '${tbase(t).replace("T"," ")}'`).join(",");
    const r=await sql(`SELECT kod, zaman_utc, kapanis FROM ${T} WHERE kod IN (${inList(codes)}) AND zaman_utc IN (${part}) LIMIT 300`,purpose);
    r.forEach(x=>close[x.kod+"|"+tbase(x.zaman_utc)]=x.kapanis);}
  return agg.map(r=>({kod:r.kod,ay:r.ay,hacim:r.hacim,kapanis:close[r.kod+"|"+tbase(r.son_t)]}));}
const MV=[MONTHLY_SQL,MONTHLY_SQL_B,null];
async function monthlyOne(codes,fromUtc,toUtc,purpose,T="mumlar_gunluk_gh"){
  let last;for(let v=L.mv||0;v<MV.length;v++){try{const r=MV[v]?await sql(MV[v](codes,fromUtc,toUtc,T),purpose):await monthlyPlain(codes,fromUtc,toUtc,purpose,T);if(v>(L.mv||0))L.mv=v;return r;}
    catch(e){if(!isUnsafe(e))throw e;last=e;}}throw last;}
async function fetchMonthly(codes,fromM,toM,purpose){
  try{return await monthlyOne(codes,utcOfMonth(fromM),toM?utcOfMonth(toM):null,purpose);}
  catch(e){if(!splittable(e))throw e;
    if(codes.length>1){const h=Math.ceil(codes.length/2);return (await fetchMonthly(codes.slice(0,h),fromM,toM,purpose)).concat(await fetchMonthly(codes.slice(h),fromM,toM,purpose));}
    const ms=monthsBetween(fromM,toM?toM:curMonth());if(ms.length<18)throw e;const mid=ms[Math.floor(ms.length/2)];
    return (await fetchMonthly(codes,fromM,mid,purpose)).concat(await fetchMonthly(codes,mid,toM,purpose));}}
async function splitOnTimeout(codes,fn){try{return await fn(codes);}catch(e){if(!splittable(e)||codes.length<2)throw e;const h=Math.ceil(codes.length/2);return (await splitOnTimeout(codes.slice(0,h),fn)).concat(await splitOnTimeout(codes.slice(h),fn));}}
const utcOfMonth=m=>{const [y,mo]=m.split("-").map(Number);const d=new Date(Date.UTC(y,mo-1,1)-3*3600e3);return d.toISOString().replace("T"," ").slice(0,19);};

async function syncData(){
  if(L.busy)return;L.busy=true;$("dSync").disabled=true;$("run").disabled=true;
  try{
    const raw=L.raw||{v:1,bars:{},shares:{},fund:{},events:[],black:[],xu:{},usd:{},tufe:{},fundCodes:[],lastSync:null};L.raw=raw;
    const cm=curMonth();
    // 1) hisse listesi (sayfalı)
    prog("Hisse listesi alınıyor…",0.01);
    let last="",list=[];try{for(let k=0;k<10;k++){const r=await sql(`SELECT hisse_senedi_kodu, odenmis_sermaye FROM hisse_senetleri WHERE hisse_senedi_kodu > '${last}' ORDER BY hisse_senedi_kodu LIMIT 300`,"Strateji Lab hisse listesi");list=list.concat(r);if(r.length<300)break;last=r[r.length-1].hisse_senedi_kodu;}}catch(e){if(AUTH.includes(e&&e.code)||Object.keys(raw.shares).length<100)throw e;list=[];}
    list.forEach(r=>{if(/^[A-Z0-9]{3,6}$/.test(r.hisse_senedi_kodu))raw.shares[r.hisse_senedi_kodu]=r.odenmis_sermaye;});
    const codes=Object.keys(raw.shares).sort();
    // 2) aylık barlar: yeni hisseler tam geçmiş, mevcutlar son 2 ay
    const allMonths=monthsBetween(START_M,cm);
    const fresh=codes.filter(c=>!raw.bars[c]), old=codes.filter(c=>raw.bars[c]);
    const jobs=[];const put=rows=>rows.forEach(r=>{const m=String(r.ay).slice(0,7);if(!r.kod||m<START_M||!(r.kapanis>0))return;const b=(raw.bars[r.kod]||(raw.bars[r.kod]={}));b[m]=[r.kapanis,r.hacim||0];});
    const cpqFull=Math.max(1,Math.floor(300/allMonths.length));
    for(let i=0;i<fresh.length;i+=cpqFull){const g=fresh.slice(i,i+cpqFull);jobs.push(async()=>{put(await fetchMonthly(g,START_M,null,"Strateji Lab aylık fiyat geçmişi"));g.forEach(c=>{raw.bars[c]=raw.bars[c]||{};});});}
    if(old.length&&raw.lastMonth){const from=raw.lastMonth<cm?raw.lastMonth:cm;const nm=monthsBetween(from,cm).length;const cpq=Math.max(1,Math.floor(300/nm));
      for(let i=0;i<old.length;i+=cpq){const g=old.slice(i,i+cpq);jobs.push(async()=>put(await fetchMonthly(g,from,null,"Strateji Lab aylık güncelleme")));}}
    const errs=await pool(jobs,3,(d,n)=>{prog(`Aylık fiyatlar: ${d} / ${n} sorgu`,0.02+0.6*d/n);if(d%15===0)idb.set("raw",raw);});
    await idb.set("raw",raw);
    if(errs.length&&(errs.length===jobs.length||Object.keys(raw.bars).length<60))throw errs[0];
    L.missed=errs.length?fresh.filter(c=>!raw.bars[c]).length:0;
    raw.lastMonth=cm;await idb.set("raw",raw);
    // 3) sermaye işlemleri: Fintables'ın henüz düzeltmediği dönem, 2 aylık dilimlerle (ağır sorguyu bölmek için)
    prog("Sermaye işlemleri kontrol ediliyor…",0.63);
    raw.black=["QNBFK","ISKUR","ISBTR","ISATR"]; // 2013-2025 verisinde tutarsız seri tespit edilen kodlar
    const evFrom=raw.evSync||"2025-06";const evMonths=monthsBetween(evFrom,cm);const evRows=[];
    for(let i=0;i<evMonths.length;i+=2){const a=evMonths[i],b=evMonths[i+2]||null;const pre=new Date(Date.parse(utcOfMonth(a).replace(" ","T")+"Z")-12*864e5).toISOString().replace("T"," ").slice(0,19);
      prog(`Sermaye işlemleri kontrol ediliyor: ${mLabel(a)}…`,0.63+0.03*i/evMonths.length);
      const r=await sql(`SELECT x.kod, x.zaman_utc, x.onceki_zaman, x.onceki, x.kapanis FROM (SELECT m.kod, m.zaman_utc, m.kapanis, LAG(m.kapanis) OVER (PARTITION BY m.kod ORDER BY m.zaman_utc) AS onceki, LAG(m.zaman_utc) OVER (PARTITION BY m.kod ORDER BY m.zaman_utc) AS onceki_zaman FROM mumlar_gunluk_gh m JOIN hisse_senetleri h ON h.hisse_senedi_kodu = m.kod WHERE m.zaman_utc >= TIMESTAMP '${pre}'${b?` AND m.zaman_utc < TIMESTAMP '${utcOfMonth(b)}'`:""}) x WHERE x.zaman_utc >= TIMESTAMP '${utcOfMonth(a)}' AND x.onceki >= 1 AND x.kapanis >= 0.5 AND (x.kapanis / x.onceki > 1.25 OR x.kapanis / x.onceki < 0.78) ORDER BY x.zaman_utc LIMIT 300`,"Strateji Lab düzeltilmemiş bedelsizler");
      evRows.push(...r);}
    const seen=new Set((raw.events||[]).map(e=>e.c+e.d));
    evRows.map(r=>({c:r.kod,d:istDate(r.zaman_utc),pd:istDate(r.onceki_zaman),r:r.kapanis/r.onceki})).forEach(e=>{if(!seen.has(e.c+e.d)){seen.add(e.c+e.d);(raw.events=raw.events||[]).push(e);}});
    raw.evSync=evMonths[Math.max(0,evMonths.length-2)];
    // 4) kıyas serileri
    prog("BIST 100, dolar ve enflasyon serileri…",0.66);
    const xu=await monthlyOne(["XU100"],START_UTC,null,"Strateji Lab BIST 100 aylık","endeks_mumlar_gunluk_gh");
    xu.forEach(r=>raw.xu[String(r.ay).slice(0,7)]=r.kapanis);
    const us=await fetchMonthly(["USDTRY"],START_M,null,"Strateji Lab USDTRY aylık");us.forEach(r=>raw.usd[String(r.ay).slice(0,7)]=r.kapanis);
    const tf=await sql(`SELECT zaman_utc, kapanis FROM mumlar_gunluk_gh WHERE kod = 'TUFE' AND zaman_utc >= TIMESTAMP '2014-05-01 00:00:00' ORDER BY zaman_utc LIMIT 300`,"Strateji Lab TÜFE");
    // TÜFE satırları ayın 1'i İstanbul gece yarısıyla (önceki gün 21:00 UTC) damgalıdır; ay İstanbul tarihinden okunur
    if(tf.length){raw.tufe={};tf.forEach(r=>{const d=istDate(r.zaman_utc);if(d)raw.tufe[d.slice(0,7)]=r.kapanis;});raw.tufeTz=1;}
    // 5) temel veriler: geçmişte en az bir ay ilk 150 likit hisseye girenler
    L.raw=raw;let DB=buildDB(raw);
    const ever=new Set();for(let t=12;t<DB.months.length;t++)universeAt(DB,t,150).forEach(u=>ever.add(u.c));
    const fc=[...ever].sort();const need=fc.filter(c=>!raw.fund[c]);const refresh=raw.fundSync&&raw.fundSync<istDate(new Date(Date.now()-20*864e5).toISOString())?fc.filter(c=>raw.fund[c]):[];
    const y0=2013,yR=Number(cm.slice(0,4))-1;const fjobs=[];const P={};
    const per=(c,y,a)=>{const k=c+"|"+(y*100+a);return P[k]||(P[k]={c,y,a});};
    const addInc=(g0,yFrom)=>fjobs.push(async()=>{const rows=await splitOnTimeout(g0,g=>sql(`SELECT g.hisse_senedi_kodu, g.yil, g.ay, f.yayinlanma_tarihi_utc, g.kalem, g.try_ttm FROM hisse_finansal_tablolari_gelir_tablosu_kalemleri g JOIN hisse_finansal_tablolari f ON f.hisse_senedi_kodu = g.hisse_senedi_kodu AND f.yil = g.yil AND f.ay = g.ay WHERE g.hisse_senedi_kodu IN (${inList(g)}) AND g.yil >= ${yFrom} AND g.kalem IN ('Satış Gelirleri','Ana Ortaklık Payları','FAALİYET BRÜT KÂRI','DÖNEM NET KARI VEYA ZARARI') ORDER BY g.hisse_senedi_kodu, g.yil, g.ay LIMIT 300`,"Strateji Lab finansallar (gelir)"));
      rows.forEach(r=>{const x=per(r.hisse_senedi_kodu,r.yil,r.ay);if(r.yayinlanma_tarihi_utc)x.pub=istDate(r.yayinlanma_tarihi_utc);if(r.kalem==="Satış Gelirleri"||r.kalem==="FAALİYET BRÜT KÂRI")x.rev=r.try_ttm;else x.net=r.try_ttm;});});
    const addEq=(g0,yFrom)=>fjobs.push(async()=>{const rows=await splitOnTimeout(g0,g=>sql(`SELECT hisse_senedi_kodu, yil, ay, try_donemsel FROM hisse_finansal_tablolari_bilanco_kalemleri WHERE hisse_senedi_kodu IN (${inList(g)}) AND yil >= ${yFrom} AND kalem IN ('Ana Ortaklığa Ait Özkaynaklar','ÖZKAYNAKLAR') ORDER BY hisse_senedi_kodu, yil, ay LIMIT 300`,"Strateji Lab finansallar (özkaynak)"));
      rows.forEach(r=>{per(r.hisse_senedi_kodu,r.yil,r.ay).eq=r.try_donemsel;});});
    for(let i=0;i<need.length;i+=2)addInc(need.slice(i,i+2),y0);
    for(let i=0;i<need.length;i+=5)addEq(need.slice(i,i+5),y0);
    for(let i=0;i<refresh.length;i+=12)addInc(refresh.slice(i,i+12),yR);
    for(let i=0;i<refresh.length;i+=30)addEq(refresh.slice(i,i+30),yR);
    if(fjobs.length){await pool(fjobs,4,(d,n)=>prog(`Finansal tablolar: ${d} / ${n} sorgu`,0.68+0.3*d/n));}
    // birleştir (mevcut kayıtların üzerine yaz)
    const byC={};Object.values(P).forEach(x=>{(byC[x.c]=byC[x.c]||[]).push(x);});
    for(const c in byC){const old=new Map((raw.fund[c]||[]).map(x=>[x.y*100+x.a,x]));byC[c].forEach(x=>{const k=x.y*100+x.a;old.set(k,Object.assign(old.get(k)||{y:x.y,a:x.a},Object.fromEntries(Object.entries(x).filter(([k2,v])=>v!=null&&k2!=="c"))));});raw.fund[c]=[...old.values()];}
    fc.forEach(c=>{raw.fund[c]=raw.fund[c]||[];});
    if(fjobs.length)raw.fundSync=istDate(new Date().toISOString());
    raw.lastSync=new Date().toISOString();
    L.raw=raw;const ok=await idb.set("raw",raw);
    L.DB=buildDB(raw);showDataState(ok?"":" · tarayıcı kaydı yapılamadı; sayfa kapanınca yeniden indirilecek");
    prog(`Güncellendi: ${new Date(raw.lastSync).toLocaleString("tr-TR")}`+(L.missed?` · ${L.missed} hissenin geçmişi alınamadı, sonraki güncellemede tekrar denenecek`:""),null);
  }catch(e){prog((L.stage?L.stage+": ":"")+errCopy(e)+(L.raw&&Object.keys(L.raw.bars||{}).length?" İnen kısım korunuyor; tekrar basınca kaldığı yerden devam eder.":""),null);if(L.raw)await idb.set("raw",L.raw);}
  finally{L.busy=false;$("dSync").disabled=false;$("run").disabled=!L.DB;}
}

/* ham veriden motor veri yapısı: düzeltmeler + filtreler */
function buildDB(raw){
  const cm=curMonth();const months=monthsBetween(START_M,raw.lastMonth||cm);const M=months.length;const mi=new Map(months.map((m,i)=>[m,i]));
  const black=new Set(raw.black||[]);const codes=[],px={},tv={};
  // bedelsiz düzeltmesi: tersine dönmeyen, araya uzun ara girmeyen olaylar
  const evBy={};(raw.events||[]).forEach(e=>{(evBy[e.c]=evBy[e.c]||[]).push(e);});
  for(const c in raw.bars){ if(black.has(c))continue; const b=raw.bars[c];const p=new Float64Array(M).fill(NaN),v=new Float64Array(M).fill(NaN);
    for(const m in b){const i=mi.get(m);if(i==null)continue;p[i]=b[m][0];v[i]=b[m][1];}
    const evs=corporateEvents(evBy[c]||[]);
    for(const e of evs){const em=e.d.slice(0,7);const ei=mi.get(em);if(ei==null)continue;for(let i=0;i<ei;i++)if(isNum(p[i]))p[i]*=e.r;}
    // veri hatası koruması: ardışık aylarda 4 kattan büyük oynama ya da 0,20 TL altı fiyat
    for(let i=0;i<M;i++){if(isNum(p[i])&&p[i]<0.2)p[i]=NaN;}
    for(let i=1;i<M;i++){if(isNum(p[i])&&isNum(p[i-1])){const r=p[i]/p[i-1];if(r>4||r<0.25){p[i]=NaN;}}}
    // aylık seride tekrar eden ileri-geri sıçramalar veri hatasıdır: bu hisseyi dışla
    let rev=0;for(let i=1;i<M-1;i++){if(isNum(p[i-1])&&isNum(p[i])&&isNum(p[i+1])){const r1=p[i]/p[i-1],r2=p[i+1]/p[i];if(Math.abs(Math.log(r1))>Math.log(1.6)&&Math.abs(Math.log(r1*r2))<0.15)rev++;}}
    if(rev>=3)continue;
    codes.push(c);px[c]=p;tv[c]=v;}
  const ser=(o,useLast)=>{const a=new Float64Array(M).fill(NaN);months.forEach((m,i)=>{if(o[m]!=null)a[i]=o[m];});return a;};
  // eski sürümle indirilmiş TÜFE bir ay geriye yazılmıştı; yeniden indirilene kadar bir ay ileri kaydırılır
  const tufe=raw.tufeTz?raw.tufe:Object.fromEntries(Object.entries(raw.tufe||{}).map(([m,v])=>[monthNext(m),v]));
  const fund={};for(const c in raw.fund){fund[c]=(raw.fund[c]||[]).filter(x=>x.pub).map(x=>{const prev=(raw.fund[c]||[]).find(y=>y.y===x.y-1&&y.a===x.a);return{pub:x.pub,net:x.net??null,rev:x.rev??null,eq:x.eq??null,revPrev:prev?prev.rev??null:null};}).sort((a,b)=>a.pub<b.pub?-1:1);}
  return{months,codes,px,tv,shares:raw.shares,fund,xu100:ser(raw.xu),usd:ser(raw.usd),tufe:ser(tufe),
    // son ayın barı indirme anındaki ay içi fiyattır (veri güncellenmeden ay değişse bile); tam ay sayılmaz
    partialLast:true,stale:months[M-1]<cm};
}
function showDataState(extra=""){
  const DB=L.DB;if(!DB){$("dState").textContent="Veri yok";return;}
  const live=DB.codes.filter(c=>isNum(DB.px[c][DB.months.length-1])).length;
  const nf2=Object.values(L.raw.fund||{}).filter(a=>a&&a.length).length;
  $("dState").textContent=`${DB.codes.length} hisse · ${mLabel(DB.months[0])} – ${mLabel(DB.months[DB.months.length-1])} · ${nf2} hissede finansal tablo`;
  $("dSub").textContent=`Son güncelleme ${new Date(L.raw.lastSync).toLocaleString("tr-TR")} · bu ay verisi olan ${live} hisse`+(L.raw.black&&L.raw.black.length?` · tutarsız seri nedeniyle dışlanan: ${L.raw.black.join(", ")}`:"")+extra;
  $("dSync").textContent="Güncelle";
  const sel=$("pS");const y0=Number(DB.months[13].slice(0,4))+ (DB.months[13].slice(5,7)>"01"?1:0);const yN=Number(DB.months[DB.months.length-1].slice(0,4))-2;
  if(!sel.options.length){for(let y=y0;y<=yN;y++){const o=document.createElement("option");o.value=y;o.textContent=y;sel.appendChild(o);}sel.value=String(y0);}
}

