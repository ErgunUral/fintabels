/* ---------- Model arayüzü ---------- */
const ML={stocks:null,res:null,H:5,target:"abs",months:14,cost:0.2,busy:false};
function segBind(id,key,cast){document.querySelectorAll(`#${id} button`).forEach(b=>b.onclick=()=>{if(ML.busy)return;ML[key]=cast(b.dataset.v);
  document.querySelectorAll(`#${id} button`).forEach(x=>x.setAttribute("aria-pressed",String(x===b)));
  $("mTrain").textContent=ML.res&&(ML.res.H!==ML.H||ML.res.target!==ML.target)?"Bu ayarla eğit":"Modeli eğit";});}
segBind("mH","H",Number);segBind("mT","target",String);segBind("mM","months",Number);
function mProg(msg,f){$("mStatus").textContent=msg;const p=$("mProg");p.hidden=f==null;if(f!=null)p.firstElementChild.style.width=Math.round(f*100)+"%";}

/* IndexedDB: günlük veri önbelleği (yalnızca bu tarayıcıda) */
//@include shared/idb.js
const idb=makeIdb("hisse-masa");
const AUTH_CODES=["server_not_connected","needs_reauth","not_in_manifest","not_granted","consent_required","blocked_by_policy","selection_required","capability_disabled"];
/* yeniden denemenin anlamsız olduğu hatalar: yetki sorunları ve Fintables günlük kotası */
const isFatal=e=>AUTH_CODES.includes(e&&e.code)||isQuota(e);
function parseCandles(rows){const seen=new Set();return rows.filter(r=>{const d=istDate(r.zaman_utc);if(!d||seen.has(d)||!(r.kapanis>0)||!(r.yuksek>0)||!(r.dusuk>0))return false;seen.add(d);r._d=d;return true;});}
async function fetchUniverse(months){
  const today=istDate(new Date().toISOString());const key=`bist100_${months}_${today}`;
  const cached=await idb.get(key);
  if(cached&&cached.stocks&&cached.stocks.length>=20){mProg("Bugün çekilmiş veri önbellekten kullanılıyor…",0.6);return Object.assign(cached.stocks,{failed:cached.failed,fromCache:true});}
  const uni=await sql(`SELECT hisse_senedi_kodu, odenmis_sermaye FROM hisse_senetleri WHERE 'XU100' = ANY(endeksler) ORDER BY hisse_senedi_kodu LIMIT 120`,"BIST 100 hisse listesi");
  const list=uni.filter(r=>/^[A-Z0-9]{3,6}$/.test(r.hisse_senedi_kodu));
  if(list.length<20)throw{code:"tool_error",message:"BIST 100 listesi alınamadı."};
  const shares=Object.fromEntries(list.map(r=>[r.hisse_senedi_kodu,r.odenmis_sermaye]));
  const codes=list.map(r=>r.hisse_senedi_kodu),total=codes.length,out=[];let done=0,fail=0,fatal=null;
  const q=(code,extra)=>sql(`SELECT zaman_utc, acilis, yuksek, dusuk, kapanis, hacim_15_dk_gecikmeli FROM mumlar_gunluk_gh WHERE kod = '${code}' AND zaman_utc >= TIMESTAMP '2022-01-01 00:00:00'${extra} ORDER BY zaman_utc DESC LIMIT 300`,`${code} model eğitimi için fiyat geçmişi`);
  const worker=async()=>{while(codes.length&&!fatal){const code=codes.shift();
    try{let rows=await q(code,"");
      if(months>14&&rows.length===300){const first=rows[rows.length-1].zaman_utc;const older=await q(code,` AND zaman_utc < TIMESTAMP '${String(first).replace("T"," ").slice(0,19)}'`);rows=rows.concat(older);}
      rows.reverse();const R=parseCandles(rows);
      if(R.length>=120){const T={t:R.map(r=>r._d),o:R.map(r=>r.acilis||r.kapanis),h:R.map(r=>r.yuksek),l:R.map(r=>r.dusuk),c:R.map(r=>r.kapanis),v:R.map(r=>r.hacim_15_dk_gecikmeli||0)};out.push({code,T:adjustCorporate(T),F:{shares:shares[code],rep:[]}});}
    }catch(e){fail++;if(isFatal(e))fatal=e;}
    done++;mProg(`Fiyat geçmişi çekiliyor: ${done} / ${total} hisse`,done/total*0.5);}};
  await Promise.all(Array.from({length:6},worker));
  if(fatal)throw fatal;
  if(out.length<20)throw{code:"tool_error",message:`Yalnızca ${out.length} hissenin verisi alınabildi.`};
  out.sort((a,b)=>a.code<b.code?-1:1);
  await fetchFundamentals(out);
  out.failed=fail;
  await idb.set(key,{stocks:out.map(s=>({code:s.code,T:s.T,F:s.F})),failed:fail});idb.clearOld(key,"bist100_");
  return out;
}
/* Temel veriler: yayın tarihiyle birlikte TTM net kâr, TTM satış (bankada faaliyet brüt kârı) ve ana ortaklık özkaynağı */
async function fetchFundamentals(stocks){
  const y0=Math.min(...stocks.map(s=>Number(s.T.t[0].slice(0,4))))-1;
  const by=Object.fromEntries(stocks.map(s=>[s.code,s]));const codes=stocks.map(s=>s.code);
  const P={};const per=(c,y,a)=>{const k=c+"|"+(y*100+a);return P[k]||(P[k]={c,y,a});};
  const batches=(n)=>{const b=[];for(let i=0;i<codes.length;i+=n)b.push(codes.slice(i,i+n));return b;};
  const incB=batches(8),eqB=batches(14);let done=0;const tot=incB.length+eqB.length;
  const step=()=>{done++;mProg(`Temel veriler çekiliyor: ${done} / ${tot} sorgu`,0.5+done/tot*0.1);};
  const jobs=[...incB.map(b=>async()=>{const rows=await sql(`SELECT g.hisse_senedi_kodu, g.yil, g.ay, f.yayinlanma_tarihi_utc, g.kalem, g.try_ttm FROM hisse_finansal_tablolari_gelir_tablosu_kalemleri g JOIN hisse_finansal_tablolari f ON f.hisse_senedi_kodu = g.hisse_senedi_kodu AND f.yil = g.yil AND f.ay = g.ay WHERE g.hisse_senedi_kodu IN (${inList(b)}) AND g.yil >= ${y0} AND g.kalem IN ('Satış Gelirleri','Ana Ortaklık Payları','FAALİYET BRÜT KÂRI','DÖNEM NET KARI VEYA ZARARI') LIMIT 300`,"Model için temel veriler (gelir)");
      rows.forEach(r=>{const x=per(r.hisse_senedi_kodu,r.yil,r.ay);if(r.yayinlanma_tarihi_utc)x.pub=istDate(r.yayinlanma_tarihi_utc);
        if(r.kalem==="Satış Gelirleri"||r.kalem==="FAALİYET BRÜT KÂRI")x.rev=r.try_ttm;else x.net=r.try_ttm;});step();}),
    ...eqB.map(b=>async()=>{const rows=await sql(`SELECT hisse_senedi_kodu, yil, ay, try_donemsel FROM hisse_finansal_tablolari_bilanco_kalemleri WHERE hisse_senedi_kodu IN (${inList(b)}) AND yil >= ${y0} AND kalem IN ('Ana Ortaklığa Ait Özkaynaklar','ÖZKAYNAKLAR') LIMIT 300`,"Model için temel veriler (özkaynak)");
      rows.forEach(r=>{per(r.hisse_senedi_kodu,r.yil,r.ay).eq=r.try_donemsel;});step();})];
  const run=async()=>{while(jobs.length){const j=jobs.shift();try{await j();}catch(e){if(isFatal(e))throw e;step();}}};
  await Promise.all([run(),run(),run(),run()]);
  Object.values(P).forEach(x=>{if(!x.pub||!by[x.c])return;const prev=P[x.c+"|"+((x.y-1)*100+x.a)];x.revPrev=prev?prev.rev:null;
    by[x.c].F.rep.push({pub:x.pub,net:x.net??null,rev:x.rev??null,eq:x.eq??null,revPrev:x.revPrev??null});});
  stocks.forEach(s=>s.F.rep.sort((a,b)=>a.pub<b.pub?-1:1));
}

$("mTrain").onclick=async()=>{
  if(ML.busy||!S.mcp)return;ML.busy=true;$("mTrain").disabled=true;
  try{
    if(!ML.stocks||ML.stocks.months!==ML.months){mProg("BIST 100 listesi alınıyor…",0);ML.stocks=await fetchUniverse(ML.months);ML.stocks.months=ML.months;}
    ML.stocks.forEach(s=>delete s.X);
    const res=await runModel(ML.stocks,ML.H,ML.target,async(msg,f)=>{mProg(msg+"…",0.6+f*0.4);await tick();});
    res.failed=ML.stocks.failed||0;res.months=ML.months;
    ML.res=res;try{localStorage.setItem("hm_model",JSON.stringify(res));}catch{}
    renderModel();refreshWatch(true);if(SC.rows.length)renderScan();mProg(`Eğitim tamamlandı: ${res.nStocks} hisse, ${nf(0).format(res.nSamples)} örnek${ML.stocks.fromCache?" (bugünkü önbellek verisiyle)":""}.`,null);
  }catch(e){mProg(e&&e.code?errCopy(e):("Eğitim tamamlanamadı: "+(e&&e.message||e)),null);}
  finally{ML.busy=false;$("mTrain").disabled=false;$("mTrain").textContent="Yeniden eğit";}
};

/* Modelin son veri gününden bugüne geçen hafta içi gün sayısı (resmî tatiller ayrıca düşülmez). */
function modelAge(R){if(!R||!R.dataTo)return 0;const end=Date.parse(istDate(new Date().toISOString()));let n=0;
  for(let d=Date.parse(R.dataTo)+864e5;d<=end;d+=864e5){const w=new Date(d).getUTCDay();if(w!==0&&w!==6)n++;}return n;}
/* Tahmin ufku dolduysa olasılıklar artık geçerli değildir: tablolarda ve alarmlarda gösterilmez. */
const modelExpired=R=>modelAge(R)>=R.H;
function modelProbFor(code){
  const R=ML.res;if(!R)return null;
  const hit=R.preds.find(p=>p.code===code);if(hit)return{p:hit.p,src:"bist100"};
  const T=S.data.T;if(T&&S.code===code){const p=predictOne(R,adjustCorporate(T),null);if(p!=null)return{p,src:"tekil"};}
  return null;
}
function renderModelSelected(){
  const R=ML.res;if(!R)return;const code=S.code;
  const tgt=R.target==="rel"?"BIST 100 ortalamasından daha iyi getiri sağlama":"yükselme";
  $("mSelLbl").textContent=`${code} · ${R.H} işlem günü`;
  const age=modelAge(R);const r=modelExpired(R)?null:modelProbFor(code);const base=R.metrics.base;
  $("mBaseMark").style.left=(base*100)+"%";
  if(modelExpired(R)){$("mProb").textContent="—";$("mProb").style.color="var(--fg)";$("mProbMark").style.left="50%";
    $("mProbTxt").textContent=`Model ${trDate(R.dataTo)} kapanışına göre eğitildi; ${R.H} işlem günlük tahmin ufku doldu (${age} işlem günü geçti). Güncel tahmin için yeniden eğitin.`;
    S.data.model=null;return;}
  if(!r){$("mProb").textContent="—";$("mProbMark").style.left="50%";
    const lastT=S.data.T&&S.data.T.t[S.data.T.t.length-1];
    $("mProbTxt").textContent=lastT&&lastT>R.dataTo?`Model ${trDate(R.dataTo)} tarihine kadarki veriyle eğitildi. Güncel tahmin için yeniden eğitin.`:"Bu hisse için tahmin üretilemedi (yeterli geçmiş yok).";
    S.data.model=null;return;}
  const p=r.p;$("mProb").textContent="%"+fmt(p*100,0);$("mProb").style.color=p>base+0.05?"var(--up)":p<base-0.05?"var(--down)":"var(--fg)";
  $("mProbMark").style.left=(p*100)+"%";
  $("mProbTxt").textContent=`Model, ${code} için ${age?trDate(R.dataTo)+" kapanışından sonraki":"önümüzdeki"} ${R.H} işlem gününde ${tgt} olasılığını %${fmt(p*100,0)} görüyor. Test dönemindeki baz oran %${fmt(base*100,0)} (dikey çizgi).`+(age?` Tahmin ${age} işlem günü eski; ufkun bir kısmı geçti.`:"")+(r.src==="tekil"?" Hisse BIST 100'de olmadığından tahmin ayrıca hesaplandı.":"");
  const rank=R.preds.findIndex(x=>x.code===code);
  S.data.model={ufukGun:R.H,hedef:R.target==="rel"?"piyasayı yenme":"yükseliş",olasilik:+p.toFixed(3),testBazOrani:+base.toFixed(3),testAUC:+R.metrics.aucG.toFixed(3),lojistikAUC:+R.metrics.aucL.toFixed(3),
    bist100Sirasi:rank>=0?`${rank+1}/${R.preds.length}`:null,enOnemliOzellikler:R.importance.slice(0,5).map(i=>i.n),egitimTarihi:R.dataTo,testDilimleri:R.quint.map(q=>({tahmin:+q.p.toFixed(2),gerceklesen:+q.up.toFixed(2)}))};
}
function renderModel(){
  const R=ML.res;if(!R)return;$("mOut").hidden=false;
  ML.H=R.H;ML.target=R.target;
  document.querySelectorAll("#mH button").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.v)===R.H)));
  document.querySelectorAll("#mT button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.v===R.target)));
  const mAge=modelAge(R);
  $("mStamp").textContent=`Eğitim ${istDateTime(R.trainedAt)} · veri ${trDate(R.dataFrom)} – ${trDate(R.dataTo)}`+(modelExpired(R)?" · tahmin ufku doldu, yeniden eğitin":mAge?` · tahminler ${mAge} işlem günü eski`:"");
  const m=R.metrics;
  $("mAucG").textContent=fmt(m.aucG,3);$("mAucL").textContent=fmt(m.aucL,3);
  $("mAcc").textContent="%"+fmt(m.acc*100,1);$("mAccSub").textContent=`Hep çoğunluğu tahmin etmek: %${fmt(m.majAcc*100,1)}`;
  $("mN").textContent=nf(0).format(R.nSamples);$("mNSub").textContent=`${R.nStocks} hisse · test ${trDate(R.testStart)} sonrası, ${nf(0).format(R.nTest)} örnek · ${m.trees} ağaç`;
  const v=$("mVerdict");
  if(m.aucG>=0.56){v.className="verdict good";v.textContent="Model test döneminde rastgeleden belirgin şekilde iyi ayırt etti. Yine de geçmiş başarı geleceği garanti etmez.";}
  else if(m.aucG>=0.52){v.className="verdict mid";v.textContent="Model rastgeleden biraz iyi; sinyal zayıf. Tek başına karar dayanağı olarak kullanmayın.";}
  else{v.className="verdict bad";v.textContent="Model test döneminde rastgeleye yakın kaldı. Bu ayarla üretilen olasılıkları güvenilir saymayın.";}
  const mx=R.importance[0].v||1;
  $("mImp").innerHTML=R.importance.slice(0,10).map(i=>`<span>${esc(i.n)}</span><span><span class="bar" style="display:block;width:${Math.max(2,i.v/mx*100)}%"></span></span><span class="num r" style="text-align:right">%${fmt(i.v*100,0)}</span>`).join("");
  $("mRetH").textContent=R.target==="rel"?"Piyasaya göre":"Ort. getiri";
  $("mQ").innerHTML=R.quint.map((q,k)=>`<tr><td>${k===0?"En düşük":k===4?"En yüksek":k+1+". dilim"}</td><td class="r num">%${fmt(q.p*100,0)}</td><td class="r num">%${fmt(q.up*100,0)}</td><td class="r num" style="color:${q.ret>0?"var(--up)":q.ret<0?"var(--down)":"inherit"}">${pct(q.ret,2)}</td></tr>`).join("");
  $("mRankSub").textContent=`${trDate(R.dataTo)} kapanışına göre, ${R.H} günlük ${R.target==="rel"?"piyasayı yenme":"yükseliş"} olasılığı`+(modelExpired(R)?" (ufku doldu; güncel değil)":"");
  const li=x=>`<li><button type="button" data-c="${esc(x.code)}">${esc(x.code)}</button><span class="num">%${fmt(x.p*100,0)}</span></li>`;
  $("mTop").innerHTML=R.preds.slice(0,8).map(li).join("");$("mBot").innerHTML=R.preds.slice(-8).reverse().map(li).join("");
  document.querySelectorAll("#mTop button,#mBot button").forEach(b=>b.onclick=()=>{$("q").value=b.dataset.c;load(b.dataset.c);scrollTo({top:0,behavior:"smooth"});});
  $("mTrain").textContent="Yeniden eğit";
  document.querySelectorAll("#mM button").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.v)===(R.months||14))));
  renderBacktest();
  renderModelSelected();
}
function renderBacktest(){
  const R=ML.res;if(!R||!R.bt)return;const B=btCurves(R.bt,ML.cost);
  if(B.n<2){$("btChart").innerHTML=`<div class="skel">Test dönemi bu ufuk için çok kısa (${B.n} dönem). 28 aylık geçmişle ya da 5 günlük ufukla yeniden eğitin.</div>`;$("btStats").innerHTML="";S.data.bt=null;return;}
  const W=640,H=230,pl=44,pr=10,pt=10,pb=24;const pts=B.pts;
  const all=pts.flatMap(p=>[p.t,p.m,p.b]);const lo=Math.min(...all),hi=Math.max(...all);const pad=(hi-lo)*0.08||0.02;const y0=lo-pad,y1=hi+pad;
  const X=k=>pl+k/(pts.length-1)*(W-pl-pr),Y=v=>pt+(y1-v)/(y1-y0)*(H-pt-pb);
  const line=(key,col,w)=>`<polyline fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" points="${pts.map((p,k)=>X(k).toFixed(1)+","+Y(p[key]).toFixed(1)).join(" ")}"/>`;
  let g="";const st=niceStep((y1-y0)/4);for(let v=Math.ceil(y0/st)*st;v<=y1;v+=st){g+=`<line x1="${pl}" x2="${W-pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="var(--line-soft)"/><text x="${pl-6}" y="${Y(v)+3.5}" text-anchor="end" font-size="10" fill="var(--faint)" font-family="IBM Plex Mono,monospace">${pct((v-1)*100,0)}</text>`;}
  const lab=[1,Math.floor(pts.length/2),pts.length-1].filter((v,i,a)=>a.indexOf(v)===i&&pts[v].d).map(k=>`<text x="${X(k)}" y="${H-6}" text-anchor="${k===pts.length-1?"end":"middle"}" font-size="10" fill="var(--faint)" font-family="IBM Plex Mono,monospace">${trDate(pts[k].d)}</text>`).join("");
  const end=(key,col)=>`<circle cx="${X(pts.length-1)}" cy="${Y(pts[pts.length-1][key])}" r="3.5" fill="${col}"/>`;
  $("btChart").innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Geri test getiri eğrileri" style="width:100%;height:auto;display:block">${g}<line x1="${pl}" x2="${W-pr}" y1="${Y(1)}" y2="${Y(1)}" stroke="var(--line)"/>${line("b","var(--down)",1.5)}${line("m","var(--faint)",1.5)}${line("t","var(--accent)",2.5)}${end("t","var(--accent)")}${lab}</svg>`;
  const cell=(l,v,sub,col)=>`<div><div class="lbl">${l}</div><div class="val" style="color:${col||"inherit"}">${v}</div><div class="sub">${sub}</div></div>`;
  const ex=(B.top-B.mkt)*100;
  $("btStats").innerHTML=cell("Model sepeti",pct(B.top*100),`Komisyon sonrası, ${B.n} dönem`,B.top>0?"var(--up)":"var(--down)")+cell("BIST 100 eşit ağırlık",pct(B.mkt*100),"Tüm hisselerin ortalaması")+
    cell("Fark",pct(ex),ex>0?"Model sepeti önde":"Model sepeti geride",ex>0?"var(--up)":"var(--down)")+cell("Piyasayı yendiği dönem","%"+fmt(B.win*100,0),`En kötü düşüş ${pct(B.mdd*100)}`)+cell("En düşük 10 sepeti",pct(B.bot*100),"Kontrol grubu");
  S.data.bt={donem:B.n,ufuk:R.H,modelSepeti:+(B.top*100).toFixed(1),piyasa:+(B.mkt*100).toFixed(1),enDusuk10:+(B.bot*100).toFixed(1),piyasayiYendigiDonemOrani:+(B.win*100).toFixed(0),komisyonYuzde:ML.cost};
}
$("mCost").addEventListener("change",e=>{ML.cost=Number(e.target.value);renderBacktest();});
try{const sv=JSON.parse(localStorage.getItem("hm_model")||"null");if(sv&&sv.v===2&&sv.model){ML.res=sv;}}catch{}

