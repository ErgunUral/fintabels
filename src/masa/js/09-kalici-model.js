/* ---------- Kalıcı (önceden eğitilmiş) model ---------- */
/* model ağırlıkları ayrı dosyada (88 KB, tek satır); derleme buraya gömer */
const FZ=
//@include masa/data/kalici-model.json
;
const FZS={mk:null,mkDay:null,pending:null};
function fzPredict(x){let p=0;for(const m of FZ.models){let z=m.b;for(const t of m.t){let n=t;while(Array.isArray(n))n=x[n[0]]<=n[1]?n[2]:n[3];z+=n;}p+=1/(1+Math.exp(-z));}return p/FZ.models.length;}
function fzPct(p){const q=FZ.q;if(p<=q[0])return 0;if(p>=q[q.length-1])return 100;for(let k=1;k<q.length;k++)if(p<=q[k])return((k-1)+(p-q[k-1])/Math.max(1e-9,q[k]-q[k-1]))*5;return 100;}
async function fzMarket(){
  const today=istDate(new Date().toISOString());if(FZS.mk&&FZS.mkDay===today)return FZS.mk;
  if(FZS.pending)return FZS.pending;
  FZS.pending=(async()=>{const from=new Date(Date.now()-420*864e5).toISOString().slice(0,10)+" 00:00:00";
    const rows=await sql(`SELECT zaman_utc, kapanis FROM endeks_mumlar_gunluk_gh WHERE kod = 'XU100' AND zaman_utc >= TIMESTAMP '${from}' ORDER BY zaman_utc DESC LIMIT 300`,"Kalıcı model için BIST 100 endeks serisi");
    const mp=new Map();rows.forEach(r=>{const d=istDate(r.zaman_utc);if(d&&r.kapanis>0&&!mp.has(d))mp.set(d,r.kapanis);});
    const D=[...mp.keys()].sort();const idx=new Map(D.map((d,k)=>[d,k]));const M=D.map(d=>Math.log(mp.get(d)));
    FZS.mk={D,idx,ret(d,n){const k=idx.get(d);return k==null||k<n?null:M[k]-M[k-n];},fwd(){return null;}};FZS.mkDay=today;return FZS.mk;})();
  try{return await FZS.pending;}finally{FZS.pending=null;}
}
async function scoreFrozen(code,T){
  $("fzCode").textContent=code;
  try{
    const mk=await fzMarket();if(S.code!==code)return;
    const n=T.live?T.c.length-1:T.c.length;const T2={t:T.t.slice(0,n),o:T.o.slice(0,n),h:T.h.slice(0,n),l:T.l.slice(0,n),c:T.c.slice(0,n),v:T.v.slice(0,n)};
    const X=stockFeatures(T2,mk,{shares:0,rep:[]});const x=X[n-1];
    if(!x){$("fzScore").textContent="—";$("fzTxt").textContent=n<121?"Skor için en az 6 ay fiyat geçmişi gerekiyor.":"Bu hissenin son günü için endeks verisi henüz yok; birazdan tekrar deneyin.";S.data.kaliciModel=null;return;}
    const p=fzPredict(x),pc=fzPct(p);
    $("fzScore").textContent=fmt(pc,0);$("fzScore").style.color=pc>=70?"var(--up)":pc<=30?"var(--down)":"var(--fg)";$("fzMark").style.left=Math.max(0,Math.min(100,pc))+"%";
    const band=pc>=80?"en üst %20 dilimde":pc>=60?"ortalamanın üstünde":pc>40?"ortalama civarında":pc>20?"ortalamanın altında":"en alt %20 dilimde";
    $("fzTxt").textContent=`${trDate(T2.t[n-1])} kapanışına göre ${code}, önümüzdeki 5 işlem gününde BIST 100 hisselerinin ortancasından iyi performans gösterme açısından ${band} (ham olasılık %${fmt(p*100,1)}).`+(T.live?" Seans içi mum kullanılmadı.":"");
    S.data.kaliciModel={skorYuzdelik:+pc.toFixed(0),hamOlasilik:+p.toFixed(3),ufukGun:5,hedef:"BIST 100 ortancasını yenme",tarih:T2.t[n-1],testIC:FZ.oos.ic,testIC_t:FZ.oos.icT,not:"Walk-forward testte sinyal zayıf ve istatistiksel olarak anlamlı değil"};
  }catch(e){if(S.code===code){$("fzScore").textContent="—";$("fzTxt").textContent=errCopy(e);}}
}
setTimeout(function fzInit(){const o=FZ.oos;
  $("fzStamp").textContent=`Eğitim: ${trDate(FZ.trained)} · ${FZ.models.length} model topluluğu`;
  $("fzIC").textContent=fmt(o.ic,3);$("fzICs").textContent=`t = ${fmt(o.icT,2)} · 2'nin altı anlamlı değil`;
  $("fzSpr").textContent=pct(o.spread5d*100,2);$("fzHit").textContent=fmt(o.hit,3);
  $("fzN").textContent=nf(0).format(FZ.data.samples)+" örnek";$("fzNs").textContent=`${FZ.data.stocks} hisse · ${trDate(FZ.data.from)} – ${trDate(FZ.data.to)}`;
  const top=FZ.imp.slice(0,4).map(([k])=>(FEATS.find(f=>f[0]===k)||[k,k])[1]).join(", ");
  $("fzNote").innerHTML=`Bu model ${trDate(FZ.data.from)}–${trDate(FZ.data.to)} arası BIST 100 günlük verisiyle bir kez eğitildi ve sayfaya gömüldü: her hisse için anında skor verir, Fintables'tan yalnızca 1 endeks sorgusu ister. En etkili girdiler: ${esc(top)}. <b>Dürüst not:</b> 2025-04'ten itibaren 6 çeyreklik yürüyen pencere testinde sinyal zayıf çıktı (IC ${fmt(o.ic,3)}, t ${fmt(o.icT,2)}); bu skor tek başına alım-satım kararı için yeterli değildir, diğer analizlerle birlikte bağlam olarak kullanın. Mevcut hisseler üzerinde eğitildiği için hayatta kalma yanlılığı içerir.`;},0);

