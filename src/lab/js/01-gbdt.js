/* ---------- Gradyan artırma (genel, özellik sayısından bağımsız) ---------- */
const GB_NB=32;
function gbEdges(cols,idx){return cols.map(col=>{const v=[];for(const j of idx){const x=col[j];if(Number.isFinite(x))v.push(x);}v.sort((a,b)=>a-b);const e=[];if(!v.length)return e;for(let k=1;k<GB_NB;k++){const q=v[Math.floor(k*v.length/GB_NB)];if(!e.length||q>e[e.length-1])e.push(q);}return e;});}
function gbBins(cols,edges){return cols.map((col,f)=>{const e=edges[f],b=new Uint8Array(col.length);for(let j=0;j<col.length;j++){const v=col[j];if(!Number.isFinite(v)){b[j]=255;continue;}let lo=0,hi=e.length;while(lo<hi){const m=(lo+hi)>>1;if(v<=e[m])hi=m;else lo=m+1;}b[j]=lo;}return b;});}
function gbPred(n,x){while(n.f!==undefined){const v=x[n.f];n=(Number.isFinite(v)?v<=n.t:n.miss)?n.l:n.r;}return n.v;}
function gbBuild(idx,g,h,bins,edges,feats,depth,o,imp){
  let G=0,H=0;for(const j of idx){G+=g[j];H+=h[j];}
  const leaf={v:-G/(H+o.lambda)*o.lr};
  if(depth>=o.depth||idx.length<2*o.minLeaf)return leaf;
  const base=G*G/(H+o.lambda);let best=null;
  const hg=new Float64Array(GB_NB+1),hh=new Float64Array(GB_NB+1),hc=new Int32Array(GB_NB+1);
  for(const f of feats){hg.fill(0);hh.fill(0);hc.fill(0);const b=bins[f];let mg=0,mh=0,mc=0;
    for(const j of idx){const k=b[j];if(k===255){mg+=g[j];mh+=h[j];mc++;continue;}hg[k]+=g[j];hh[k]+=h[j];hc[k]++;}
    let gl=0,hl=0,cl=0;const nb=edges[f].length;
    for(let k=0;k<nb;k++){gl+=hg[k];hl+=hh[k];cl+=hc[k];
      for(const missLeft of [true,false]){const GL=gl+(missLeft?mg:0),HL=hl+(missLeft?mh:0),CL=cl+(missLeft?mc:0),CR=idx.length-CL;
        if(CL<o.minLeaf||CR<o.minLeaf)continue;const gain=GL*GL/(HL+o.lambda)+(G-GL)**2/(H-HL+o.lambda)-base;
        if(gain>1e-9&&(!best||gain>best.gain))best={gain,f,k,missLeft};}}}
  if(!best)return leaf;imp[best.f]+=best.gain;
  const L=[],R=[],b=bins[best.f];for(const j of idx){const k=b[j];(k===255?best.missLeft:k<=best.k)?L.push(j):R.push(j);}
  return{f:best.f,t:edges[best.f][best.k],miss:best.missLeft,l:gbBuild(L,g,h,bins,edges,feats,depth+1,o,imp),r:gbBuild(R,g,h,bins,edges,feats,depth+1,o,imp)};
}
function gbTrain(X,y,o){
  o=Object.assign({nTrees:150,lr:0.05,depth:3,minLeaf:60,lambda:5,sub:0.7,colsub:0.8,seed:11},o);
  const N=y.length,F=X[0].length;let seed=o.seed;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const cols=[];for(let f=0;f<F;f++){const a=new Float64Array(N);for(let j=0;j<N;j++)a[j]=X[j][f]==null?NaN:X[j][f];cols.push(a);}
  const all=[...Array(N).keys()];const edges=gbEdges(cols,all),bins=gbBins(cols,edges);
  let pm=y.reduce((a,b)=>a+b,0)/N;pm=Math.min(.99,Math.max(.01,pm));const base=Math.log(pm/(1-pm));
  const Fz=new Float64Array(N).fill(base),g=new Float64Array(N),h=new Float64Array(N),trees=[],imp=new Float64Array(F);
  for(let m=0;m<o.nTrees;m++){for(let j=0;j<N;j++){const p=1/(1+Math.exp(-Fz[j]));g[j]=p-y[j];h[j]=Math.max(p*(1-p),1e-6);}
    const sub=all.filter(()=>rnd()<o.sub);const feats=[];for(let f=0;f<F;f++)if(rnd()<o.colsub)feats.push(f);if(!feats.length)feats.push(0);
    const tr=gbBuild(sub,g,h,bins,edges,feats,0,o,imp);trees.push(tr);for(let j=0;j<N;j++)Fz[j]+=gbPred(tr,X[j]);}
  return{base,trees,imp:Array.from(imp)};
}
function gbScore(M,x){let z=M.base;for(const t of M.trees)z+=gbPred(t,x);return z;}

const ML_FEATS=["mom","mom6","rev1","lowvol","hi12","ep","bp","roe","grw","size","liq"];
/* walk-forward: her yıl başında, yalnızca etiketi o tarihten önce kesinleşmiş örneklerle yeniden eğit */
function makeMLScorer(DB, N, firstTrainMonths=36, onRetrain){
  const cache=new Map(); let model=null, modelYear=null; const imps=[]; const sampleCache=new Map();
  const samplesAt=t=>{ if(sampleCache.has(t)) return sampleCache.get(t);
    const rows=crossSection(DB,t,N); const fr=[]; const xs=[];
    for(const r of rows){ const a=DB.px[r.c][t], b=DB.px[r.c][t+1]; if(!isNum(a)||!isNum(b)) continue; xs.push(ML_FEATS.map(k=>r.z[k])); fr.push(b/a-1); }
    const med=fr.slice().sort((a,b)=>a-b)[Math.floor(fr.length/2)];
    const s={X:xs, y:fr.map(v=>v>med?1:0)}; sampleCache.set(t,s); return s; };
  const scorer=t=>{
    const yr=DB.months[t].slice(0,4);
    if(model===null||yr!==modelYear){
      const X=[],y=[]; for(let s=13; s<=t-1; s++){ const S=samplesAt(s); for(let i=0;i<S.X.length;i++){X.push(S.X[i]);y.push(S.y[i]);} } // s+1 <= t: etiket t'de biliniyor
      if(t-13<firstTrainMonths||X.length<500) return null;
      model=gbTrain(X,y,{}); modelYear=yr; imps.push({year:yr, imp:model.imp, n:X.length});
      if(onRetrain) onRetrain(yr,X.length);
    }
    const rows=crossSection(DB,t,N); rows.forEach(r=>r.score=gbScore(model, ML_FEATS.map(k=>r.z[k])));
    return rows;
  };
  scorer.importance=imps; scorer.ready=t=>(t-13)>=firstTrainMonths;
  return scorer;
}

if(typeof module!=="undefined") module.exports={fwdRet,FACTORS,FKEYS,universeAt,rawFactors,zscores,crossSection,scoreRows,spearman,runBacktest,convertSeries,metrics,yearly,gbTrain,gbScore,makeMLScorer,ML_FEATS,fundAtMonth,monthNext};
