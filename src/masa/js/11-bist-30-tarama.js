/* ---------- BIST 30 tarama ---------- */
const SC={rows:[],sort:{k:"score",dir:-1},busy:false,at:null};
async function runScan(){
  if(SC.busy||!S.mcp)return;SC.busy=true;$("scRun").disabled=true;
  const prog=$("scProg");prog.hidden=false;prog.firstElementChild.style.width="0%";
  try{
    $("scStatus").textContent="BIST 30 listesi alınıyor…";
    const uni=await sql(`SELECT hisse_senedi_kodu, unvan, son_fiyat, son_fiyat_zaman_utc, gunici_getiri FROM hisse_senetleri WHERE 'XU030' = ANY(endeksler) ORDER BY hisse_senedi_kodu LIMIT 40`,"BIST 30 anlık fiyatlar");
    const list=uni.filter(r=>/^[A-Z0-9]{3,6}$/.test(r.hisse_senedi_kodu));const queue=list.slice();const out=[];let done=0,fatal=null;
    const worker=async()=>{while(queue.length&&!fatal){const q=queue.shift();const code=q.hisse_senedi_kodu;
      try{const rows=await sql(`SELECT zaman_utc, acilis, yuksek, dusuk, kapanis, hacim_15_dk_gecikmeli FROM mumlar_gunluk_gh WHERE kod = '${code}' AND zaman_utc >= TIMESTAMP '2024-01-01 00:00:00' ORDER BY zaman_utc DESC LIMIT 300`,`${code} tarama için fiyat geçmişi`);
        rows.reverse();const T=buildT(rows,q);
        if(T){const C=computeSignals(T);const i=T.c.length-1,c=T.c;const ret=n=>i>=n?(c[i]/c[i-n]-1)*100:null;
          out.push({code,name:q.unvan,p:c[i],g:q.gunici_getiri,r21:ret(21),r63:ret(63),rsi:T.rsi[i],macdUp:T.mac.m[i]!=null&&T.mac.sig[i]!=null?T.mac.m[i]>T.mac.sig[i]:null,
            s50:T.s50[i]!=null?(c[i]/T.s50[i]-1)*100:null,s200:T.s200[i]!=null?(c[i]/T.s200[i]-1)*100:null,score:C.norm,label:C.label,adj:T.adj||0});}
      }catch(e){if(isFatal(e))fatal=e;}
      done++;prog.firstElementChild.style.width=Math.round(done/list.length*100)+"%";$("scStatus").textContent=`Göstergeler hesaplanıyor: ${done} / ${list.length}`;}};
    await Promise.all(Array.from({length:6},worker));
    if(fatal)throw fatal;
    SC.rows=out;SC.at=new Date().toISOString();renderScan();
    const miss=list.length-out.length;
    $("scStatus").textContent=`${out.length} hisse tarandı · ${istDateTime(SC.at)}`+(miss?` · ${miss} hissenin verisi alınamadı`:"")+(out.some(r=>r.adj)?" · bölünme/bedelsiz düzeltmesi uygulanan hisseler var":"");
  }catch(e){$("scStatus").textContent=errCopy(e);}
  finally{SC.busy=false;$("scRun").disabled=false;$("scRun").textContent="Yenile";prog.hidden=true;}
}
function renderScan(){
  const rows=SC.rows.map(r=>({...r,model:ML.res&&!modelExpired(ML.res)?((ML.res.preds.find(x=>x.code===r.code)||{}).p??null):null}));
  const {k,dir}=SC.sort;rows.sort((a,b)=>{const x=a[k],y=b[k];if(x==null&&y==null)return 0;if(x==null)return 1;if(y==null)return -1;return (typeof x==="string"?x.localeCompare(y,"tr"):x-y)*dir;});
  document.querySelectorAll("#scTable th[data-k]").forEach(th=>{th.setAttribute("aria-sort",th.dataset.k===k?(dir>0?"ascending":"descending"):"none");});
  const col=v=>v>0?"var(--up)":v<0?"var(--down)":"inherit";
  $("scBody").innerHTML=rows.map(r=>`<tr><td><button type="button" class="linkbtn" data-c="${esc(r.code)}">${esc(r.code)}</button></td><td class="r num">${fmt(r.p)}</td><td class="r num" style="color:${col(r.g)}">${pct(r.g,2)}</td><td class="r num" style="color:${col(r.r21)}">${pct(r.r21)}</td><td class="r num" style="color:${col(r.r63)}">${pct(r.r63)}</td>
    <td class="r num" style="color:${r.rsi<30?"var(--up)":r.rsi>70?"var(--down)":"inherit"}">${r.rsi!=null?fmt(r.rsi,1):"—"}</td><td class="r">${r.macdUp==null?"—":r.macdUp?'<span class="pill pos">Yukarı</span>':'<span class="pill neg">Aşağı</span>'}</td>
    <td class="r num" style="color:${col(r.s50)}">${pct(r.s50)}</td><td class="r num" style="color:${col(r.s200)}">${pct(r.s200)}</td>
    <td class="r"><span class="pill ${r.score>=0.15?"pos":r.score<=-0.15?"neg":"neu"}">${esc(r.label)}</span></td><td class="r num">${r.model!=null?"%"+fmt(r.model*100,0):"—"}</td></tr>`).join("");
  $("scBody").querySelectorAll(".linkbtn").forEach(b=>b.onclick=()=>{$("q").value=b.dataset.c;load(b.dataset.c);scrollTo({top:0,behavior:"smooth"});});
  const n=rows.length||1,cnt=f=>rows.filter(f).length;
  const a50=cnt(r=>r.s50>0),a200=cnt(r=>r.s200>0),pos=cnt(r=>r.score>=0.15),neg=cnt(r=>r.score<=-0.15);
  $("scSum").innerHTML=`<div><div class="lbl">SMA50 üstünde</div><div class="val">%${fmt(a50/n*100,0)}</div><div class="sub">${a50} / ${rows.length} hisse</div></div><div><div class="lbl">SMA200 üstünde</div><div class="val">%${fmt(a200/n*100,0)}</div><div class="sub">${a200} / ${rows.length} hisse</div></div><div><div class="lbl">Teknik görünüm</div><div class="val"><span style="color:var(--up)">${pos}</span> / ${rows.length-pos-neg} / <span style="color:var(--down)">${neg}</span></div><div class="sub">Pozitif / nötr / negatif</div></div><div><div class="lbl">Ortalama 1 ay getiri</div><div class="val">${pct(rows.reduce((s,r)=>s+(r.r21||0),0)/n)}</div><div class="sub">Eşit ağırlıklı</div></div>`;
  S.scan={hisseSayisi:rows.length,sma50UstundeYuzde:Math.round(a50/n*100),sma200UstundeYuzde:Math.round(a200/n*100),pozitif:pos,negatif:neg};
}
document.querySelectorAll("#scTable th[data-k]").forEach(th=>th.onclick=()=>{const k=th.dataset.k;SC.sort={k,dir:SC.sort.k===k?-SC.sort.dir:(k==="code"?1:-1)};if(SC.rows.length)renderScan();});
$("scRun").onclick=runScan;

