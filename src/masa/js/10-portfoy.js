/* ---------- Portföy ---------- */
const pctW=(v,d=1)=>v==null||!isFinite(v)?"—":"%"+nf(d).format(v*100);
const pctF=(v,d=1)=>v==null||!isFinite(v)?"—":pct(v*100,d);
const P={pos:[],q:{},sort:{k:"v",dir:-1},at:null};
try{const v=JSON.parse(localStorage.getItem("hm_port")||"null");if(v&&Array.isArray(v.pos))P.pos=v.pos.filter(x=>x&&/^[A-Z0-9]{3,6}$/.test(x.c)&&x.q>0);}catch{}
const saveP=()=>{try{localStorage.setItem("hm_port",JSON.stringify({pos:P.pos}));}catch{}cloudSave();};
function trNum(t){t=String(t||"").trim().replace(/[₺%\s]|TL/gi,"");if(!t)return NaN;
  if(/,/.test(t))t=t.replace(/\./g,"").replace(",",".");else if(/^\d{1,3}(\.\d{3})+$/.test(t))t=t.replace(/\./g,"");
  const v=Number(t);return isFinite(v)?v:NaN;}
function parsePositions(txt){const lines=String(txt||"").split(/\r?\n/).map(l=>l.trim()).filter(Boolean);const out=[],bad=[];let qi=-1,mi=-1;
  const split=l=>l.includes("\t")?l.split("\t"):l.includes(";")?l.split(";"):l.split(/\s+/);
  for(const l of lines){const cells=split(l).map(x=>x.trim());const low=cells.map(x=>x.toLocaleLowerCase("tr"));
    if(low.some(x=>x.startsWith("adet"))&&low.some(x=>x.startsWith("maliyet"))){qi=low.findIndex(x=>x.startsWith("adet"));mi=low.findIndex(x=>x.startsWith("maliyet"));continue;}
    const ci=cells.findIndex(x=>/^[A-Z][A-Z0-9]{2,5}$/.test(trUp(x).replace(/\.(IS|E)$/,"")));if(ci<0){if(/\d/.test(l))bad.push(l.slice(0,30));continue;}
    const c=trUp(cells[ci]).replace(/\.(IS|E)$/,"");let q,m;
    if(qi>=0&&mi>=0&&cells.length>Math.max(qi,mi)){q=trNum(cells[qi]);m=trNum(cells[mi]);}
    else{const nums=cells.slice(ci+1).map(trNum).filter(v=>!isNaN(v));q=nums[0];m=nums[1];}
    if(!(q>0)||!(m>0)){bad.push(c);continue;}
    const ex=out.find(x=>x.c===c);if(ex){const tq=ex.q+q;ex.m=(ex.m*ex.q+m*q)/tq;ex.q=tq;}else out.push({c,q,m});}
  return{out,bad};}
const pMsg=(m,cls)=>{const e=$("pImpMsg");e.textContent=m;e.style.color=cls==="err"?"var(--down)":cls==="ok"?"var(--up)":"";};
$("pImpBtn").onclick=()=>{const x=$("pImp");x.hidden=!x.hidden;$("pImpBtn").setAttribute("aria-expanded",String(!x.hidden));if(!x.hidden)$("pImpText").focus();};
$("pRefresh").onclick=()=>refreshPort();
$("pImpGo").onclick=async()=>{const {out,bad}=parsePositions($("pImpText").value);if(!out.length){pMsg("Geçerli satır bulunamadı. Biçim: KOD ADET MALİYET","err");return;}
  if(!S.mcp){pMsg("Fintables bağlantısı bekleniyor.","err");return;}
  const go=$("pImpGo");go.disabled=true;pMsg(`${out.length} pozisyon doğrulanıyor…`);
  try{const r=await sql(`SELECT hisse_senedi_kodu FROM hisse_senetleri WHERE hisse_senedi_kodu IN (${inList(out.map(x=>x.c))}) LIMIT 300`,"Portföy kod doğrulama");const ok=new Set(r.map(x=>x.hisse_senedi_kodu));
    const valid=out.filter(x=>ok.has(x.c)),unk=out.filter(x=>!ok.has(x.c)).map(x=>x.c);
    const merge=document.querySelector('input[name="pImpMode"]:checked').value==="merge";
    if(merge){valid.forEach(v=>{const i=P.pos.findIndex(x=>x.c===v.c);if(i>=0)P.pos[i]=v;else P.pos.push(v);});}else P.pos=valid;
    saveP();const parts=[`${valid.length} pozisyon ${merge?"eklendi/güncellendi":"yüklendi"} · toplam ${P.pos.length}`];
    if(unk.length)parts.push(`tanınmayan kod: ${unk.join(", ")}`);if(bad.length)parts.push(`okunamayan satır: ${bad.slice(0,8).join(", ")}${bad.length>8?" …":""}`);
    pMsg(parts.join(" · "),unk.length||bad.length?"":"ok");refreshPort();}
  catch(e){pMsg(errCopy(e),"err");}finally{go.disabled=false;}};
$("pToWatch").onclick=()=>{const add=P.pos.map(x=>x.c).filter(c=>!W.list.includes(c));const room=Math.max(0,W_MAX-W.list.length);W.list=W.list.concat(add.slice(0,room));saveW();syncStar();
  pMsg(`${Math.min(add.length,room)} kod takip listesine eklendi${add.length>room?` (${add.length-room} tanesi üst sınır nedeniyle alınmadı)`:""}. Teknik sütunu takip listesi güncellenince dolar.`,"ok");refreshWatch();};
$("pExport").onclick=async()=>{if(!P.pos.length){pMsg("Portföy boş.");return;}const t=P.pos.map(x=>`${x.c}\t${nf(0).format(x.q).replace(/\./g,"")}\t${fmt(x.m)}`).join("\n");
  try{await navigator.clipboard.writeText(t);pMsg(`${P.pos.length} pozisyon panoya kopyalandı.`,"ok");}catch{$("pImpText").value=t;$("pImpText").select();pMsg("Pozisyonlar kutuya yazıldı; Ctrl/Cmd+C ile kopyalayın.");}};
let pClearArm=0;$("pClear").onclick=()=>{if(!P.pos.length)return;if(Date.now()-pClearArm>4000){pClearArm=Date.now();$("pClear").textContent="Emin misiniz? Tekrar basın";setTimeout(()=>{$("pClear").textContent="Portföyü temizle";},4000);return;}
  P.pos=[];P.q={};saveP();$("pClear").textContent="Portföyü temizle";pMsg("Portföy temizlendi.");renderPort();};
document.querySelectorAll("#pTable th[data-k]").forEach(th=>th.onclick=()=>{const k=th.dataset.k;P.sort=P.sort.k===k?{k,dir:-P.sort.dir}:{k,dir:k==="c"?1:-1};renderPort();});
async function refreshPort(){
  if(!P.pos.length){renderPort();return;}if(!S.mcp)return;
  $("pBody").innerHTML=`<tr><td colspan="11" class="skel">${P.pos.length} pozisyon güncelleniyor…</td></tr>`;
  try{const r=await sql(`SELECT hisse_senedi_kodu, son_fiyat, son_fiyat_zaman_utc, gunici_getiri FROM hisse_senetleri WHERE hisse_senedi_kodu IN (${inList(P.pos.map(x=>x.c))}) LIMIT 300`,"Portföy fiyatları");
    P.q=Object.fromEntries(r.map(x=>[x.hisse_senedi_kodu,x]));P.at=r.map(x=>x.son_fiyat_zaman_utc).filter(Boolean).sort().pop()||null;renderPort();}
  catch(e){$("pBody").innerHTML=`<tr><td colspan="11"><div class="note err">${esc(errCopy(e))}</div></td></tr>`;}}
function renderPort(){
  const body=$("pBody"),kpi=$("pKpi");
  if(!P.pos.length){body.innerHTML=`<tr><td colspan="11" class="skel">Portföy boş. "Toplu içe aktar" ile KOD ADET MALİYET satırlarını yapıştırın.</td></tr>`;kpi.innerHTML="";$("pCount").textContent="";body.parentElement.querySelector("tfoot")?.remove();return;}
  const rows=P.pos.map(x=>{const q=P.q[x.c]||{};const p=q.son_fiyat>0?q.son_fiyat:null;const g=q.gunici_getiri!=null?Number(q.gunici_getiri):null;
    const cost=x.q*x.m,v=p!=null?x.q*p:null,pl=v!=null?v-cost:null;const dayPl=v!=null&&g!=null?v-v/(1+g/100):null;
    return{...x,p,g,cost,v,pl,plp:pl!=null?pl/cost:null,dayPl};});
  const totV=rows.reduce((a,r)=>a+(r.v||0),0),totC=rows.reduce((a,r)=>a+(r.v!=null?r.cost:0),0),totD=rows.reduce((a,r)=>a+(r.dayPl||0),0);
  rows.forEach(r=>r.w=r.v!=null&&totV>0?r.v/totV:null);
  const {k,dir}=P.sort;rows.sort((a,b)=>{const A=a[k],B=b[k];if(A==null)return 1;if(B==null)return -1;return(typeof A==="string"?A.localeCompare(B,"tr"):A-B)*dir;});
  document.querySelectorAll("#pTable th[data-k]").forEach(th=>{th.textContent=th.textContent.replace(/ [▲▼]$/,"")+(th.dataset.k===k?(dir>0?" ▲":" ▼"):"");});
  const col=v=>v>0?"var(--up)":v<0?"var(--down)":"inherit";const maxW=Math.max(...rows.map(r=>r.w||0),0.0001);
  const tl=v=>v==null?"—":fmt(v)+" ₺";
  body.innerHTML=rows.map(r=>{const d=wCache[r.c];let tech='<span class="sub">—</span>';
    if(d&&!d.err){const al=[];if(d.rsi!=null&&d.rsi<=W.rules.rsiLo)al.push(["RSI "+fmt(d.rsi,0),"pos"]);if(d.rsi!=null&&d.rsi>=W.rules.rsiHi)al.push(["RSI "+fmt(d.rsi,0),"neg"]);if(W.rules.sma&&d.cross)al.push([d.above?"SMA50 ↑":"SMA50 ↓",d.above?"pos":"neg"]);
      tech=al.length?al.map(a=>`<span class="pill ${a[1]}" style="margin:0 4px 4px 0">${esc(a[0])}</span>`).join(""):`<span class="sub">RSI ${d.rsi!=null?fmt(d.rsi,0):"—"} · ${d.above==null?"":d.above?"SMA50 üstü":"SMA50 altı"}</span>`;}
    return `<tr><td><button type="button" class="linkbtn" data-c="${esc(r.c)}">${esc(r.c)}</button></td><td class="r num">${fmt(r.q,0)}</td><td class="r num">${fmt(r.m)}</td><td class="r num">${r.p!=null?fmt(r.p):"—"}</td><td class="r num" style="color:${col(r.g)}">${r.g!=null?pct(r.g,2):"—"}</td><td class="r num">${tl(r.v)}</td><td class="r num" style="color:${col(r.pl)}">${r.pl!=null?fmt(r.pl):"—"}</td><td class="r num" style="color:${col(r.plp)}">${pctF(r.plp,1)}</td><td class="r num">${r.w!=null?pctW(r.w,1):"—"}<span class="wbar" style="width:${r.w!=null?Math.round(36*r.w/maxW):0}px"></span></td><td>${tech}</td><td class="r"><button type="button" class="xbtn" data-x="${esc(r.c)}" aria-label="${esc(r.c)} portföyden çıkar" title="Portföyden çıkar">×</button></td></tr>`;}).join("");
  let tf=body.parentElement.querySelector("tfoot");if(!tf){tf=document.createElement("tfoot");body.parentElement.appendChild(tf);}
  const totPl=totV-totC;tf.innerHTML=`<tr><td>Toplam (${rows.length})</td><td></td><td class="r num">${tl(totC)}</td><td></td><td class="r num" style="color:${col(totD)}">${fmt(totD)}</td><td class="r num">${tl(totV)}</td><td class="r num" style="color:${col(totPl)}">${fmt(totPl)}</td><td class="r num" style="color:${col(totPl)}">${pctF(totC?totPl/totC:null,1)}</td><td class="r num">%100</td><td></td><td></td></tr>`;
  const win=rows.filter(r=>r.pl>0).length,lose=rows.filter(r=>r.pl<0).length;const top=rows.filter(r=>r.w!=null).sort((a,b)=>b.w-a.w).slice(0,3);
  const tile=(l,v,c)=>`<div class="pk"><div class="l">${l}</div><div class="v" style="color:${c||"inherit"}">${v}</div></div>`;
  kpi.innerHTML=tile("Piyasa değeri",tl(totV))+tile("Maliyet",tl(totC))+tile("Toplam K/Z",`${fmt(totPl)} ₺ · ${pctF(totC?totPl/totC:null,1)}`,col(totPl))+tile("Bugün",`${fmt(totD)} ₺ · ${pctF(totV-totD?totD/(totV-totD):null,2)}`,col(totD))+tile("Kârda / zararda",`${win} / ${lose}`)+tile("En büyük 3 ağırlık",top.length?pctW(top.reduce((a,r)=>a+r.w,0),0)+` <span class="sub" style="font-size:.78rem">${top.map(r=>r.c).join(", ")}</span>`:"—");
  $("pCount").textContent=P.at?`Fiyat: ${istDateTime(P.at)}`:"";$("pCount").className="pill neu";
  body.querySelectorAll(".linkbtn").forEach(b=>b.onclick=()=>{$("q").value=b.dataset.c;load(b.dataset.c);scrollTo({top:0,behavior:"smooth"});});
  body.querySelectorAll(".xbtn").forEach(b=>b.onclick=()=>{P.pos=P.pos.filter(x=>x.c!==b.dataset.x);saveP();renderPort();});
  S.port=rows.map(r=>({hisse:r.c,adet:r.q,maliyet:r.m,fiyat:r.p,kz_yuzde:r.plp!=null?+(r.plp*100).toFixed(1):null,agirlik:r.w!=null?+(r.w*100).toFixed(1):null}));
}

