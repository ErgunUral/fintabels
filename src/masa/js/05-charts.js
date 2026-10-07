/* ---------- charts ---------- */
function chartOpts(h){return{height:h,layout:{background:{type:"solid",color:css("--surface")},textColor:css("--muted"),fontFamily:"IBM Plex Mono, monospace",fontSize:11},
  grid:{vertLines:{color:css("--line-soft")},horzLines:{color:css("--line-soft")}},rightPriceScale:{borderColor:css("--line")},timeScale:{borderColor:css("--line"),timeVisible:false},
  crosshair:{mode:0},localization:{locale:"tr-TR",priceFormatter:p=>nf(2).format(p)},handleScroll:true,handleScale:true};}
function buildCharts(){
  if(!window.LightweightCharts){$("chartNote").hidden=false;$("chartNote").textContent="Grafik kütüphanesi yüklenemedi; göstergeler yine de sağdaki tabloda.";return null;}
  const L=window.LightweightCharts;
  const mk=(el,h)=>L.createChart(el,{...chartOpts(h),width:el.clientWidth});
  const main=mk($("chMain"),$("chMain").clientHeight||380),r=mk($("chRsi"),120),m=mk($("chMacd"),120);
  const C={main,r,m,L};
  C.candle=main.addCandlestickSeries({upColor:css("--up"),downColor:css("--down"),borderVisible:false,wickUpColor:css("--up"),wickDownColor:css("--down")});
  C.vol=main.addHistogramSeries({priceScaleId:"vol",priceFormat:{type:"volume"},lastValueVisible:false,priceLineVisible:false});
  main.priceScale("vol").applyOptions({scaleMargins:{top:.82,bottom:0}});
  main.priceScale("right").applyOptions({scaleMargins:{top:.06,bottom:.2}});
  const line=(col,w=1.5)=>main.addLineSeries({color:css(col),lineWidth:w,lastValueVisible:false,priceLineVisible:false,crosshairMarkerVisible:false});
  C.s20=line("--sma20");C.s50=line("--sma50");C.s200=line("--sma200");
  C.bu=line("--band",1);C.bl=line("--band",1);
  C.rsi=r.addLineSeries({color:css("--accent"),lineWidth:1.5,priceLineVisible:false});
  C.rsi.createPriceLine({price:70,color:css("--down"),lineStyle:2,lineWidth:1,axisLabelVisible:false});
  C.rsi.createPriceLine({price:30,color:css("--up"),lineStyle:2,lineWidth:1,axisLabelVisible:false});
  C.mh=m.addHistogramSeries({priceLineVisible:false,lastValueVisible:false});
  C.ml=m.addLineSeries({color:css("--accent"),lineWidth:1.5,priceLineVisible:false,lastValueVisible:false});
  C.ms=m.addLineSeries({color:css("--sma20"),lineWidth:1.2,priceLineVisible:false,lastValueVisible:false});
  // sync time ranges
  const all=[main,r,m];let syncing=false;
  all.forEach(src=>src.timeScale().subscribeVisibleLogicalRangeChange(rg=>{if(syncing||!rg)return;syncing=true;all.forEach(o=>{if(o!==src)o.timeScale().setVisibleLogicalRange(rg);});syncing=false;}));
  new ResizeObserver(()=>{all.forEach((c,i)=>c.applyOptions({width:[$("chMain"),$("chRsi"),$("chMacd")][i].clientWidth}));}).observe($("chMain"));
  return C;
}
function retheme(){
  const C=S.charts;if(!C)return;
  [C.main,C.r,C.m].forEach(c=>c.applyOptions({layout:{background:{type:"solid",color:css("--surface")},textColor:css("--muted")},grid:{vertLines:{color:css("--line-soft")},horzLines:{color:css("--line-soft")}}}));
  C.candle.applyOptions({upColor:css("--up"),downColor:css("--down"),wickUpColor:css("--up"),wickDownColor:css("--down")});
  C.s20.applyOptions({color:css("--sma20")});C.s50.applyOptions({color:css("--sma50")});C.s200.applyOptions({color:css("--sma200")});
  C.bu.applyOptions({color:css("--band")});C.bl.applyOptions({color:css("--band")});C.rsi.applyOptions({color:css("--accent")});C.ml.applyOptions({color:css("--accent")});C.ms.applyOptions({color:css("--sma20")});
  if(S.data.T)drawTech(S.data.T,true);
}
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",()=>setTimeout(retheme,30));
new MutationObserver(()=>setTimeout(retheme,30)).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});

function series(t,vals){return t.map((tt,i)=>vals[i]==null?{time:tt}:{time:tt,value:vals[i]});}
function drawTech(T,colorsOnly){
  const C=S.charts;if(!C)return;
  const up=css("--up"),dn=css("--down");
  C.vol.setData(T.t.map((tt,i)=>({time:tt,value:T.v[i],color:(T.c[i]>=T.o[i]?up:dn)+"55"})));
  C.mh.setData(T.t.map((tt,i)=>T.mac.h[i]==null?{time:tt}:{time:tt,value:T.mac.h[i],color:T.mac.h[i]>=0?up:dn}));
  if(colorsOnly)return;
  C.candle.setData(T.t.map((tt,i)=>({time:tt,open:T.o[i],high:T.h[i],low:T.l[i],close:T.c[i]})));
  C.s20.setData(series(T.t,T.s20));C.s50.setData(series(T.t,T.s50));C.s200.setData(series(T.t,T.s200));
  C.bu.setData(series(T.t,T.bb.up));C.bl.setData(series(T.t,T.bb.lo));
  C.rsi.setData(series(T.t,T.rsi));C.ml.setData(series(T.t,T.mac.m));C.ms.setData(series(T.t,T.mac.sig));
  applyToggles();setRange(currentRange);
}
let currentRange=126;
function setRange(n){
  currentRange=n;const C=S.charts,T=S.data.T;if(!C||!T)return;
  document.querySelectorAll("#rangeSeg button").forEach(b=>b.setAttribute("aria-pressed",String(Number(b.dataset.r)===n)));
  const len=T.t.length;const from=n===0?0:Math.max(0,len-n);
  C.main.timeScale().setVisibleLogicalRange({from:from-0.5,to:len+2});
}
document.querySelectorAll("#rangeSeg button").forEach(b=>b.onclick=()=>setRange(Number(b.dataset.r)));
function applyToggles(){const C=S.charts;if(!C)return;
  C.s20.applyOptions({visible:$("tSma20").checked});C.s50.applyOptions({visible:$("tSma50").checked});C.s200.applyOptions({visible:$("tSma200").checked});
  C.bu.applyOptions({visible:$("tBb").checked});C.bl.applyOptions({visible:$("tBb").checked});}
["tSma20","tSma50","tSma200","tBb"].forEach(id=>$(id).addEventListener("change",applyToggles));

