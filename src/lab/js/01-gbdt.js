/* ---------- Gradyan artırma (genel, özellik sayısından bağımsız) ---------- */
//@include shared/gbdt.js
function gbPred(n,x){return gbWalk(n,f=>x[f]);}
function gbTrain(X,y,o){
  o=Object.assign({nTrees:150,lr:0.05,depth:3,minLeaf:60,lambda:5,minGain:1e-9,sub:0.7,colsub:0.8,seed:11},o);
  const N=y.length,F=X[0].length;
  const cols=[];for(let f=0;f<F;f++){const a=new Float64Array(N);for(let j=0;j<N;j++)a[j]=X[j][f]==null?NaN:X[j][f];cols.push(a);}
  const st=gbStart(cols,y,[...Array(N).keys()],o);
  for(let m=0;m<o.nTrees;m++)st.addTree();
  return{base:st.base,trees:st.trees,imp:Array.from(st.imp)};
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
