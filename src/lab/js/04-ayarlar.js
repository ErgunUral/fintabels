/* ---------------- AYARLAR ---------------- */
const PRESETS={mom:{mom:1},lowvol:{lowvol:1},value:{ep:1,bp:1},quality:{roe:1,grw:0.5}};
const ST={strat:"mom",N:100,K:10,R:1,view:"nom",wts:{mom:1,lowvol:0.5,ep:1,bp:0.5,roe:0.5,grw:0,hi12:0,mom6:0,rev1:0,size:0,liq:0}};
try{const s=JSON.parse(localStorage.getItem("lab_cfg")||"null");if(s)Object.assign(ST,s);}catch{}
const saveST=()=>{try{localStorage.setItem("lab_cfg",JSON.stringify(ST));}catch{}};
function segInit(id,key,num=true){const box=$(id);box.querySelectorAll("button").forEach(b=>{b.type="button";b.setAttribute("aria-pressed",String(String(ST[key])===b.dataset.v));
  b.onclick=()=>{ST[key]=num?Number(b.dataset.v):b.dataset.v;box.querySelectorAll("button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));saveST();if(key==="view"&&L.res)renderResults();};});}
segInit("pN","N");segInit("pK","K");segInit("pR","R");segInit("pV","view",false);
document.querySelectorAll("#stratList button").forEach(b=>{b.setAttribute("aria-pressed",String(b.dataset.s===ST.strat));b.onclick=()=>{ST.strat=b.dataset.s;document.querySelectorAll("#stratList button").forEach(x=>x.setAttribute("aria-pressed",String(x===b)));$("wtsBox").hidden=ST.strat!=="multi";saveST();};});
$("wtsBox").hidden=ST.strat!=="multi";
$("wts").innerHTML=FKEYS.map(k=>`<label for="w_${k}">${esc(FACTORS[k].n)}</label><input id="w_${k}" type="range" min="0" max="2" step="0.25" value="${ST.wts[k]||0}"><span class="num" id="wv_${k}">${fmt(ST.wts[k]||0,2)}</span>`).join("");
FKEYS.forEach(k=>$("w_"+k).addEventListener("input",e=>{ST.wts[k]=Number(e.target.value);$("wv_"+k).textContent=fmt(ST.wts[k],2);saveST();}));
if(ST.cost)$("pC").value=String(ST.cost);$("pC").onchange=e=>{ST.cost=Number(e.target.value);saveST();};

