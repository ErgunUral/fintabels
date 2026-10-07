/* ---------- ortak: gradyan artırmalı karar ağaçları (histogram, lojistik kayıp) ----------
   Veri sütun dizileridir (cols[f][j]). Sonlu olmayan değer "eksik" sayılır ve her bölmede daha iyi
   kazanç veren tarafa gönderilir. Sayfalar kendi varsayılanlarını ve döngüsünü (erken durdurma,
   ilerleme bildirimi) gbStart() üzerine kurar. */
const GB_NB=32;
function gbEdges(cols,idx){return cols.map(col=>{const v=[];for(const j of idx){const x=col[j];if(Number.isFinite(x))v.push(x);}v.sort((a,b)=>a-b);const e=[];if(!v.length)return e;for(let k=1;k<GB_NB;k++){const q=v[Math.floor(k*v.length/GB_NB)];if(!e.length||q>e[e.length-1])e.push(q);}return e;});}
function gbBins(cols,edges){return cols.map((col,f)=>{const e=edges[f],b=new Uint8Array(col.length);for(let j=0;j<col.length;j++){const v=col[j];if(!Number.isFinite(v)){b[j]=255;continue;}let lo=0,hi=e.length;while(lo<hi){const m=(lo+hi)>>1;if(v<=e[m])hi=m;else lo=m+1;}b[j]=lo;}return b;});}
/* ağaçta yürür; get(f) o özelliğin değerini verir. Düğüm: {f,t,miss,l,r}, yaprak: {v} */
function gbWalk(n,get){while(n.f!==undefined){const v=get(n.f);n=(Number.isFinite(v)?v<=n.t:n.miss)?n.l:n.r;}return n.v;}
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
        if(CL<o.minLeaf||CR<o.minLeaf)continue;const GR=G-GL,HR=H-HL;const gain=GL*GL/(HL+o.lambda)+GR*GR/(HR+o.lambda)-base;
        if(gain>o.minGain&&(!best||gain>best.gain))best={gain,f,k,missLeft};}}}
  if(!best)return leaf;imp[best.f]+=best.gain;
  const L=[],R=[],b=bins[best.f];for(const j of idx){const k=b[j];(k===255?best.missLeft:k<=best.k)?L.push(j):R.push(j);}
  return{f:best.f,t:edges[best.f][best.k],miss:best.missLeft,l:gbBuild(L,g,h,bins,edges,feats,depth+1,o,imp),r:gbBuild(R,g,h,bins,edges,feats,depth+1,o,imp)};
}
/* o: {lr,depth,minLeaf,lambda,minGain,sub,colsub,seed}; fitIdx: eğitimde kullanılan satırlar.
   addTree() bir ağaç ekler ve F'yi (tüm satırların ham skoru; doğrulama/test satırları dahil) günceller. */
function gbStart(cols,y,fitIdx,o){
  const N=y.length,nF=cols.length;let seed=o.seed;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  let pm=0;for(const j of fitIdx)pm+=y[j];pm=Math.min(0.99,Math.max(0.01,pm/fitIdx.length));const base=Math.log(pm/(1-pm));
  const edges=gbEdges(cols,fitIdx),bins=gbBins(cols,edges);
  const F=new Float64Array(N).fill(base),g=new Float64Array(N),h=new Float64Array(N),trees=[],imp=new Float64Array(nF);
  return{base,F,trees,imp,addTree(){
    for(const j of fitIdx){const p=1/(1+Math.exp(-F[j]));g[j]=p-y[j];h[j]=Math.max(p*(1-p),1e-6);}
    const sub=fitIdx.filter(()=>rnd()<o.sub);const feats=[];for(let f=0;f<nF;f++)if(rnd()<o.colsub)feats.push(f);if(!feats.length)feats.push(Math.floor(rnd()*nF));
    const tr=gbBuild(sub,g,h,bins,edges,feats,0,o,imp);trees.push(tr);
    for(let j=0;j<N;j++)F[j]+=gbWalk(tr,f=>cols[f][j]);return tr;}};
}
