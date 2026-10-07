/* ---------- ML: veri seti, özellikler, modeller ---------- */
const FEATS=[["r1","1 günlük getiri"],["r5","5 günlük getiri"],["r20","20 günlük getiri"],["r60","60 günlük getiri"],["pS20","Fiyat / SMA20"],["pS50","Fiyat / SMA50"],["s20s50","SMA20 / SMA50"],["rsi","RSI (14)"],["macdh","MACD histogramı"],["bbB","Bollinger %B"],["atr","ATR / fiyat"],["vol20","20 günlük oynaklık"],["vr","Hacim 5g / 50g"],["pos120","120 günlük aralıkta konum"],["dd120","120 günlük zirveden uzaklık"],["stk","Stokastik %K"],["mr5","Piyasa 5g getirisi"],["mr20","Piyasa 20g getirisi"],["rel20","Piyasaya göre 20g getiri"],["ey","Kazanç getirisi (1/FK)"],["bp","Özkaynak / piyasa değeri"],["grw","Yıllık satış büyümesi"],["roe","Özkaynak kârlılığı"],["fmiss","Temel veri yok"]];
const NF=FEATS.length;

/* BIST'te günlük fiyat limiti ±%10; bunun belirgin dışındaki sıçramalar bölünme/bedelsiz gibi
   sermaye işlemi kabul edilir ve önceki fiyatlar geriye doğru düzeltilir. */
function adjustCorporate(T){
  const n=T.c.length,o=T.o.slice(),h=T.h.slice(),l=T.l.slice(),c=T.c.slice(),v=T.v.slice();
  const ev=[];for(let i=1;i<n;i++){const r=c[i]/c[i-1];if(r<0.88||r>1.12)ev.push({i,r});}
  // sermaye işlemi sayılmayanlar: araya uzun ara girmiş sıçramalar (işlem durması sonrası gerçek fiyat hareketi)
  // ve 10 işlem günü içinde tersine dönen sıçramalar (veri hatası ya da serbest marjlı gerçek hareket)
  const ok=ev.filter(e=>(Date.parse(T.t[e.i])-Date.parse(T.t[e.i-1]))/864e5<=10&&!ev.some(x=>x!==e&&Math.abs(x.i-e.i)<=10&&Math.abs(Math.log(x.r*e.r))<0.2));
  for(const e of ok){const f=e.r;for(let j=0;j<e.i;j++){o[j]*=f;h[j]*=f;l[j]*=f;c[j]*=f;v[j]/=f;}}
  return{t:T.t,o,h,l,c,v,adj:ok.length};
}
function buildMarket(stocks){
  const acc=new Map();
  for(const s of stocks){const t=s.T.t,c=s.T.c;for(let i=1;i<c.length;i++){if(!(c[i]>0&&c[i-1]>0))continue;const r=Math.log(c[i]/c[i-1]);if(Math.abs(r)>0.25)continue;const a=acc.get(t[i])||[0,0];a[0]+=r;a[1]++;acc.set(t[i],a);}}
  const D=[...acc.keys()].filter(d=>acc.get(d)[1]>=Math.max(3,stocks.length*0.2)).sort();
  const idx=new Map(D.map((d,k)=>[d,k]));const M=new Float64Array(D.length);
  for(let k=1;k<D.length;k++){const a=acc.get(D[k]);M[k]=M[k-1]+a[0]/a[1];}
  return{D,idx,M,last:D[D.length-1],
    ret(d,n){const k=idx.get(d);return k==null||k<n?null:M[k]-M[k-n];},
    fwd(d1,d2){const a=idx.get(d1),b=idx.get(d2);return a==null||b==null?null:M[b]-M[a];}};
}

/* Nokta-zamanlı temel veri: tarih t'de yalnızca t'den ÖNCE yayımlanmış son rapor kullanılır. */
function fundAt(F,d){
  if(!F||!F.rep||!F.rep.length)return null;let r=null;
  for(const x of F.rep){if(x.pub<d)r=x;else break;}
  return r;
}
function stockFeatures(T,mk,F){
  const c=T.c,h=T.h,l=T.l,v=T.v,n=c.length;
  const s20=sma(c,20),s50=sma(c,50),rs=rsi(c),mc=macd(c),bb=boll(c),at=atr(h,l,c),st=stoch(h,l,c);
  const lr=c.map((x,i)=>i&&c[i-1]>0?Math.log(x/c[i-1]):null);
  const X=new Array(n).fill(null);
  for(let i=60;i<n;i++){
    if(!(c[i]>0))continue;
    let s=0,s2=0;for(let j=i-19;j<=i;j++){s+=lr[j];s2+=lr[j]*lr[j];}const vol=Math.sqrt(Math.max(0,s2/20-(s/20)**2));
    let hi=-Infinity,lo=Infinity;for(let j=Math.max(0,i-119);j<=i;j++){if(h[j]>hi)hi=h[j];if(l[j]<lo)lo=l[j];}
    let v5=0,v50=0;for(let j=i-4;j<=i;j++)v5+=v[j];for(let j=i-49;j<=i;j++)v50+=v[j];v5/=5;v50/=50;
    const mr5=mk.ret(T.t[i],5),mr20=mk.ret(T.t[i],20);
    const r20=Math.log(c[i]/c[i-20]);
    const fr=fundAt(F,T.t[i]);let ey=0,bp=0,grw=0,roe=0,fm=1;
    if(fr&&F.shares>0){const mc=c[i]*F.shares;fm=0;
      if(fr.net!=null)ey=Math.max(-0.5,Math.min(0.5,fr.net/mc));
      if(fr.eq!=null)bp=Math.max(-1,Math.min(5,fr.eq/mc));
      if(fr.rev!=null&&fr.revPrev>0)grw=Math.max(-1,Math.min(3,fr.rev/fr.revPrev-1));
      if(fr.net!=null&&fr.eq>0)roe=Math.max(-1,Math.min(1,fr.net/fr.eq));}
    const f=[lr[i],Math.log(c[i]/c[i-5]),r20,Math.log(c[i]/c[i-60]),c[i]/s20[i]-1,c[i]/s50[i]-1,s20[i]/s50[i]-1,rs[i]/100,mc.h[i]/c[i],
      bb.up[i]>bb.lo[i]?(c[i]-bb.lo[i])/(bb.up[i]-bb.lo[i]):0.5,at[i]/c[i],vol,v50>0&&v5>0?Math.log(v5/v50):0,hi>lo?(c[i]-lo)/(hi-lo):0.5,c[i]/hi-1,st.k[i]/100,mr5,mr20,mr20==null?null:r20-mr20,ey,bp,grw,roe,fm];
    if(f.every(x=>x!=null&&isFinite(x)))X[i]=Float64Array.from(f);
  }
  return X;
}

function makeDataset(stocks,mk,H,target){
  const S=[],live=[];
  for(const s of stocks){
    const X=s.X||(s.X=stockFeatures(s.T,mk,s.F));const t=s.T.t,c=s.T.c,n=c.length;
    for(let i=0;i<n;i++){if(!X[i])continue;
      if(i+H<n){const fwd=Math.log(c[i+H]/c[i]);const mf=mk.fwd(t[i],t[i+H]);if(target==="rel"&&mf==null)continue;
        const ex=target==="rel"?fwd-mf:fwd;if(Math.abs(fwd)>1.5)continue;
        S.push({x:X[i],y:ex>0?1:0,date:t[i],end:t[i+H],fwd,ex,code:s.code});}
    }
    if(X[n-1])live.push({code:s.code,date:t[n-1],x:X[n-1]});
  }
  return{S,live};
}

function toCols(rows){const N=rows.length,cols=[];for(let f=0;f<NF;f++){const a=new Float64Array(N);for(let j=0;j<N;j++)a[j]=rows[j].x[f];cols.push(a);}return cols;}
const sig=z=>1/(1+Math.exp(-z));
function auc(p,y){const o=p.map((v,i)=>[v,y[i]]).sort((a,b)=>a[0]-b[0]);let pos=0,neg=0,rank=0,sum=0;
  for(let i=0;i<o.length;){let j=i;while(j<o.length&&o[j][0]===o[i][0])j++;const r=(i+j+1)/2;for(let k=i;k<j;k++){if(o[k][1]){sum+=r;pos++;}else neg++;}i=j;}
  return pos&&neg?(sum-pos*(pos+1)/2)/(pos*neg):0.5;}
function logloss(p,y){let s=0;for(let i=0;i<p.length;i++){const q=Math.min(1-1e-6,Math.max(1e-6,p[i]));s-=y[i]?Math.log(q):Math.log(1-q);}return s/p.length;}

/* Gradient boosting (histogram, lojistik kayıp) */
const NB=32;
function makeEdges(cols,idx){return cols.map(col=>{const v=Array.from(idx,j=>col[j]).sort((a,b)=>a-b);const e=[];for(let k=1;k<NB;k++){const q=v[Math.floor(k*v.length/NB)];if(!e.length||q>e[e.length-1])e.push(q);}return e;});}
function binCols(cols,edges){return cols.map((col,f)=>{const e=edges[f],b=new Uint8Array(col.length);for(let j=0;j<col.length;j++){let lo=0,hi=e.length;const v=col[j];while(lo<hi){const m=(lo+hi)>>1;if(v<=e[m])hi=m;else lo=m+1;}b[j]=lo;}return b;});}
function predTree(n,cols,j){while(n.f!==undefined)n=cols[n.f][j]<=n.t?n.l:n.r;return n.v;}
function buildTree(idx,g,h,bins,edges,feats,depth,o,imp){
  let G=0,Hs=0;for(const j of idx){G+=g[j];Hs+=h[j];}
  const leaf={v:-G/(Hs+o.lambda)*o.lr};
  if(depth>=o.depth||idx.length<2*o.minLeaf)return leaf;
  const base=G*G/(Hs+o.lambda);let best=null;
  const hg=new Float64Array(NB),hh=new Float64Array(NB),hc=new Int32Array(NB);
  for(const f of feats){hg.fill(0);hh.fill(0);hc.fill(0);const b=bins[f];
    for(const j of idx){const k=b[j];hg[k]+=g[j];hh[k]+=h[j];hc[k]++;}
    let gl=0,hl=0,cl=0;const nb=edges[f].length;
    for(let k=0;k<nb;k++){gl+=hg[k];hl+=hh[k];cl+=hc[k];const cr=idx.length-cl;if(cl<o.minLeaf)continue;if(cr<o.minLeaf)break;
      const gr=G-gl,hr=Hs-hl;const gain=gl*gl/(hl+o.lambda)+gr*gr/(hr+o.lambda)-base;
      if(gain>o.minGain&&(!best||gain>best.gain))best={gain,f,k};}}
  if(!best)return leaf;
  imp[best.f]+=best.gain;
  const L=[],R=[],b=bins[best.f];for(const j of idx)(b[j]<=best.k?L:R).push(j);
  return{f:best.f,t:edges[best.f][best.k],l:buildTree(L,g,h,bins,edges,feats,depth+1,o,imp),r:buildTree(R,g,h,bins,edges,feats,depth+1,o,imp)};
}
async function trainGBDT(cols,y,fitIdx,valIdx,o,onTree){
  o=Object.assign({nTrees:300,lr:0.05,depth:3,minLeaf:80,lambda:5,minGain:1e-6,sub:0.7,colsub:0.8,patience:40,seed:7},o);
  let seed=o.seed;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const N=y.length;let pm=0;for(const j of fitIdx)pm+=y[j];pm=Math.min(0.99,Math.max(0.01,pm/fitIdx.length));
  const base=Math.log(pm/(1-pm));
  const edges=makeEdges(cols,fitIdx),bins=binCols(cols,edges);
  const F=new Float64Array(N).fill(base),g=new Float64Array(N),h=new Float64Array(N);
  const trees=[],imp=new Float64Array(NF),impAt=[];let bestLoss=Infinity,bestN=0;
  for(let m=0;m<o.nTrees;m++){
    for(const j of fitIdx){const p=sig(F[j]);g[j]=p-y[j];h[j]=Math.max(p*(1-p),1e-6);}
    const sub=fitIdx.filter(()=>rnd()<o.sub);
    const feats=[];for(let f=0;f<NF;f++)if(rnd()<o.colsub)feats.push(f);if(!feats.length)feats.push(Math.floor(rnd()*NF));
    const tr=buildTree(sub,g,h,bins,edges,feats,0,o,imp);trees.push(tr);impAt.push(Float64Array.from(imp));
    for(let j=0;j<N;j++)F[j]+=predTree(tr,cols,j);
    if(valIdx&&valIdx.length){let s=0;for(const j of valIdx){const q=Math.min(1-1e-6,Math.max(1e-6,sig(F[j])));s-=y[j]?Math.log(q):Math.log(1-q);}s/=valIdx.length;
      if(s<bestLoss-1e-5){bestLoss=s;bestN=m+1;}else if(m+1-bestN>=o.patience)break;}
    else bestN=m+1;
    if(onTree&&m%5===4)await onTree(m+1,o.nTrees);
  }
  bestN=Math.max(1,bestN);
  return{trees:trees.slice(0,bestN),base,bestN,imp:impAt[bestN-1]};
}
function predGBDT(model,cols,j){let z=model.base;for(const t of model.trees)z+=predTree(t,cols,j);return sig(z);}
function predGBDTx(model,x){const cols=Array.from(x,v=>[v]);return predGBDT(model,cols,0);}

/* Lojistik regresyon (L2, tam yığın gradyan inişi) */
function trainLR(cols,y,idx,iters=400,lr=0.5,l2=1e-3){
  const mu=new Float64Array(NF),sd=new Float64Array(NF);
  for(let f=0;f<NF;f++){let s=0,s2=0;for(const j of idx){s+=cols[f][j];s2+=cols[f][j]**2;}mu[f]=s/idx.length;sd[f]=Math.sqrt(Math.max(1e-12,s2/idx.length-mu[f]**2));}
  const w=new Float64Array(NF);let b=0;const n=idx.length;const z=new Float64Array(n);
  for(let it=0;it<iters;it++){const gw=new Float64Array(NF);let gb=0;
    for(let k=0;k<n;k++){const j=idx[k];let s=b;for(let f=0;f<NF;f++)s+=w[f]*Math.max(-5,Math.min(5,(cols[f][j]-mu[f])/sd[f]));const e=sig(s)-y[j];gb+=e;
      for(let f=0;f<NF;f++)gw[f]+=e*Math.max(-5,Math.min(5,(cols[f][j]-mu[f])/sd[f]));}
    b-=lr*gb/n;for(let f=0;f<NF;f++)w[f]-=lr*(gw[f]/n+l2*w[f]);}
  return{w,b,mu,sd,pred(cols,j){let s=b;for(let f=0;f<NF;f++)s+=w[f]*Math.max(-5,Math.min(5,(cols[f][j]-mu[f])/sd[f]));return sig(s);}};
}

/* Uçtan uca: eğit, zaman bazlı test et, canlı tahmin üret */
async function runModel(stocks,H,target,onStep){
  const mk=buildMarket(stocks);
  const {S,live}=makeDataset(stocks,mk,H,target);
  if(S.length<2000)throw new Error("Eğitim için yeterli örnek yok ("+S.length+").");
  const U=[...new Set(S.map(s=>s.date))].sort();
  const testStart=U[Math.floor(U.length*0.75)];
  const trainAll=[],test=[];S.forEach((s,j)=>{if(s.date>=testStart)test.push(j);else if(s.end<testStart)trainAll.push(j);});
  const Ut=[...new Set(trainAll.map(j=>S[j].date))].sort();const valStart=Ut[Math.floor(Ut.length*0.85)];
  const fit=[],val=[];trainAll.forEach(j=>{if(S[j].date>=valStart)val.push(j);else if(S[j].end<valStart)fit.push(j);});
  const cols=toCols(S),y=Int8Array.from(S,s=>s.y);
  await onStep("Gradyan artırma modeli eğitiliyor",0);
  const gb=await trainGBDT(cols,y,fit,val,{},async(m,n)=>onStep("Gradyan artırma modeli eğitiliyor",m/n*0.55));
  await onStep("Lojistik regresyon eğitiliyor",0.6);
  const lrm=trainLR(cols,y,trainAll);
  const yt=test.map(j=>y[j]);
  const pg=test.map(j=>predGBDT(gb,cols,j)),pl=test.map(j=>lrm.pred(cols,j));
  const base=yt.reduce((a,b)=>a+b,0)/yt.length;
  const acc=pg.reduce((a,p,k)=>a+((p>=0.5)===(yt[k]===1)?1:0),0)/yt.length;
  // dilimler (test)
  const ord=test.map((j,k)=>({p:pg[k],y:yt[k],ex:S[j].ex})).sort((a,b)=>a.p-b.p);const Q=[];
  for(let q=0;q<5;q++){const part=ord.slice(Math.floor(q*ord.length/5),Math.floor((q+1)*ord.length/5));
    Q.push({p:part.reduce((a,b)=>a+b.p,0)/part.length,up:part.reduce((a,b)=>a+b.y,0)/part.length,ret:(Math.exp(part.reduce((a,b)=>a+b.ex,0)/part.length)-1)*100,n:part.length});}
  await onStep("Son model tüm veriyle eğitiliyor",0.7);
  const allIdx=S.map((_,j)=>j);
  const fin=await trainGBDT(cols,y,allIdx,null,{nTrees:gb.bestN},async(m,n)=>onStep("Son model tüm veriyle eğitiliyor",0.7+m/n*0.28));
  const tot=fin.imp.reduce((a,b)=>a+b,0)||1;
  const importance=FEATS.map(([k,n],f)=>({k,n,v:fin.imp[f]/tot})).sort((a,b)=>b.v-a.v);
  const lastDate=mk.last;
  const preds=live.filter(r=>r.date===lastDate).map(r=>({code:r.code,p:predGBDTx(fin,r.x)})).sort((a,b)=>b.p-a.p);
  const bt=backtestData(S,test,pg,H);
  return{v:2,bt,H,target,trainedAt:new Date().toISOString(),dataFrom:U[0],dataTo:lastDate,testStart,nStocks:stocks.length,nSamples:S.length,nTrain:trainAll.length,nTest:test.length,
    metrics:{base,acc,aucG:auc(pg,yt),aucL:auc(pl,yt),llG:logloss(pg,yt),llBase:logloss(yt.map(()=>base),yt),majAcc:Math.max(base,1-base),trees:gb.bestN},
    quint:Q,importance,preds,model:{base:fin.base,trees:fin.trees},mkt:{date:lastDate,r5:mk.ret(lastDate,5),r20:mk.ret(lastDate,20)}};
}
/* Geri test: test döneminde her H günde bir, olasılığı en yüksek N hisse eşit ağırlıkla alınır ve H gün tutulur.
   Tahminler yalnızca testten önceki veriyle eğitilmiş modelden gelir. */
function backtestData(S,test,pg,H,N=10){
  const byD=new Map();test.forEach((j,k)=>{const s=S[j];if(!byD.has(s.date))byD.set(s.date,[]);byD.get(s.date).push({c:s.code,p:pg[k],r:Math.exp(s.fwd)-1});});
  const D=[...byD.keys()].sort();const out=[];
  for(let k=0;k<D.length;k+=H){const L=byD.get(D[k]);if(L.length<Math.max(20,2*N))continue;
    L.sort((a,b)=>b.p-a.p);const avg=a=>a.reduce((x,y)=>x+y.r,0)/a.length;
    out.push({d:D[k],top:L.slice(0,N).map(x=>x.c),rt:avg(L.slice(0,N)),rm:avg(L),rb:avg(L.slice(-N)),n:L.length});}
  return out;
}
function btCurves(bt,costPct){
  let et=1,em=1,eb=1,peak=1,mdd=0,win=0,prev=null;const pts=[{d:null,t:1,m:1,b:1}];
  for(const x of bt){const turn=prev?x.top.filter(c=>!prev.includes(c)).length/x.top.length:1;
    const cost=costPct/100*turn;et*=1+x.rt-cost;em*=1+x.rm;eb*=1+x.rb;
    if(x.rt-cost>x.rm)win++;peak=Math.max(peak,et);mdd=Math.min(mdd,et/peak-1);prev=x.top;pts.push({d:x.d,t:et,m:em,b:eb});}
  return{pts,top:et-1,mkt:em-1,bot:eb-1,mdd,win:bt.length?win/bt.length:0,n:bt.length};
}
function predictOne(M,T,F){
  const mk={ret:(d,n)=>d===M.mkt.date?(n===5?M.mkt.r5:n===20?M.mkt.r20:null):null};
  const X=stockFeatures(T,mk,F);const i=T.c.length-1;
  return X[i]&&T.t[i]===M.mkt.date?predGBDTx(M.model,Array.from(X[i])):null;
}

