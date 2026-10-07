/* ---------------- SONUÇLAR ---------------- */
const STRAT_NAMES={mom:"Momentum",lowvol:"Düşük oynaklık",value:"Değer",quality:"Kalite",multi:"Çok faktörlü",ml:"Makine öğrenmesi"};
function renderResults(){
  const {R,cfg,picks,tNow,imp}=L.res;const DB=L.DB;const v=ST.view;
  const s=convertSeries(DB,R.months,R.strat,v),e=convertSeries(DB,R.months,R.ew,v),b=convertSeries(DB,R.months,R.bench,v);
  const valid=s.map((x,i)=>isNum(x)&&isNum(e[i])&&isNum(b[i]));const idx=valid.map((ok,i)=>ok?i:-1).filter(i=>i>=0);
  const S=idx.map(i=>s[i]),E=idx.map(i=>e[i]),B=idx.map(i=>b[i]),Mo=idx.map(i=>R.months[i]);
  const mS=metrics(S,E),mE=metrics(E),mB=metrics(B),mSB=metrics(S,B);
  if(!mS){$("resEmpty").hidden=false;$("resBody").hidden=true;$("resEmpty").textContent=v==="real"?"Seçilen dönem için TÜFE verisi yok.":"Sonuç hesaplanamadı.";return;}
  $("resEmpty").hidden=true;$("resBody").hidden=false;
  const unit=v==="real"?"reel":v==="usd"?"USD":"TL";
  const turnY=R.turnover.reduce((a,x)=>a+x,0)/R.turnover.length*12/2;
  const icv=R.ic.filter(isNum);const icM=icv.length?icv.reduce((a,x)=>a+x,0)/icv.length:null;const icT=icv.length>2?icM/(Math.sqrt(icv.reduce((a,x)=>a+(x-icM)**2,0)/(icv.length-1))/Math.sqrt(icv.length)):null;
  const tile=(l,val,sub,col)=>`<div><div class="lbl">${l}</div><div class="val" style="color:${col||"inherit"}">${val}</div><div class="sub">${sub}</div></div>`;
  const c=x=>x>0?"var(--up)":x<0?"var(--down)":"inherit";
  $("kpi").innerHTML=tile(`Yıllık getiri (${unit})`,pct(mS.cagr),`${STRAT_NAMES[cfg.strat]} · maliyet sonrası`)+tile("Eşit ağırlıklı evren",pct(mE.cagr),`İlk ${cfg.N} likit hisse`)+tile("BIST 100",pct(mB.cagr),"Fiyat endeksi")+
    tile("Evrene göre fazla getiri",pct(mS.excessCagr),`t = ${fmt(mS.tstat,2)} · bilgi oranı ${fmt(mS.ir,2)}`,c(mS.excessCagr))+
    tile("En büyük düşüş",pct(mS.mdd),`Evren ${pct(mE.mdd)} · BIST 100 ${pct(mB.mdd)}`)+tile("Oynaklık (yıllık)",pctu(mS.vol),`Evren ${pctu(mE.vol)}`)+
    tile("Evreni yendiği ay",pctu(mS.hit,0),`${mS.n} ayın içinde`)+tile("Yıllık devir",pctu(turnY,0),`Ortalama IC ${fmt(icM,3)}`);
  const vd=$("verdict");const t=mS.tstat;
  if(t>=2&&mS.excessCagr>0){vd.className="verdict good";vd.textContent=`Strateji, maliyetler düşüldükten sonra eşit ağırlıklı evreni yılda ${pct(mS.excessCagr)} geçti ve fark istatistiksel olarak anlamlı (t = ${fmt(t,2)} ≥ 2). Birden çok strateji ve ayar denediyseniz bu eşik tek başına yeterli değildir; en iyi sonucu seçmek şansı da seçer (t ≥ 3 daha güvenli bir çıtadır). Geçmiş performans geleceği garanti etmez; duyarlılık analiziyle sonucun tek bir ayara bağlı olmadığını kontrol edin.`;}
  else if(t>=1&&mS.excessCagr>0){vd.className="verdict mid";vd.textContent=`Strateji evreni yılda ${pct(mS.excessCagr)} geçti, ancak fark istatistiksel olarak zayıf (t = ${fmt(t,2)}). Bu kadar dönemde şansla da ortaya çıkabilecek bir sonuç.`;}
  else{vd.className="verdict bad";vd.textContent=`Strateji, maliyetler düşüldükten sonra eşit ağırlıklı evrene karşı anlamlı bir üstünlük göstermedi (fark ${pct(mS.excessCagr)}, t = ${fmt(t,2)}).`;}
  const cum=a=>{let q=1;return a.map(x=>q*=1+x);};const dd=a=>{let q=1,pk=1;return a.map(x=>{q*=1+x;pk=Math.max(pk,q);return q/pk-1;});};
  $("eqSub").textContent=`${mLabel(Mo[0])} – ${mLabel(Mo[Mo.length-1])} · ${unit} · strateji ${fmt(cum(S).pop(),2)}× · evren ${fmt(cum(E).pop(),2)}× · BIST 100 ${fmt(cum(B).pop(),2)}×`;
  const lastM=R.months[R.months.length-1];
  if(Mo[Mo.length-1]<lastM)$("eqSub").textContent+=` · ${v==="real"?"TÜFE":v==="usd"?"kur":"kıyas"} verisi ${mLabel(Mo[Mo.length-1])} sonrasında olmadığı için ${mLabel(lastM)} tarihine kadarki aylar hesaba dahil değil`;
  lineChart($("eqChart"),Mo,[{data:cum(B),color:"var(--s3)"},{data:cum(E),color:"var(--s2)"},{data:cum(S),color:"var(--s1)",w:2.4}],{log:true,h:280});
  lineChart($("ddChart"),Mo,[{data:dd(E),color:"var(--s2)"},{data:dd(S),color:"var(--s1)"}],{h:140,area:true,fmtY:v=>pct(v,0)});
  const yS=yearly(Mo,S),yE=yearly(Mo,E),yB=yearly(Mo,B);
  $("yrBody").innerHTML=Object.keys(yS).sort().reverse().map(y=>{const d=yS[y]-yE[y];const part=Mo.filter(m=>m.startsWith(y)).length;return`<tr><td>${y}${part<12?` <span class="sub">(${part} ay)</span>`:""}</td><td class="r num" style="color:${c(yS[y])}">${pct(yS[y])}</td><td class="r num">${pct(yE[y])}</td><td class="r num">${pct(yB[y])}</td><td class="r num" style="color:${c(d)}">${pct(d)}</td></tr>`;}).join("");
  // bugünkü portföy
  $("curTitle").textContent=`Bugünkü portföy · ${STRAT_NAMES[cfg.strat]}`;
  $("curSub").textContent=`${mLabel(DB.months[tNow])}${DB.stale?" (son indirme anındaki fiyatlar; veri güncel değil)":" (ay içi son fiyatlar)"} verisine göre ilk ${cfg.K} hisse, eşit ağırlık. Yatırım tavsiyesi değildir.`;
  $("curBody").innerHTML=picks.map((p,i)=>{const f=p.f;const pe=f.ep>0?1/f.ep:null;return`<tr><td class="num">${i+1}</td><td class="num"><b>${esc(p.c)}</b></td><td class="r num" style="color:${c(f.mom)}">${pct(f.mom,0)}</td><td class="r num">${f.vol!=null?pctu(f.vol,0):"—"}</td><td class="r num">${pe?fmt(pe,1):f.ep!=null?"Zarar":"—"}</td><td class="r num">${f.roe!=null?pctu(f.roe,0):"—"}</td></tr>`;}).join("")||`<tr><td colspan="6" class="sub">Bu ay için skor üretilemedi.</td></tr>`;
  // ek ölçümler
  const icPos=icv.filter(x=>x>0).length/(icv.length||1);
  let ex=`<table><tbody>
    <tr><td>BIST 100'e göre fazla getiri</td><td class="r num">${pct(mSB.excessCagr)} <span class="sub">(t ${fmt(mSB.tstat,2)})</span></td></tr>
    <tr><td>Takip hatası (evrene göre)</td><td class="r num">${pctu(mS.te)}</td></tr>
    <tr><td>Toplam getiri</td><td class="r num">${pct(mS.total,0)}</td></tr>
    <tr><td>Ortalama bilgi katsayısı (IC)</td><td class="r num">${fmt(icM,3)} <span class="sub">(t ${fmt(icT,2)}, pozitif ay %${fmt(icPos*100,0)})</span></td></tr>
    <tr><td>Ortalama evren büyüklüğü</td><td class="r num">${fmt(R.nUniv.reduce((a,x)=>a+x,0)/R.nUniv.length,0)}</td></tr>
    <tr><td>Maliyet varsayımı</td><td class="r num">%${fmt(cfg.cost*100,2)} / işlem</td></tr></tbody></table>`;
  if(imp&&imp.length){const last=imp[imp.length-1];const tot=last.imp.reduce((a,b)=>a+b,0)||1;const top=ML_FEATS.map((k,i)=>({k,v:last.imp[i]/tot})).sort((a,b)=>b.v-a.v).slice(0,6);
    ex+=`<h3 style="margin-top:12px">Model: en etkili özellikler (${last.year} eğitimi, ${nf(0).format(last.n)} örnek)</h3><table><tbody>${top.map(x=>`<tr><td>${esc(FACTORS[x.k].n)}</td><td class="r num">%${fmt(x.v*100,0)}</td></tr>`).join("")}</tbody></table><p class="sub">Model ${imp.length} kez, her yıl başında yalnızca o tarihe kadar kesinleşmiş verilerle yeniden eğitildi.</p>`;}
  $("extra").innerHTML=ex;
  $("sensRun").disabled=cfg.strat==="ml";
  L.summary={strateji:STRAT_NAMES[cfg.strat],agirliklar:cfg.strat==="multi"?cfg.wts:PRESETS[cfg.strat]||"model",evren:cfg.N,hisseSayisi:cfg.K,dengelemeAy:cfg.R,maliyetIslemBasina:cfg.cost,donem:`${Mo[0]} – ${Mo[Mo.length-1]}`,birim:unit,
    strateji_cagr:+(mS.cagr*100).toFixed(1),evren_cagr:+(mE.cagr*100).toFixed(1),bist100_cagr:+(mB.cagr*100).toFixed(1),fazla_getiri_evren:+(mS.excessCagr*100).toFixed(1),t_istatistigi:+(t||0).toFixed(2),bilgi_orani:+(mS.ir||0).toFixed(2),
    en_buyuk_dusus:+(mS.mdd*100).toFixed(1),evren_en_buyuk_dusus:+(mE.mdd*100).toFixed(1),oynaklik:+(mS.vol*100).toFixed(1),aylik_isabet:+(mS.hit*100).toFixed(0),yillik_devir:+(turnY*100).toFixed(0),ortalama_IC:icM&&+icM.toFixed(3),
    yillik:Object.fromEntries(Object.keys(yS).map(y=>[y,{strateji:+(yS[y]*100).toFixed(1),evren:+(yE[y]*100).toFixed(1),bist100:+(yB[y]*100).toFixed(1)}])),duyarlilik:L.sens||null};
}

/* duyarlılık: K × maliyet */
$("sensRun").onclick=async()=>{
  if(!L.res||L.busy||L.res.cfg.strat==="ml")return;L.busy=true;$("sensRun").disabled=true;const DB=L.DB;const cfg=L.res.cfg;
  const Ks=[5,10,20,30],Cs=[0.001,0.0025,0.005,0.01];const tbl=$("sensTbl");
  tbl.innerHTML=`<thead><tr><th>Hisse \\ maliyet</th>${Cs.map(x=>`<th class="r">%${fmt(x*100,2)}</th>`).join("")}</tr></thead><tbody></tbody>`;
  const sc=makeScorer(DB,cfg.strat,cfg.N,cfg.wts);const cache=new Map();const sc2=t=>{if(!cache.has(t))cache.set(t,sc(t));return cache.get(t);};
  const out=[];
  for(const K of Ks){const row=[];for(const C of Cs){await tick();const R=runBacktest(DB,{N:cfg.N,K,rebal:cfg.R,cost:C,start:cfg.start,end:cfg.end,scorer:sc2});
      const s=convertSeries(DB,R.months,R.strat,ST.view),e=convertSeries(DB,R.months,R.ew,ST.view);const ok=s.map((x,i)=>isNum(x)&&isNum(e[i]));
      const m=metrics(s.filter((_,i)=>ok[i]),e.filter((_,i)=>ok[i]));row.push(m);}
    out.push({K,row});
    tbl.querySelector("tbody").insertAdjacentHTML("beforeend",`<tr><td class="num">${K}</td>${row.map(m=>{const col=m.tstat>=2?"var(--up-soft)":m.tstat>=1?"var(--warn-soft)":m.excessCagr<0?"var(--down-soft)":"transparent";return`<td style="background:${col}">${pct(m.excessCagr)}<div class="sub">t ${fmt(m.tstat,1)}</div></td>`;}).join("")}</tr>`);}
  L.sens=out.map(o=>({hisse:o.K,sonuclar:o.row.map((m,i)=>({maliyet:Cs[i],fazla:+(m.excessCagr*100).toFixed(1),t:+m.tstat.toFixed(2)}))}));
  if(L.summary)L.summary.duyarlilik=L.sens;
  L.busy=false;$("sensRun").disabled=false;};

/* yapay zeka yorumu */
function mdRender(t){const lines=String(t).split("\n");let h="",ul=false;const inl=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>");
  for(const raw of lines){const l=raw.trimEnd();const li=l.match(/^\s*[-*•]\s+(.*)/);if(li){if(!ul){h+="<ul>";ul=true;}h+=`<li>${inl(li[1])}</li>`;continue;}if(ul){h+="</ul>";ul=false;}
    const hd=l.match(/^#{1,4}\s+(.*)/);if(hd){h+=`<h4>${inl(hd[1])}</h4>`;continue;}if(l.trim())h+=`<p>${inl(l)}</p>`;}if(ul)h+="</ul>";return h;}
$("aiRun").onclick=async()=>{
  if(!L.sample||!L.summary)return;const out=$("aiOut");$("aiRun").disabled=true;out.innerHTML=`<div class="thinking"><span class="dot"></span>Sonuçlar değerlendiriliyor…</div>`;
  const prompt=`Sen nicel yatırım stratejileri konusunda deneyimli, şüpheci bir analistsin. Aşağıda Borsa İstanbul üzerinde yapılmış bir geri testin sonuçları var. Türkçe, sade yaz. Yalnızca verilen rakamlara dayan, uydurma.
Veri sınırlamaları: Fintables verisinde borsadan çıkmış hisseler yok (hayatta kalma yanlılığı); BIST 100 temettü hariç fiyat endeksidir; piyasa değeri bugünkü pay sayısıyla yaklaşık hesaplanır; 2023 sonrası finansallar enflasyon muhasebesine göredir.
Şu başlıkları "### " ile kullan:
### Özet (2-3 cümle)
### İstatistiksel güvenilirlik (t-istatistiği, IC, isabet oranı, dönem uzunluğu; şans ihtimali)
### Riskler (düşüş, oynaklık, devir ve maliyet etkisi, hangi yıllarda zayıf kaldığı)
### Duyarlılık (varsa: sonuç ayarlara ne kadar bağlı)
### Gerçek hayata uygulanabilirlik (likidite, vergi/komisyon, uygulama disiplini)
### İyileştirme önerileri (3-5 somut test önerisi)
Toplam 300-450 kelime. Al/sat tavsiyesi verme.
SONUÇLAR (JSON):
${JSON.stringify(L.summary)}`;
  try{const r=await L.sample(prompt,{onText:({text})=>{out.innerHTML=mdRender(text);}});out.innerHTML=mdRender(r.text);}
  catch(e){out.innerHTML=`<p class="sub">${e&&e.code==="not_granted"?"Yapay zeka kullanımına izin verilmedi.":e&&e.code==="rate_limited"?"Kullanım sınırına ulaşıldı; biraz sonra deneyin.":"Yorum oluşturulamadı."}</p>`;}
  finally{$("aiRun").disabled=false;}};

