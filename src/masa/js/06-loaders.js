/* ---------- loaders ---------- */
function setNote(el,msg,err){el.innerHTML=`<div class="note ${err?"err":""}">${esc(msg)}</div>`;}

async function load(code){
  code=String(code).toUpperCase();
  S.code=code;S.data={code};S.turns=[];
  try{localStorage.setItem("hm_last",code);}catch{}
  $("aiOut").innerHTML="";$("askForm").hidden=true;$("aiRun").disabled=true;
  if(kapCtl)kapCtl.abort();$("kapSum").textContent="Son 12 bildirim. Puanlama, her bildirimin metnini okuyup olası etkisini −2 ile +2 arasında değerlendirir.";$("kapSent").disabled=true;
  syncStar();
  $("pageNote").hidden=true;
  $("qCode").textContent=code;$("qTitle").textContent="Yükleniyor…";
  ["qPrice","qMcap","q52","qSector"].forEach(i=>$(i).textContent="—");$("qChg").textContent="";$("qChg").className="chg";

  let quote;
  try{
    const rows=await sql(`SELECT h.hisse_senedi_kodu, h.unvan, h.son_fiyat, h.son_fiyat_zaman_utc, h.gunici_getiri, h.piyasa_degeri, h.odenmis_sermaye, h.fiili_dolasim_orani, h.endeksler, s.baslik AS sektor FROM hisse_senetleri h LEFT JOIN sektorler s ON s.id = h.sektor_id WHERE h.hisse_senedi_kodu = '${code}' LIMIT 1`,`${code} anlık fiyat ve künye`);
    quote=rows[0];
  }catch(e){
    const n=$("pageNote");n.hidden=false;setNote(n,errCopy(e),true);$("qTitle").textContent="Veri alınamadı";return;
  }
  if(!quote){const n=$("pageNote");n.hidden=false;setNote(n,`"${code}" kodlu bir hisse bulunamadı. Arama kutusuna şirket adını yazarak seçebilirsiniz.`);$("qTitle").textContent="Bulunamadı";return;}
  S.data.quote=quote;renderQuote(quote);
  if(S.code!==code)return;

  const jobs=[loadTech(code),loadFund(code),loadAnalyst(code),loadKap(code),loadOwn(code)];
  await Promise.allSettled(jobs);
  if(S.code!==code)return;
  renderModelSelected();
  $("aiRun").disabled=!S.sample;
  if(!S.sample){$("aiOut").innerHTML=`<p class="sub">Yapay zeka yorumu bu görünümde kullanılamıyor. Sayfayı claude.ai içinde açtığınızda etkinleşir.</p>`;}
}

function renderQuote(q){
  $("qCode").textContent=q.hisse_senedi_kodu;$("qTitle").textContent=q.unvan||"";$("qTitle").title=q.unvan||"";
  $("qPrice").textContent=fmt(q.son_fiyat);
  const g=q.gunici_getiri;const c=$("qChg");c.textContent=pct(g,2);c.className="chg "+(g>0?"up":g<0?"down":"");
  $("qTime").textContent=q.son_fiyat_zaman_utc?"Son işlem "+istDateTime(q.son_fiyat_zaman_utc):"";
  $("qMcap").textContent=big(q.piyasa_degeri);
  $("qFloat").textContent=q.fiili_dolasim_orani!=null?"Fiili dolaşım %"+fmt(q.fiili_dolasim_orani,1):"";
  $("qSector").textContent=q.sektor||"—";
  const idx=String(q.endeksler||"").replace(/[{}\[\]"]/g,"").split(",").filter(Boolean);
  $("qIdx").textContent=idx.includes("XU030")?"BIST 30 üyesi":idx.includes("XU100")?"BIST 100 üyesi":"";
}

async function loadTech(code){
  try{
    const rows=await sql(`SELECT zaman_utc, acilis, yuksek, dusuk, kapanis, hacim_15_dk_gecikmeli FROM mumlar_gunluk_gh WHERE kod = '${code}' AND zaman_utc >= TIMESTAMP '2024-01-01 00:00:00' ORDER BY zaman_utc DESC LIMIT 300`,`${code} günlük fiyat geçmişi`);
    if(S.code!==code)return;
    rows.reverse();
    const T=buildT(rows,S.data.quote);
    if(!T){$("sigBody").innerHTML=`<tr><td colspan="3" class="skel">Teknik analiz için yeterli fiyat geçmişi yok.</td></tr>`;return;}
    S.data.T=T;
    if(!S.charts)S.charts=buildCharts();
    drawTech(T);
    $("tStamp").textContent=`${trDate(T.t[0])} – ${trDate(T.t[T.t.length-1])}, ${T.t.length} işlem günü`+(T.adj?` · ${T.adj} sermaye işlemi için fiyatlar geriye dönük düzeltildi`:"")+(T.live?" · son mum seans içi":"");
    summarizeTech(T);
    scoreFrozen(code,T);
  }catch(e){ if(S.code===code){$("sigBody").innerHTML=`<tr><td colspan="3"><div class="note err">${esc(errCopy(e))}</div></td></tr>`;} }
}

/* Ham mumlardan (artan sırada) düzeltilmiş seri + tüm göstergeler. Panel, tarama tablosu ve model aynı hesabı kullanır. */
function buildT(rows,q){
  const seen=new Set();const R=rows.filter(r=>{const d=istDate(r.zaman_utc);if(!d||seen.has(d)||!(r.kapanis>0))return false;seen.add(d);r._d=d;return true;});
  if(R.length<30)return null;
  const T=adjustCorporate({t:R.map(r=>r._d),o:R.map(r=>r.acilis??r.kapanis),h:R.map(r=>r.yuksek??r.kapanis),l:R.map(r=>r.dusuk??r.kapanis),c:R.map(r=>r.kapanis),v:R.map(r=>r.hacim_15_dk_gecikmeli||0)});
  // Bugünün mumu seans içindeyse son kapanış anlık fiyatla güncellenir; mum henüz tamamlanmamış kabul edilir.
  const today=istDate(new Date().toISOString());
  T.live=T.t[T.t.length-1]===today;
  if(q&&q.son_fiyat&&istDate(q.son_fiyat_zaman_utc)===T.t[T.t.length-1]){const i=T.c.length-1;T.c[i]=q.son_fiyat;T.h[i]=Math.max(T.h[i],q.son_fiyat);T.l[i]=Math.min(T.l[i],q.son_fiyat);}
  T.s20=sma(T.c,20);T.s50=sma(T.c,50);T.s200=sma(T.c,200);T.bb=boll(T.c);T.rsi=rsi(T.c);T.mac=macd(T.c);T.atr=atr(T.h,T.l,T.c);T.st=stoch(T.h,T.l,T.c);
  return T;
}
function computeSignals(T){
  const i=T.c.length-1,p=T.c[i],last=a=>a[i];
  const sig=[];let score=0,max=0;
  const add=(name,val,s,txt)=>{sig.push({name,val,s,txt});if(s!==null){score+=s;max+=1;}};
  const ma=(n,v)=>{if(v==null){add(`SMA${n}`,"—",null,"Veri yetersiz");return;}const d=(p/v-1)*100;add(`Fiyat / SMA${n}`,fmt(v),p>v?1:-1,p>v?`Üstünde (${pct(d)})`:`Altında (${pct(d)})`);};
  ma(20,last(T.s20));ma(50,last(T.s50));ma(200,last(T.s200));
  const a50=last(T.s50),a200=last(T.s200);
  if(a50!=null&&a200!=null){let cross="";for(let k=i;k>i-20&&k>0;k--){if(T.s50[k-1]!=null&&T.s200[k-1]!=null&&T.s50[k]!=null&&T.s200[k]!=null&&Math.sign(T.s50[k]-T.s200[k])!==Math.sign(T.s50[k-1]-T.s200[k-1])){cross=T.s50[k]>T.s200[k]?" · son 20 günde altın kesişim":" · son 20 günde ölüm kesişimi";break;}}
    add("SMA50 / SMA200",a50>a200?"Yukarıda":"Aşağıda",a50>a200?1:-1,(a50>a200?"Uzun vadeli trend yukarı":"Uzun vadeli trend aşağı")+cross);}
  const r=last(T.rsi);
  if(r!=null)add("RSI (14)",fmt(r,1),r<30?1:r>70?-1:0,r<30?"Aşırı satım":r>70?"Aşırı alım":r>=50?"Nötr, alıcılar hafif önde":"Nötr, satıcılar hafif önde");
  const m=last(T.mac.m),s=last(T.mac.sig),h=last(T.mac.h),hp=T.mac.h[i-1];
  if(m!=null&&s!=null)add("MACD",fmt(m,2),m>s?1:-1,(m>s?"Sinyal çizgisinin üstünde":"Sinyal çizgisinin altında")+(h!=null&&hp!=null?(Math.abs(h)>Math.abs(hp)?", ivme artıyor":", ivme azalıyor"):""));
  const u=last(T.bb.up),lo=last(T.bb.lo);
  if(u!=null){const b=(p-lo)/(u-lo);add("Bollinger %B",fmt(b,2),b>1?-1:b<0?1:0,b>1?"Üst bandın dışında":b<0?"Alt bandın dışında":b>0.8?"Üst banda yakın":b<0.2?"Alt banda yakın":"Bant içinde");}
  const k=last(T.st.k),d=last(T.st.d);
  if(k!=null&&d!=null)add("Stokastik (14,3)",fmt(k,1),k<20?1:k>80?-1:0,k<20?"Aşırı satım":k>80?"Aşırı alım":(k>d?"%K, %D'nin üstünde":"%K, %D'nin altında"));
  const at=last(T.atr);if(at!=null)add("ATR (14)",fmt(at),null,`Günlük oynaklık ≈ %${fmt(at/p*100,1)}`);
  const VV=T.live?T.v.slice(0,-1):T.v;const v5=VV.slice(-5).reduce((x,y)=>x+y,0)/5,v50=VV.slice(-50).reduce((x,y)=>x+y,0)/Math.min(50,VV.length);
  add("Hacim (5g / 50g ort.)",fmt(v5/v50,2)+"×",null,v5>v50*1.3?"Ortalamanın belirgin üstünde":v5<v50*0.7?"Ortalamanın altında":"Ortalama civarında");

  const norm=max?score/max:0;
  const label=norm>=0.5?"Güçlü pozitif":norm>=0.15?"Pozitif":norm>-0.15?"Nötr":norm>-0.5?"Negatif":"Güçlü negatif";
  return{sig,norm,label,i,p};
}
function summarizeTech(T){
  const {sig,norm,label,i,p}=computeSignals(T);const last=a=>a[i];const a50=last(T.s50),a200=last(T.s200);
  $("sLabel").textContent=label;$("sLabel").style.color=norm>=0.15?"var(--up)":norm<=-0.15?"var(--down)":"var(--fg)";
  $("sMark").style.left=((norm+1)/2*100)+"%";
  $("sigBody").innerHTML=sig.map(x=>`<tr><td>${esc(x.name)}<div class="sub">${esc(x.txt)}</div></td><td class="r num">${esc(x.val)}</td><td class="r">${x.s===null?'<span class="pill neu">Bilgi</span>':x.s>0?'<span class="pill pos">Pozitif</span>':x.s<0?'<span class="pill neg">Negatif</span>':'<span class="pill neu">Nötr</span>'}</td></tr>`).join("");

  // levels
  const sw=swings(T.h,T.l);const cl=cluster([...sw.hi,...sw.lo],0.015);
  const res=cl.filter(x=>x.v>p*1.003).sort((a,b)=>a.v-b.v).slice(0,2);
  const sup=cl.filter(x=>x.v<p*0.997).sort((a,b)=>b.v-a.v).slice(0,2);
  const pi=T.live&&i>0?i-1:i;const pv=(T.h[pi]+T.l[pi]+T.c[pi])/3;
  const lv=[...res.map((x,j)=>({n:`Direnç ${j+1}`,v:x.v,k:"neg"})).reverse(),...sup.map((x,j)=>({n:`Destek ${j+1}`,v:x.v,k:"pos"}))];
  $("levels").innerHTML=(lv.length?lv:[]).map(x=>`<div class="lvl"><div class="lbl">${x.n}</div><div class="val">${fmt(x.v)}</div><div class="sub">${pct((x.v/p-1)*100)} uzaklıkta</div></div>`).join("")+
    `<div class="lvl"><div class="lbl">Pivot (${pi<i?"önceki gün":"son gün"})</div><div class="val">${fmt(pv)}</div><div class="sub">R1 ${fmt(2*pv-T.l[pi])} · S1 ${fmt(2*pv-T.h[pi])}</div></div>`;
  // 52w
  const n52=Math.min(252,T.c.length);const hi52=Math.max(...T.h.slice(-n52)),lo52=Math.min(...T.l.slice(-n52));
  $("q52").textContent=`${fmt(lo52)} – ${fmt(hi52)}`;$("q52m").style.left=((p-lo52)/(hi52-lo52)*100)+"%";
  // returns
  const ret=n=>T.c.length>n?(p/T.c[i-n]-1)*100:null;
  const yi=T.t.findIndex(t=>t>=T.t[i].slice(0,4)+"-01-01");const ytd=yi>0?(p/T.c[yi-1]-1)*100:null;
  const RT=[["1 hafta",ret(5)],["1 ay",ret(21)],["3 ay",ret(63)],["6 ay",ret(126)],["Yıl başı",ytd]];
  $("rets").innerHTML=RT.map(([n,v])=>`<div><div class="lbl">${n}</div><div class="num" style="color:${v>0?"var(--up)":v<0?"var(--down)":"inherit"}">${pct(v)}</div></div>`).join("");
  S.data.tech={fiyat:p,tarih:T.t[i],skor:label,sinyaller:sig.map(x=>({gosterge:x.name,deger:x.val,yorum:x.txt})),direncler:res.map(x=>+x.v.toFixed(2)),destekler:sup.map(x=>+x.v.toFixed(2)),hafta52:{dusuk:lo52,yuksek:hi52},getiriler:Object.fromEntries(RT.map(([n,v])=>[n,v==null?null:+v.toFixed(1)])),sma:{s20:a(T.s20[i]),s50:a(a50),s200:a(a200)}};
  function a(v){return v==null?null:+v.toFixed(2);}
}

const REV=["Satış Gelirleri","FAALİYET BRÜT KÂRI"],NET=["Ana Ortaklık Payları","DÖNEM NET KARI VEYA ZARARI"],EBITDA=["FAVÖK"],GROSS=["Brüt Kar (Zarar)"];
const EQ=["Ana Ortaklığa Ait Özkaynaklar","ÖZKAYNAKLAR"],TA=["Toplam Varlıklar","VARLIKLAR TOPLAMI"];
/* Finansal özet satırları: [etiket, Fintables kalem adları, kip]. Kip yoksa ilk bulunan kalem; "all" ise hepsi varsa toplamları;
   "ttm" ise gelir tablosundan son 12 ay değeri (kalem adı yerine çeyrek alanı). Sıra kullanıcının istediği listeye göredir. */
const BAL_ROWS=[["Dönen varlıklar",["Toplam Dönen Varlıklar"]],["Kısa vadeli yükümlülükler",["Toplam Kısa Vadeli Yükümlülükler"]],["Nakit ve nakit benzerleri",["Nakit ve Nakit Benzerleri"]],
  ["Finansal yatırımlar",["Finansal Yatırımlar"]],["Finansal borçlar",["Toplam Finansal Borçlar"]],["Toplam varlıklar",TA],
  ["Toplam yükümlülükler",["Toplam Kısa Vadeli Yükümlülükler","Toplam Uzun Vadeli Yükümlülükler"],"all"],
  ["FAVÖK (son 12 ay)","ttmEbitda","ttm"],["Net dönem kârı (son 12 ay)","ttmNet","ttm"],
  ["Özkaynaklar",EQ],["Ödenmiş sermaye",["Ödenmiş Sermaye"]],["Net borç",["Net Borç"]]];
/* Bilançoda kısa ve uzun vadeli olarak iki kez geçen kalemler toplanır; diğerlerinde son gelen değer alınır. */
const BAL_SUM=new Set(["Finansal Yatırımlar"]);
function balMap(rows){const B={};rows.forEach(r=>{const m=B[r.yil]=B[r.yil]||{};
  if(BAL_SUM.has(r.kalem)){if(r.try_donemsel!=null)m[r.kalem]=(m[r.kalem]||0)+r.try_donemsel;}else m[r.kalem]=r.try_donemsel;});return B;}
/* cur/prev: o yılın kalem haritası; q/qPrev: son çeyrek ve bir yıl önceki aynı çeyrek (ttm alanları için) */
function balRows(cur,prev,q,qPrev){
  const val=(m,qq,[,names,mode])=>mode==="ttm"?(qq&&qq[names]!=null?qq[names]:null):mode==="all"?(names.every(n=>m[n]!=null)?names.reduce((s,n)=>s+m[n],0):null):pick(m,names);
  return BAL_ROWS.map(row=>({n:row[0],a:val(cur,q,row),b:val(prev,qPrev,row)})).filter(x=>x.a!=null||x.b!=null);
}
/* Kullanıcının tanımladığı beş mali durum göstergesi; finansal özet satırlarından (balRows çıktısı) hesaplanır.
   cur: son dönem, prev: önceki yılın aynı dönemi. Girdisi eksik olan gösterge null döner. */
function finMetrics(list){
  const calc=s=>{const v=k=>{const r=list.find(x=>x.n===k);return r?r[s]:null;},has=(...k)=>k.every(x=>v(x)!=null);
    return{
      nis:has("Dönen varlıklar","Kısa vadeli yükümlülükler")?v("Dönen varlıklar")-v("Kısa vadeli yükümlülükler"):null,
      // finansal yatırımı ya da finansal borcu olmayan şirkette o kalem 0 sayılır
      nakit:has("Nakit ve nakit benzerleri")?v("Nakit ve nakit benzerleri")+(v("Finansal yatırımlar")||0)-(v("Finansal borçlar")||0):null,
      mali:has("Toplam varlıklar","Toplam yükümlülükler")?v("Toplam varlıklar")-v("Toplam yükümlülükler"):null,
      // net dönem zararında oran anlamsızdır
      favok:has("FAVÖK (son 12 ay)","Net dönem kârı (son 12 ay)")&&v("Net dönem kârı (son 12 ay)")>0?v("FAVÖK (son 12 ay)")/v("Net dönem kârı (son 12 ay)"):null,
      zarar:v("Net dönem kârı (son 12 ay)")!=null&&v("Net dönem kârı (son 12 ay)")<=0,
      bedelsiz:has("Özkaynaklar","Ödenmiş sermaye")&&v("Ödenmiş sermaye")>0?v("Özkaynaklar")/v("Ödenmiş sermaye"):null};};
  return{cur:calc("a"),prev:calc("b")};
}
const pick=(map,names)=>{for(const n of names)if(map[n]!=null)return map[n];return null;};

async function loadFund(code){
  try{
    const per=await sql(`SELECT yil, ay, finansal_tablo_sablonu, yayinlanma_tarihi_utc FROM hisse_finansal_tablolari WHERE hisse_senedi_kodu = '${code}' ORDER BY yil DESC, ay DESC LIMIT 1`,`${code} son finansal dönem`);
    if(S.code!==code)return;
    if(!per.length){["qBars","ratios"].forEach(id=>$(id).innerHTML=`<div class="skel">Bu hisse için finansal tablo bulunamadı.</div>`);$("balBody").innerHTML="";$("finTiles").innerHTML="";return;}
    const {yil,ay,finansal_tablo_sablonu:tpl}=per[0];
    $("fStamp").textContent=`Son dönem ${yil}/${String(ay).padStart(2,"0")}${per[0].yayinlanma_tarihi_utc?", yayın "+trDate(istDate(per[0].yayinlanma_tarihi_utc)):""}`;
    $("bCur").textContent=`${String(ay).padStart(2,"0")}/${yil}`;$("bPrev").textContent=`${String(ay).padStart(2,"0")}/${yil-1}`;
    const incNames=[...REV,...NET,...EBITDA,...GROSS];
    const balNames=[...new Set(BAL_ROWS.filter(r=>r[2]!=="ttm").flatMap(r=>r[1]))];
    const [inc,bal,rat]=await Promise.all([
      sql(`SELECT yil, ay, kalem, try_ceyreklik, try_ttm FROM hisse_finansal_tablolari_gelir_tablosu_kalemleri WHERE hisse_senedi_kodu = '${code}' AND yil >= ${yil-3} AND kalem IN (${inList(incNames)}) ORDER BY yil, ay LIMIT 120`,`${code} çeyreklik gelir tablosu`),
      sql(`SELECT yil, ay, kalem, try_donemsel FROM hisse_finansal_tablolari_bilanco_kalemleri WHERE hisse_senedi_kodu = '${code}' AND ay = ${ay} AND yil IN (${yil}, ${yil-1}) AND kalem IN (${inList(balNames)}) LIMIT 60`,`${code} bilanço özeti`),
      sql(`SELECT kategori, oran, deger FROM hisse_finansal_tablolari_finansal_oranlari WHERE hisse_senedi_kodu = '${code}' AND yil = ${yil} AND ay = ${ay} ORDER BY kategori, satir_no LIMIT 80`,`${code} finansal oranlar`)
    ]);
    if(S.code!==code)return;
    // income by period
    const P={};inc.forEach(r=>{const k=r.yil*100+r.ay;(P[k]=P[k]||{yil:r.yil,ay:r.ay,q:{},ttm:{}});P[k].q[r.kalem]=r.try_ceyreklik;P[k].ttm[r.kalem]=r.try_ttm;});
    const periods=Object.keys(P).sort().map(k=>P[k]);
    const qs=periods.map(p=>({lbl:`${String(p.ay/3).replace(/\D/g,"")}Ç${String(p.yil).slice(2)}`,yil:p.yil,ay:p.ay,rev:pick(p.q,REV),net:pick(p.q,NET),ebitda:pick(p.q,EBITDA),gross:pick(p.q,GROSS),ttmRev:pick(p.ttm,REV),ttmNet:pick(p.ttm,NET),ttmEbitda:pick(p.ttm,EBITDA)}));
    drawBars(qs.slice(-8));
    const lastQ=qs[qs.length-1],yoQ=qs.find(x=>x.yil===lastQ.yil-1&&x.ay===lastQ.ay);
    // yüzde değişim yalnızca pozitif bazda anlamlıdır; geçen yıl zarar varsa geçiş sözle anlatılır
    const gRev=yoQ&&yoQ.rev>0&&lastQ.rev!=null?(lastQ.rev/yoQ.rev-1)*100:null,gNet=yoQ&&yoQ.net>0&&lastQ.net!=null?(lastQ.net/yoQ.net-1)*100:null;
    const netTxt=gNet!=null?pct(gNet):!yoQ||yoQ.net==null||lastQ.net==null?"—":lastQ.net>0?"zarardan kâra geçti":lastQ.net>yoQ.net?"zarar azaldı":"zarar büyüdü";
    $("growthNote").textContent=yoQ?`Son çeyrek yıllık: satış ${pct(gRev)}, net kâr ${netTxt}`:"";
    // balance
    const B=balMap(bal);
    const cur=B[yil]||{},prev=B[yil-1]||{};
    const balList=balRows(cur,prev,lastQ,yoQ);
    $("balBody").innerHTML=balList.map(({n,a,b})=>{
      const ch=a!=null&&b&&b>0?(a/b-1)*100:null;return `<tr><td>${n}</td><td class="r num">${bn(a)}</td><td class="r num">${bn(b)}</td><td class="r num">${pct(ch,0)}</td></tr>`;}).join("")||`<tr><td colspan="4" class="skel">Özet kalemler bu şablonda yok.</td></tr>`;
    // mali durum göstergeleri
    const FM=finMetrics(balList),fc=FM.cur,fp=FM.prev;
    const fTile=(l,val,sub,col)=>`<div><div class="lbl">${l}</div><div class="val" style="color:${col||"inherit"}">${val}</div><div class="sub">${sub}</div></div>`;
    const sgn=v=>v>0?"var(--up)":v<0?"var(--down)":"inherit",was=(v,f)=>v==null?"":` · önceki yıl ${f(v)}`,x1=v=>fmt(v,1)+"×",x2=v=>fmt(v,2)+"×";
    $("finTiles").innerHTML=[fc.nis,fc.nakit,fc.mali,fc.favok,fc.bedelsiz].every(v=>v==null)&&!fc.zarar?`<div style="grid-column:1/-1" class="skel">Bu şablonda (ör. banka) göstergeler için gereken kalemler yok.</div>`:
      fTile("Net işletme sermayesi",fc.nis!=null?big(fc.nis):"—",(fc.nis==null?"":fc.nis>=0?"Dönen varlıklar kısa vadeli borcu karşılıyor":"Dönen varlıklar kısa vadeli borcu karşılamıyor")+was(fp.nis,big),sgn(fc.nis))+
      fTile("Nakit durumu",fc.nakit!=null?big(fc.nakit):"—",(fc.nakit==null?"":fc.nakit>=0?"Net nakit fazlası":"Net finansal borç")+was(fp.nakit,big),sgn(fc.nakit))+
      fTile("Mali yapı",fc.mali!=null?big(fc.mali):"—",(fc.mali==null?"":"Varlıklar − toplam borç")+was(fp.mali,big),sgn(fc.mali))+
      fTile("FAVÖK / net kâr",fc.favok!=null?x2(fc.favok):"—",(fc.zarar?"Son 12 ayda net zarar var":fc.favok==null?"":"Son 12 ay")+was(fp.favok,x2))+
      fTile("Bedelsiz potansiyeli",fc.bedelsiz!=null?x1(fc.bedelsiz):"—",(fc.bedelsiz==null?"":"Özkaynak / ödenmiş sermaye")+was(fp.bedelsiz,x1));
    // valuation
    const mc=S.data.quote&&S.data.quote.piyasa_degeri;
    const eq=pick(cur,EQ),nd=pick(cur,["Net Borç"]);
    const isFin=tpl&&tpl!=="default";
    const pe=lastQ.ttmNet>0?mc/lastQ.ttmNet:null,pb=eq>0?mc/eq:null;
    const ev=!isFin&&nd!=null?mc+nd:null,evE=ev!=null&&lastQ.ttmEbitda>0?ev/lastQ.ttmEbitda:null;
    const ndEq=!isFin&&nd!=null&&eq>0?nd/eq*100:null;
    const tiles=$("valTiles").children;
    tiles[0].querySelector(".val").textContent=pe!=null?fmt(pe,1)+"×":(lastQ.ttmNet<0?"Zarar":"—");
    tiles[1].querySelector(".val").textContent=pb!=null?fmt(pb,2)+"×":"—";
    tiles[2].querySelector(".val").textContent=evE!=null?fmt(evE,1)+"×":"—";
    tiles[2].querySelector(".sub").textContent=isFin?"Finans şirketlerinde anlamlı değil":"Son 12 ay";
    tiles[3].querySelector(".val").textContent=ndEq!=null?"%"+fmt(ndEq,0):"—";
    // ratios
    const cats={};rat.forEach(r=>{(cats[r.kategori]=cats[r.kategori]||[]).push(r);});
    const isPct=n=>/Marj|Karlılık|ROIC|Oranı$|Borç Oranı/.test(n)&&!/Cari|Likidite|Nakit Oran/.test(n);
    $("ratios").innerHTML=Object.keys(cats).length?Object.entries(cats).map(([k,rows])=>`<div><div class="lbl" style="margin-bottom:6px">${esc(k)}</div><table><tbody>${rows.map(r=>`<tr><td>${esc(r.oran)}</td><td class="r num">${r.deger==null?"—":isPct(r.oran)?"%"+fmt(r.deger,1):fmt(r.deger,2)}</td></tr>`).join("")}</tbody></table></div>`).join(""):`<div class="skel">Oran verisi yok.</div>`;
    S.data.fund={donem:`${yil}/${ay}`,sablon:tpl,degerleme:{FK:pe&&+pe.toFixed(1),PDDD:pb&&+pb.toFixed(2),FD_FAVOK:evE&&+evE.toFixed(1),netBorc_ozkaynak_yuzde:ndEq&&+ndEq.toFixed(0),piyasaDegeri_mrTL:mc&&+(mc/1e9).toFixed(1)},
      ceyrekler_mrTL:qs.slice(-6).map(x=>({donem:x.lbl,satis:r1(x.rev),brutKar:r1(x.gross),favok:r1(x.ebitda),netKar:r1(x.net)})),
      son12ay_mrTL:{satis:r1(lastQ.ttmRev),favok:r1(lastQ.ttmEbitda),netKar:r1(lastQ.ttmNet)},yillikBuyume:{satis:gRev!=null?+gRev.toFixed(1):null,netKar:gNet!=null?+gNet.toFixed(1):netTxt},
      bilanco_mrTL:Object.fromEntries(balList.map(x=>[x.n,{son:r1(x.a),oncekiYil:r1(x.b)}])),
      maliDurumGostergeleri:{netIsletmeSermayesi_mrTL:r1(fc.nis),nakitDurumu_mrTL:r1(fc.nakit),maliYapi_mrTL:r1(fc.mali),favokBoluNetKar:fc.favok==null?(fc.zarar?"net zarar":null):+fc.favok.toFixed(2),bedelsizPotansiyeli_ozkaynakBoluSermaye:fc.bedelsiz==null?null:+fc.bedelsiz.toFixed(1)},
      oranlar:Object.fromEntries(rat.map(r=>[r.oran,r.deger==null?null:+Number(r.deger).toFixed(2)]))};
  }catch(e){ if(S.code===code){setNote($("qBars"),errCopy(e),true);$("ratios").innerHTML="";$("balBody").innerHTML="";$("finTiles").innerHTML="";} }
  function r1(v){return v==null?null:+(v/1e9).toFixed(2);}
}

function drawBars(qs){
  if(!qs.length){$("qBars").innerHTML=`<div class="skel">Çeyreklik veri yok.</div>`;return;}
  const W=560,H=220,pl=40,pr=8,pt=12,pb=26;
  const vals=qs.flatMap(q=>[q.rev||0,q.net||0]);const mx=Math.max(0,...vals),mn=Math.min(0,...vals);
  const step=niceStep((mx-mn)/1e9/4);const top=Math.ceil(mx/1e9/step)*step,bot=Math.floor(mn/1e9/step)*step;
  const y=v=>pt+(top-v/1e9)/(top-bot||1)*(H-pt-pb);
  const gw=(W-pl-pr)/qs.length,bw=Math.min(22,gw*0.32);
  let g="";for(let t=bot;t<=top+1e-9;t+=step){const yy=y(t*1e9);g+=`<line x1="${pl}" x2="${W-pr}" y1="${yy}" y2="${yy}" stroke="var(--line-soft)"/><text x="${pl-6}" y="${yy+3.5}" text-anchor="end" font-size="10" fill="var(--faint)" font-family="IBM Plex Mono,monospace">${nf(0).format(t)}</text>`;}
  let b="";qs.forEach((q,i)=>{const cx=pl+gw*i+gw/2;
    const bar=(v,x,col)=>{if(v==null)return"";const y0=y(0),y1=y(v);return `<rect x="${x}" y="${Math.min(y0,y1)}" width="${bw}" height="${Math.max(1,Math.abs(y1-y0))}" rx="2" fill="${col}"><title>${q.lbl}: ${nf(1).format(v/1e9)} mr TL</title></rect>`;};
    b+=bar(q.rev,cx-bw-1,"var(--accent)")+bar(q.net,cx+1,q.net<0?"var(--down)":"var(--up)");
    b+=`<text x="${cx}" y="${H-8}" text-anchor="middle" font-size="10.5" fill="var(--muted)" font-family="IBM Plex Mono,monospace">${q.lbl}</text>`;});
  $("qBars").innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Çeyreklik satış ve net kâr">${g}<line x1="${pl}" x2="${W-pr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--line)"/>${b}</svg>`;
}

const TAV={al:["AL","pos"],endeks_ustu:["Endeks üstü","pos"],tut:["TUT","neu"],endekse_paralel:["Endekse paralel","neu"],notr:["Nötr","neu"],endeks_alti:["Endeks altı","neg"],sat:["SAT","neg"]};
async function loadAnalyst(code){
  try{
    const rows=await sql(`SELECT hf.yayin_tarihi_europe_istanbul, hf.araci_kurum_kodu, ak.kisa_unvan, hf.tavsiye, hf.hedef_fiyat, hf.model_portfoyde FROM hisse_senedi_araci_kurum_hedef_fiyatlari hf LEFT JOIN araci_kurumlar ak ON ak.araci_kurum_kodu = hf.araci_kurum_kodu WHERE hf.hisse_senedi_kodu = '${code}' ORDER BY hf.yayin_tarihi_europe_istanbul DESC LIMIT 80`,`${code} aracı kurum hedef fiyatları`);
    if(S.code!==code)return;
    const p=S.data.quote&&S.data.quote.son_fiyat;
    // 6 aylık pencere bugünden geriye sayılır (hissenin son raporundan değil)
    const cutoff=new Date(Date.parse(istDate(new Date().toISOString()))-182*864e5).toISOString().slice(0,10);
    const seen=new Set(),L=[];
    rows.forEach(r=>{const d=istDate(r.yayin_tarihi_europe_istanbul);if(!d||d<cutoff)return;const k=r.araci_kurum_kodu||r.kisa_unvan;if(seen.has(k))return;seen.add(k);L.push({...r,_d:d});});
    if(!L.length){const old=rows.length?istDate(rows[0].yayin_tarihi_europe_istanbul):null;
      $("anBody").innerHTML=`<tr><td colspan="5" class="skel">Son 6 ayda yayımlanmış hedef fiyat yok${old?` (en son rapor ${trDate(old)})`:""}.</td></tr>`;
      [...$("anTiles").children].forEach(t=>{t.querySelector(".val").textContent="—";t.querySelector(".sub").textContent="";});
      S.data.analyst={not:"Son 6 ayda hedef fiyat yok",enSonRapor:old};return;}
    $("anBody").innerHTML=L.map(r=>{const t=TAV[r.tavsiye]||[r.tavsiye||"—","neu"];const pot=r.hedef_fiyat&&p?(r.hedef_fiyat/p-1)*100:null;
      return `<tr><td class="num">${trDate(r._d)}</td><td>${esc(r.kisa_unvan||r.araci_kurum_kodu)}${r.model_portfoyde?' <span class="pill warn">Model portföy</span>':""}</td><td>${r.tavsiye?`<span class="pill ${t[1]}">${esc(t[0])}</span>`:'<span class="sub">—</span>'}</td><td class="r num">${fmt(r.hedef_fiyat)}</td><td class="r num" style="color:${pot>0?"var(--up)":pot<0?"var(--down)":"inherit"}">${pct(pot)}</td></tr>`;}).join("");
    const tg=L.map(r=>r.hedef_fiyat).filter(v=>v>0).sort((a,b)=>a-b);
    const avg=tg.reduce((a,b)=>a+b,0)/tg.length,med=tg.length%2?tg[(tg.length-1)/2]:(tg[tg.length/2-1]+tg[tg.length/2])/2;
    const cnt={pos:0,neu:0,neg:0};L.forEach(r=>{const t=TAV[r.tavsiye];if(t)cnt[t[1]]++;});
    const T=$("anTiles").children;
    T[0].querySelector(".val").textContent=fmt(avg);T[0].querySelector(".sub").textContent=p?`Potansiyel ${pct((avg/p-1)*100)}`:"";
    T[1].querySelector(".val").textContent=fmt(med);T[1].querySelector(".sub").textContent=p?`Potansiyel ${pct((med/p-1)*100)}`:"";
    T[2].querySelector(".val").textContent=`${fmt(tg[0],0)} – ${fmt(tg[tg.length-1],0)}`;T[2].querySelector(".sub").textContent=`${tg.length} kurum`;
    T[3].querySelector(".val").innerHTML=`<span style="color:var(--up)">${cnt.pos}</span> / ${cnt.neu} / <span style="color:var(--down)">${cnt.neg}</span>`;T[3].querySelector(".sub").textContent="Olumlu / nötr / olumsuz";
    S.data.analyst={kurumSayisi:tg.length,ortalamaHedef:+avg.toFixed(2),medyanHedef:+med.toFixed(2),enDusuk:tg[0],enYuksek:tg[tg.length-1],olumlu:cnt.pos,notr:cnt.neu,olumsuz:cnt.neg,
      sonRaporlar:L.slice(0,8).map(r=>({tarih:r._d,kurum:r.kisa_unvan,tavsiye:r.tavsiye,hedef:r.hedef_fiyat}))};
  }catch(e){ if(S.code===code)$("anBody").innerHTML=`<tr><td colspan="5"><div class="note err">${esc(errCopy(e))}</div></td></tr>`; }
}

const KAPT={ODA:["Özel durum","warn"],FR:["Finansal rapor","pos"],CA:["Pay işlemi","neu"],DKB:["Düzenleyici","neu"],DUY:["Duyuru","neu"],DG:["Diğer","neu"]};
async function loadKap(code){
  try{
    const r=await call("dokumanlarda_ara",{query:"",filter:`dokuman_tipi = "kap_haberi" AND iliskili_semboller = "${code}"`,sirala:"yayinlanma_tarihi_utc:desc",sayfa_basi:12,purpose:`${code} son KAP bildirimleri`});
    if(S.code!==code)return;
    let p=r.payload;if(typeof p==="string"){try{p=JSON.parse(p);}catch{p=null;}}
    const items=(p&&p.sonuclar)||[];
    if(!items.length){$("news").innerHTML=`<li class="skel">KAP bildirimi bulunamadı.</li>`;return;}
    $("news").innerHTML=items.map(n=>{const t=KAPT[n.kap_bildirim_tipi]||[n.kap_bildirim_tipi||"KAP","neu"];
      const url=/^https:\/\/(www\.)?kap\.org\.tr\//.test(n.dokuman_orijinal_url||"")?n.dokuman_orijinal_url:null;
      const title=esc(n.document_title||n.kap_bildirim_konu||"Bildirim");
      const others=(n.iliskili_semboller||[]).filter(s=>s!==code);
      return `<li data-i="${items.indexOf(n)}"><span class="d">${istDateTime(n.yayinlanma_tarihi_utc)}</span><div style="min-width:0">${url?`<a href="${esc(url)}" target="_blank" rel="noopener">${title}</a>`:title}<div class="sub oz">${others.length?"İlgili: "+esc(others.slice(0,5).join(", ")):""}</div></div><span style="display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end"><span class="sent"></span><span class="pill ${t[1]}">${esc(t[0])}</span></span></li>`;}).join("");
    S.data.kapItems=items;$("kapSent").disabled=!S.sample;
    S.data.kap=items.map(n=>({tarih:istDate(n.yayinlanma_tarihi_utc),tip:n.kap_bildirim_tipi,baslik:n.document_title||n.kap_bildirim_konu}));
  }catch(e){ if(S.code===code)$("news").innerHTML=`<li><div class="note err">${esc(errCopy(e))}</div></li>`; }
}

