/* ---------------- TEST ---------------- */
function lastSignalIdx(DB){const M=DB.months.length;return DB.partialLast?M-3:M-2;}
function makeScorer(DB,strat,N,wts){
  if(strat==="ml")return makeMLScorer(DB,N,36);
  const W=strat==="multi"?wts:PRESETS[strat];
  const f=t=>scoreRows(crossSection(DB,t,N),W);f.ready=()=>true;return f;}
async function runTest(){
  const DB=L.DB;if(!DB||L.busy)return;L.busy=true;$("run").disabled=true;$("runMsg").textContent="Hesaplanıyor…";await tick();
  try{
    const startYear=Number($("pS").value)||2016;ST.startYear=startYear;ST.cost=Number($("pC").value);saveST();
    let start=DB.months.findIndex(m=>m>=`${startYear}-01`);start=Math.max(13,start);
    const sc=makeScorer(DB,ST.strat,ST.N,ST.wts);
    if(ST.strat==="ml"){while(start<DB.months.length&&!sc.ready(start))start++;$("runMsg").textContent="Model yıllık olarak yeniden eğitiliyor…";await tick();}
    const end=lastSignalIdx(DB);if(start>=end)throw new Error("Seçilen dönem için yeterli veri yok.");
    // makine öğrenmesinde skorlar önceden, geri testin çağıracağı aylarda ve aynı sırayla hesaplanır;
    // her ayın ardından arayüze dönülür ki yıllık eğitimler sayfayı dondurmasın
    let scorer=sc;
    if(ST.strat==="ml"){const memo=new Map();
      for(let t=start;t<=end&&t+1<DB.months.length;t+=ST.R){memo.set(t,sc(t));$("runMsg").textContent=`Model yıllık olarak yeniden eğitiliyor: ${mLabel(DB.months[t])}…`;await tick();}
      scorer=t=>memo.has(t)?memo.get(t):sc(t);}
    const R=runBacktest(DB,{N:ST.N,K:ST.K,rebal:ST.R,cost:ST.cost,start,end,scorer});
    // bugünkü portföy: en son veriyle
    const tNow=DB.months.length-1;const rowsNow=sc(tNow)||[];const picks=rowsNow.slice().sort((a,b)=>b.score-a.score).slice(0,ST.K);
    L.res={R,cfg:{...ST,startYear,start,end,strat:ST.strat,wts:{...ST.wts}},picks,tNow,imp:sc.importance||null};
    renderResults();$("runMsg").textContent=`Test tamamlandı: ${R.months.length} ay.`;
  }catch(e){$("runMsg").textContent=e.message||String(e);}
  finally{L.busy=false;$("run").disabled=false;}
}
$("run").onclick=runTest;

