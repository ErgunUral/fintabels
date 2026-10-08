/* ---------- Takip listesi ---------- */
const W_MAX=100;
const W={list:[],rules:{rsiLo:30,rsiHi:70,sma:true,pHi:60,pLo:40}};
try{const v=JSON.parse(localStorage.getItem("hm_watch")||"null");if(v&&Array.isArray(v.list)){W.list=v.list.filter(c=>/^[A-Z0-9]{3,6}$/.test(c)).slice(0,W_MAX);Object.assign(W.rules,v.rules||{});}}catch{}
const saveW=()=>{try{localStorage.setItem("hm_watch",JSON.stringify(W));}catch{}cloudSave();};
function syncStar(){const on=W.list.includes(S.code);const b=$("watchBtn");b.textContent=on?"Takipten çıkar":"Takibe al";b.setAttribute("aria-pressed",String(on));}
$("watchBtn").onclick=()=>{if(!S.code)return;const i=W.list.indexOf(S.code);if(i>=0)W.list.splice(i,1);else W.list.push(S.code);saveW();syncStar();refreshWatch();};
["wRsiLo","wRsiHi","wPHi","wPLo"].forEach(id=>{const k={wRsiLo:"rsiLo",wRsiHi:"rsiHi",wPHi:"pHi",wPLo:"pLo"}[id];$(id).value=W.rules[k];$(id).addEventListener("change",e=>{const v=Number(e.target.value);if(isFinite(v)){W.rules[k]=v;saveW();refreshWatch(true);}});});
$("wSma").checked=!!W.rules.sma;$("wSma").addEventListener("change",e=>{W.rules.sma=e.target.checked;saveW();refreshWatch(true);});
$("wRefresh").onclick=()=>refreshWatch();
/* toplu içe aktarma */
const trUp=s=>s.replace(/i/g,"İ").replace(/ı/g,"I").toUpperCase().replace(/İ/g,"I").replace(/Ğ/g,"G").replace(/Ü/g,"U").replace(/Ş/g,"S").replace(/Ö/g,"O").replace(/Ç/g,"C");
function parseCodes(txt){const out=[];String(txt||"").split(/[\s,;|\t"'()\[\]]+/).forEach(t=>{let c=trUp(t.trim()).replace(/\.(IS|E|IST)$/,"").replace(/^BIST:|^IST:/,"");if(/^[A-Z][A-Z0-9]{2,5}$/.test(c)&&!out.includes(c))out.push(c);});return out;}
const wImpMsg=(m,cls)=>{const e=$("wImpMsg");e.textContent=m;e.style.color=cls==="err"?"var(--down)":cls==="ok"?"var(--up)":"";};
$("wImpBtn").onclick=()=>{const p=$("wImp");p.hidden=!p.hidden;$("wImpBtn").setAttribute("aria-expanded",String(!p.hidden));if(!p.hidden)$("wImpText").focus();};
$("wImpFile").onchange=async e=>{const f=e.target.files&&e.target.files[0];if(!f)return;try{const t=await f.text();const c=parseCodes(t);$("wImpText").value=c.join(", ");wImpMsg(`${f.name}: ${c.length} olası kod bulundu. Kontrol edip "İçe aktar"a basın.`);}catch{wImpMsg("Dosya okunamadı.","err");}e.target.value="";};
document.querySelectorAll("#wImp [data-idx]").forEach(b=>b.onclick=async()=>{if(!S.mcp){wImpMsg("Fintables bağlantısı bekleniyor.","err");return;}
  b.disabled=true;wImpMsg(`${b.textContent} listesi alınıyor…`);
  try{const r=await sql(`SELECT hisse_senedi_kodu FROM hisse_senetleri WHERE '${b.dataset.idx}' = ANY(endeksler) ORDER BY hisse_senedi_kodu LIMIT 120`,`${b.textContent} hisse listesi`);
    const c=r.map(x=>x.hisse_senedi_kodu).filter(Boolean);$("wImpText").value=c.join(", ");wImpMsg(`${b.textContent}: ${c.length} hisse. "İçe aktar" ile ekleyin.`);}
  catch(e){wImpMsg(errCopy(e),"err");}finally{b.disabled=false;}});
$("wImpGo").onclick=async()=>{const codes=parseCodes($("wImpText").value);if(!codes.length){wImpMsg("Geçerli bir hisse kodu bulunamadı.","err");return;}
  if(!S.mcp){wImpMsg("Fintables bağlantısı bekleniyor.","err");return;}
  const go=$("wImpGo");go.disabled=true;wImpMsg(`${codes.length} kod doğrulanıyor…`);
  try{const ok=new Set();for(let i=0;i<codes.length;i+=250){const r=await sql(`SELECT hisse_senedi_kodu FROM hisse_senetleri WHERE hisse_senedi_kodu IN (${inList(codes.slice(i,i+250))}) LIMIT 300`,"Takip listesi kod doğrulama");r.forEach(x=>ok.add(x.hisse_senedi_kodu));}
    const valid=codes.filter(c=>ok.has(c)),bad=codes.filter(c=>!ok.has(c));
    const replace=document.querySelector('input[name="wImpMode"]:checked').value==="replace";
    const base=replace?[]:W.list.slice();const added=valid.filter(c=>!base.includes(c));let next=base.concat(added);let cut=0;
    if(next.length>W_MAX){cut=next.length-W_MAX;next=next.slice(0,W_MAX);}
    W.list=next;saveW();syncStar();
    const parts=[`${replace?"Liste yenilendi":added.length+" hisse eklendi"} · toplam ${W.list.length}`];
    if(!replace&&valid.length>added.length)parts.push(`${valid.length-added.length} zaten listedeydi`);
    if(bad.length)parts.push(`tanınmayan: ${bad.slice(0,15).join(", ")}${bad.length>15?" …":""}`);
    if(cut)parts.push(`üst sınır ${W_MAX} olduğu için ${cut} hisse alınmadı`);
    wImpMsg(parts.join(" · "),bad.length||cut?"":"ok");if(valid.length)$("wImpText").value=bad.join(", ");
    refreshWatch();}
  catch(e){wImpMsg(errCopy(e),"err");}finally{go.disabled=false;}};
$("wExport").onclick=async()=>{const t=W.list.join(", ");if(!t){wImpMsg("Liste boş.");return;}try{await navigator.clipboard.writeText(t);wImpMsg(`${W.list.length} kod panoya kopyalandı.`,"ok");}catch{$("wImpText").value=t;$("wImpText").select();wImpMsg("Kodlar kutuya yazıldı; Ctrl/Cmd+C ile kopyalayın.");}};
let wClearArm=0;$("wClear").onclick=()=>{if(!W.list.length)return;if(Date.now()-wClearArm>4000){wClearArm=Date.now();$("wClear").textContent="Emin misiniz? Tekrar basın";setTimeout(()=>{$("wClear").textContent="Listeyi temizle";},4000);return;}
  W.list=[];wCache={};saveW();syncStar();$("wClear").textContent="Listeyi temizle";wImpMsg("Liste temizlendi.");refreshWatch();};
let wCache={};
async function refreshWatch(rulesOnly){
  const body=$("wBody");
  if(!W.list.length){body.innerHTML=`<tr><td colspan="8" class="skel">Listeniz boş. Bir hisse açıp "Takibe al"a basın ya da "Toplu içe aktar" ile kod listesi yapıştırın.</td></tr>`;$("wCount").textContent="";return;}
  if(!S.mcp)return;
  if(!rulesOnly){
    body.innerHTML=`<tr><td colspan="8" class="skel">${W.list.length} hisse güncelleniyor…</td></tr>`;
    try{
      const q=await sql(`SELECT hisse_senedi_kodu, son_fiyat, son_fiyat_zaman_utc, gunici_getiri FROM hisse_senetleri WHERE hisse_senedi_kodu IN (${inList(W.list)}) LIMIT 150`,"Takip listesi fiyatları");
      const qm=Object.fromEntries(q.map(r=>[r.hisse_senedi_kodu,r]));
      // 3 hisse / sorgu (~85 işlem günü × 3 < 300 satır): sorgu sayısı üçte birine iner
      const from=new Date(Date.now()-125*864e5);from.setUTCHours(0,0,0,0);const fromLit=from.toISOString().slice(0,19).replace("T"," ");
      const groups=[];for(let i=0;i<W.list.length;i+=3)groups.push(W.list.slice(i,i+3));
      const one=async g=>{const rows=await sql(`SELECT kod, zaman_utc, yuksek, dusuk, kapanis FROM mumlar_gunluk_gh WHERE kod IN (${inList(g)}) AND zaman_utc >= TIMESTAMP '${fromLit}' ORDER BY kod, zaman_utc LIMIT 300`,`Takip listesi göstergeleri: ${g.join(", ")}`);
        g.forEach(code=>{try{
          const R=parseCandles(rows.filter(r=>r.kod===code));if(R.length<20){wCache[code]={err:"Yeterli fiyat geçmişi yok"};return;}
          const A=adjustCorporate({t:R.map(r=>r._d),o:R.map(r=>r.kapanis),h:R.map(r=>r.yuksek),l:R.map(r=>r.dusuk),c:R.map(r=>r.kapanis),v:R.map(()=>0)});
          const c=A.c;const qq=qm[code];if(qq&&qq.son_fiyat&&istDate(qq.son_fiyat_zaman_utc)===A.t[A.t.length-1])c[c.length-1]=qq.son_fiyat;
          const r=rsi(c),s50=sma(c,50),n=c.length-1;
          wCache[code]={p:qq?qq.son_fiyat:c[n],g:qq?qq.gunici_getiri:null,rsi:r[n],above:s50[n]!=null?c[n]>s50[n]:null,cross:s50[n]!=null&&s50[n-1]!=null?(c[n]>s50[n])!==(c[n-1]>s50[n-1]):false};
        }catch(e){wCache[code]={err:"Hesaplanamadı"};}});};
      let gi=0,done=0;const worker=async()=>{while(gi<groups.length){const g=groups[gi++];try{await one(g);}catch(e){g.forEach(code=>wCache[code]={err:errCopy(e)});}done++;if(groups.length>3)body.innerHTML=`<tr><td colspan="8" class="skel">${W.list.length} hisse güncelleniyor… ${done}/${groups.length}</td></tr>`;}};
      await Promise.all(Array.from({length:Math.min(4,groups.length)},worker));
    }catch(e){body.innerHTML=`<tr><td colspan="8"><div class="note err">${esc(errCopy(e))}</div></td></tr>`;return;}
  }
  const R=W.rules;let alarms=0;const wl=[];
  body.innerHTML=W.list.map(code=>{const d=wCache[code]||{};
    const mp=ML.res&&!modelExpired(ML.res)?(ML.res.preds.find(x=>x.code===code)||{}).p:null;
    const al=[];
    if(d.rsi!=null&&d.rsi<=R.rsiLo)al.push(["RSI aşırı satım","pos"]);
    if(d.rsi!=null&&d.rsi>=R.rsiHi)al.push(["RSI aşırı alım","neg"]);
    if(R.sma&&d.cross)al.push([d.above?"SMA50 yukarı kesti":"SMA50 aşağı kesti",d.above?"pos":"neg"]);
    if(mp!=null&&mp*100>=R.pHi)al.push([`Model %${fmt(mp*100,0)}`,"pos"]);
    if(mp!=null&&mp*100<=R.pLo)al.push([`Model %${fmt(mp*100,0)}`,"neg"]);
    alarms+=al.length;wl.push({hisse:code,fiyat:d.p,rsi:d.rsi&&+d.rsi.toFixed(1),alarmlar:al.map(a=>a[0])});
    return `<tr><td><button type="button" class="linkbtn" data-c="${esc(code)}">${esc(code)}</button></td><td class="r num">${fmt(d.p)}</td><td class="r num" style="color:${d.g>0?"var(--up)":d.g<0?"var(--down)":"inherit"}">${pct(d.g,2)}</td><td class="r num">${d.rsi!=null?fmt(d.rsi,1):"—"}</td><td class="r">${d.above==null?"—":d.above?'<span class="pill pos">Üstünde</span>':'<span class="pill neg">Altında</span>'}</td><td class="r num">${mp!=null?"%"+fmt(mp*100,0):"—"}</td><td>${d.err?`<span class="sub">${esc(d.err)}</span>`:al.length?al.map(a=>`<span class="pill ${a[1]}" style="margin:0 4px 4px 0">${esc(a[0])}</span>`).join(""):'<span class="sub">Yok</span>'}</td><td class="r"><button type="button" class="xbtn" data-x="${esc(code)}" aria-label="${esc(code)} takipten çıkar" title="Takipten çıkar">×</button></td></tr>`;}).join("");
  body.querySelectorAll(".linkbtn").forEach(b=>b.onclick=()=>{$("q").value=b.dataset.c;load(b.dataset.c);scrollTo({top:0,behavior:"smooth"});});
  body.querySelectorAll(".xbtn").forEach(b=>b.onclick=()=>{const i=W.list.indexOf(b.dataset.x);if(i>=0){W.list.splice(i,1);delete wCache[b.dataset.x];saveW();syncStar();refreshWatch(true);}});
  $("wCount").textContent=alarms?`${alarms} alarm`:"Alarm yok";$("wCount").className="pill "+(alarms?"warn":"neu");
  S.watch=wl;
  if(P.pos.length)renderPort();
}


