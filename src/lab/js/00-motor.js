/* ================= GERİ TEST MOTORU (saf fonksiyonlar, tarayıcı ve node'da çalışır) =================
 DB = { months:["2014-01",...], codes:[...], px:{code:Float64Array}, tv:{code:Float64Array} (aylık işlem hacmi TL),
        shares:{code:number}, fund:{code:[{pub,net,rev,revPrev,eq}]}, xu100:Float64Array, tufe:Float64Array, usd:Float64Array,
        partialLast:boolean }
 Sinyal ay sonu t'de oluşur, portföy aynı kapanışta kurulur, getiri t -> t+1 ay sonu kapanışıdır. */

const FACTORS = {
  mom:   { n: "Momentum (12-1 ay)", dir: 1 },
  mom6:  { n: "6 ay getiri", dir: 1 },
  rev1:  { n: "Son 1 ay getiri", dir: -1 },
  lowvol:{ n: "Düşük oynaklık", dir: 1 },
  hi12:  { n: "12 ay zirveye yakınlık", dir: 1 },
  ep:    { n: "Kazanç getirisi (1/FK)", dir: 1 },
  bp:    { n: "Defter/piyasa (1/PDDD)", dir: 1 },
  roe:   { n: "Özkaynak kârlılığı", dir: 1 },
  grw:   { n: "Satış büyümesi", dir: 1 },
  size:  { n: "Küçük şirket", dir: 1 },
  liq:   { n: "Likidite", dir: 1 },
};
const FKEYS = Object.keys(FACTORS);

const isNum = v => v != null && Number.isFinite(v);
function monthNext(m){ let [y,mo]=m.split("-").map(Number); mo++; if(mo>12){mo=1;y++;} return `${y}-${String(mo).padStart(2,"0")}`; }

function fundAtMonth(list, month){ // ay sonuna kadar YAYIMLANMIŞ son rapor
  if(!list||!list.length) return null; const lim = monthNext(month)+"-01"; let r=null;
  for(const x of list){ if(x.pub < lim) r=x; else break; } return r;
}

/* t ayı için evren: geçmişi yeterli, son 3 ay ortalama işlem hacmine göre ilk N */
function universeAt(DB, t, N, minHist=13){
  const out=[];
  for(const c of DB.codes){
    const p=DB.px[c], v=DB.tv[c];
    if(!isNum(p[t])||t-minHist+1<0||!isNum(p[t-minHist+1])) continue;
    let s=0,k=0; for(let j=t-2;j<=t;j++){ if(j>=0&&isNum(v[j])){s+=v[j];k++;} }
    if(k<3||s<=0) continue;
    out.push({c, liqv:s/k});
  }
  out.sort((a,b)=>b.liqv-a.liqv);
  return out.slice(0,N);
}

/* t ayında bir hisse için ham faktör değerleri (yalnızca t ve öncesi veri) */
function rawFactors(DB, c, t){
  const p=DB.px[c]; const r={};
  const P=k=>p[t-k];
  r.mom = isNum(P(1))&&isNum(P(12)) ? P(1)/P(12)-1 : null;
  r.mom6 = isNum(P(0))&&isNum(P(6)) ? P(0)/P(6)-1 : null;
  r.rev1 = isNum(P(0))&&isNum(P(1)) ? P(0)/P(1)-1 : null;
  let rets=[]; for(let k=0;k<12;k++){ if(isNum(P(k))&&isNum(P(k+1))) rets.push(Math.log(P(k)/P(k+1))); }
  if(rets.length>=9){ const m=rets.reduce((a,b)=>a+b,0)/rets.length; r.lowvol = -Math.sqrt(rets.reduce((a,b)=>a+(b-m)**2,0)/(rets.length-1))*Math.sqrt(12); r.vol=-r.lowvol; } else { r.lowvol=null; r.vol=null; }
  let hi=-Infinity; for(let k=0;k<12;k++) if(isNum(P(k))) hi=Math.max(hi,P(k));
  r.hi12 = isNum(P(0))&&hi>0 ? P(0)/hi-1 : null;
  const v=DB.tv[c]; let s=0,n=0; for(let k=0;k<3;k++) if(isNum(v[t-k])){s+=v[t-k];n++;}
  r.liq = n&&s>0 ? Math.log(s/n) : null;
  const sh=DB.shares[c]; const mc = sh>0&&isNum(P(0)) ? sh*P(0) : null;
  r.size = mc ? -Math.log(mc) : null; r.mcap=mc;
  const f=fundAtMonth(DB.fund&&DB.fund[c], DB.months[t]);
  r.ep = f&&mc&&isNum(f.net) ? f.net/mc : null;
  r.bp = f&&mc&&isNum(f.eq) ? f.eq/mc : null;
  r.roe = f&&isNum(f.net)&&f.eq>0 ? f.net/f.eq : null;
  r.grw = f&&isNum(f.rev)&&f.revPrev>0 ? f.rev/f.revPrev-1 : null;
  return r;
}

/* kesitsel z-skoru: %2/%98 kırpma + standartlaştırma */
function zscores(vals){
  const idx=vals.map((v,i)=>isNum(v)?i:-1).filter(i=>i>=0);
  const out=vals.map(()=>null); if(idx.length<5) return out;
  const s=idx.map(i=>vals[i]).sort((a,b)=>a-b);
  const lo=s[Math.floor(0.02*(s.length-1))], hi=s[Math.ceil(0.98*(s.length-1))];
  const w=idx.map(i=>Math.min(hi,Math.max(lo,vals[i])));
  const m=w.reduce((a,b)=>a+b,0)/w.length, sd=Math.sqrt(w.reduce((a,b)=>a+(b-m)**2,0)/w.length)||1;
  idx.forEach((i,k)=>out[i]=(w[k]-m)/sd);
  return out;
}

/* t ayı kesiti: evren + faktörler + z-skorları */
function crossSection(DB, t, N){
  const U=universeAt(DB,t,N);
  const rows=U.map(u=>({c:u.c, liqv:u.liqv, f:rawFactors(DB,u.c,t)}));
  for(const k of FKEYS){ const z=zscores(rows.map(r=>r.f[k])); rows.forEach((r,i)=>{ (r.z||(r.z={}))[k]=z[i]==null?null:z[i]*FACTORS[k].dir; }); }
  return rows;
}

/* skor: ağırlıklı z toplamı; eksik faktör 0 (nötr) sayılır, hiç faktörü olmayan elenir */
function scoreRows(rows, weights){
  const ks=Object.keys(weights).filter(k=>weights[k]);
  for(const r of rows){ let s=0,w=0,has=0; for(const k of ks){ const z=r.z[k]; if(z!=null){ s+=weights[k]*z; has++; } w+=Math.abs(weights[k]); } r.score = has? s/(w||1) : null; }
  return rows.filter(r=>r.score!=null);
}

function spearman(a,b){
  const n=a.length; if(n<5) return null;
  const rk=x=>{ const o=x.map((v,i)=>[v,i]).sort((p,q)=>p[0]-q[0]); const r=new Array(n); for(let i=0;i<n;){ let j=i; while(j<n&&o[j][0]===o[i][0]) j++; const av=(i+j-1)/2; for(let k=i;k<j;k++) r[o[k][1]]=av; i=j; } return r; };
  const ra=rk(a), rb=rk(b); const ma=(n-1)/2; let num=0,da=0,db=0; for(let i=0;i<n;i++){ num+=(ra[i]-ma)*(rb[i]-ma); da+=(ra[i]-ma)**2; db+=(rb[i]-ma)**2; }
  return num/Math.sqrt(da*db||1);
}

/* t -> t+1 getirisi. t+1 fiyatı yoksa (işlem durması) sonraki ilk fiyata kadarki getiri bu aya yazılır;
   veri hatası filtresinin sildiği 4 katlık sıçramalar köprülenmez. Getiri hesaplanamıyorsa null. */
function fwdRet(p, t, maxGap=12){
  const a=p[t]; if(!isNum(a)||!(a>0)) return null;
  for(let j=t+1; j<p.length&&j<=t+maxGap; j++){ if(!isNum(p[j])) continue; const r=p[j]/a; return j===t+1||(r<=4&&r>=0.25) ? r-1 : null; }
  return null;
}

/* ana geri test döngüsü.
 cfg = {N, K, rebal (ay), cost (tek yön oran), start (ay indeksi), end (son sinyal ayı indeksi), scorer(t)->rows with .score } */
function runBacktest(DB, cfg){
  const {K, rebal=1, cost=0.002} = cfg;
  let w = {};        // mevcut ağırlıklar (ay başında)
  const out={months:[], strat:[], ew:[], bench:[], turnover:[], holdings:[], ic:[], nUniv:[]};
  let since=rebal;
  for(let t=cfg.start; t<=cfg.end; t++){
    if(t+1>=DB.months.length) break;
    let rows=null, trade=0;
    if(since>=rebal){
      rows=cfg.scorer(t);
      const picks=rows.slice().sort((a,b)=>b.score-a.score).slice(0,K);
      const nw={}; picks.forEach(p=>nw[p.c]=1/picks.length);
      const keys=new Set([...Object.keys(w),...Object.keys(nw)]);
      for(const k of keys) trade+=Math.abs((nw[k]||0)-(w[k]||0));
      w=nw; since=0;
      // IC: skor ile sonraki ay getirisi arasında sıra korelasyonu
      const sc=[],fr=[]; for(const r of rows){ const a=DB.px[r.c][t], b=DB.px[r.c][t+1]; if(isNum(a)&&isNum(b)){ sc.push(r.score); fr.push(b/a-1); } }
      out.ic.push(spearman(sc,fr));
      out.holdings.push({m:DB.months[t], codes:picks.map(p=>p.c)});
    }
    // portföy getirisi (fiyat arası köprülenir; hiç fiyat gelmiyorsa o hisse için %0 kabul)
    let gr=0, nwDrift={}, tot=0;
    for(const k in w){ const fr=fwdRet(DB.px[k],t); const rr=fr==null? 0 : fr; gr+=w[k]*rr; nwDrift[k]=w[k]*(1+rr); tot+=nwDrift[k]; }
    for(const k in nwDrift) nwDrift[k]/=tot||1;
    const net=gr - cost*trade;
    // eşit ağırlıklı evren (maliyetsiz), aynı likidite evreni
    const U=universeAt(DB,t,cfg.N); let es=0,en=0; for(const u of U){ const fr=fwdRet(DB.px[u.c],t); if(fr!=null){ es+=fr; en++; } }
    const bx=isNum(DB.xu100[t])&&isNum(DB.xu100[t+1]) ? DB.xu100[t+1]/DB.xu100[t]-1 : null;
    out.months.push(DB.months[t+1]); out.strat.push(net); out.ew.push(en?es/en:null); out.bench.push(bx); out.turnover.push(trade); out.nUniv.push(U.length);
    w=nwDrift; since++;
  }
  return out;
}

/* para birimi / enflasyon dönüşümü: getiri dizisini reel (TÜFE) ya da USD bazına çevirir */
function convertSeries(DB, months, rets, mode){
  if(mode==="nom") return rets.slice();
  const idx=new Map(DB.months.map((m,i)=>[m,i]));
  return rets.map((r,k)=>{ if(r==null) return null; const i=idx.get(months[k]); if(i==null||i<1) return null;
    const S = mode==="real"? DB.tufe : DB.usd; const a=S[i-1], b=S[i]; if(!isNum(a)||!isNum(b)) return null;
    return (1+r)/(b/a)-1; });
}

function metrics(r, ref){
  const v=r.map((x,i)=>[x,ref?ref[i]:0]).filter(p=>isNum(p[0])&&(!ref||isNum(p[1])));
  const n=v.length; if(!n) return null;
  let eq=1,peak=1,mdd=0; const ex=[]; let hit=0;
  for(const [x,b] of v){ eq*=1+x; peak=Math.max(peak,eq); mdd=Math.min(mdd,eq/peak-1); if(ref){ ex.push(x-b); if(x>b) hit++; } }
  const mean=v.reduce((a,p)=>a+p[0],0)/n, sd=Math.sqrt(v.reduce((a,p)=>a+(p[0]-mean)**2,0)/Math.max(1,n-1));
  const res={n, total:eq-1, cagr:Math.pow(eq,12/n)-1, vol:sd*Math.sqrt(12), mdd};
  if(ref){ const me=ex.reduce((a,b)=>a+b,0)/n, se=Math.sqrt(ex.reduce((a,b)=>a+(b-me)**2,0)/Math.max(1,n-1));
    let eb=1; for(const p of v) eb*=1+p[1];
    res.excessCagr=res.cagr-(Math.pow(eb,12/n)-1); res.te=se*Math.sqrt(12); res.ir=se?me/se*Math.sqrt(12):null; res.tstat=se?me/(se/Math.sqrt(n)):null; res.hit=hit/n; }
  return res;
}

function yearly(months, series){ // {yıl: bileşik getiri}
  const y={}; months.forEach((m,i)=>{ const k=m.slice(0,4); const r=series[i]; if(!isNum(r)) return; y[k]=(y[k]==null?1:y[k])*(1+r); });
  for(const k in y) y[k]-=1; return y;
}

