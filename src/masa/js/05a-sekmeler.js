/* ---------- Sekmeler ---------- */
/* Her bölüm (section) bir sekmedir; kimlikleri sekme adıdır. Hisse sekmelerinde üstteki fiyat şeridi görünür,
   liste sekmelerinde (portföy, takip, tarama) gizlenir. */
const STOCK_TABS=["teknik","temel","analist","sahiplik","kap","model","ai"],LIST_TABS=["portfoy","takip","tarama"];
const TAB={cur:"teknik",stock:"teknik"};
/* Grafikler gizli sekmede oluşturulmuş olabilir: görünür olunca boyut ve aralık yeniden uygulanır */
function fixCharts(){const C=S.charts;if(!C)return;const els=[$("chMain"),$("chRsi"),$("chMacd")];
  [C.main,C.r,C.m].forEach((c,i)=>c.applyOptions({width:els[i].clientWidth,height:els[i].clientHeight||(i?120:380)}));setRange(currentRange);}
function showTab(id,save=true){
  if(!STOCK_TABS.includes(id)&&!LIST_TABS.includes(id))id="teknik";
  TAB.cur=id;if(STOCK_TABS.includes(id))TAB.stock=id;
  [...STOCK_TABS,...LIST_TABS].forEach(t=>{$(t).hidden=t!==id;});
  $("quote").hidden=LIST_TABS.includes(id);
  document.querySelectorAll("#tabs button").forEach(b=>{const on=b.dataset.tab===id;b.setAttribute("aria-selected",String(on));b.tabIndex=on?0:-1;});
  if(save){try{localStorage.setItem("hm_tab",id);}catch{}}
  if(id==="teknik")fixCharts();
}
document.querySelectorAll("#tabs button").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));
$("tabs").addEventListener("keydown",e=>{if(e.key!=="ArrowRight"&&e.key!=="ArrowLeft")return;
  const all=[...STOCK_TABS,...LIST_TABS],i=(all.indexOf(TAB.cur)+(e.key==="ArrowRight"?1:all.length-1))%all.length;
  showTab(all[i]);const b=document.querySelector(`#tabs button[data-tab="${all[i]}"]`);if(b)b.focus();e.preventDefault();});
{let t="teknik";try{t=localStorage.getItem("hm_tab")||"teknik";}catch{}showTab(t,false);}

