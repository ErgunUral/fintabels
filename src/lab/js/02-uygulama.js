/* ================= UYGULAMA: veri katmanı + arayüz ================= */
const SERVER="Fintables";
const $=id=>document.getElementById(id);
const nf=(d=2)=>new Intl.NumberFormat("tr-TR",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmt=(v,d=2)=>v==null||!isFinite(v)?"—":nf(d).format(v);
const pct=(v,d=1)=>v==null||!isFinite(v)?"—":(v>0?"+":"")+nf(d).format(v*100)+"%";
const pctu=(v,d=1)=>v==null||!isFinite(v)?"—":"%"+nf(d).format(v*100);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const istDate=iso=>{const t=Date.parse(iso);return isNaN(t)?null:new Date(t+3*3600e3).toISOString().slice(0,10);};
const trDate=d=>{if(!d)return"—";const[y,m,dd]=d.split("-");return dd?`${dd}.${m}.${y}`:`${m}.${y}`;};
const MONTHS_TR=["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];
const mLabel=m=>`${MONTHS_TR[Number(m.slice(5,7))-1]} ${m.slice(0,4)}`;
const tick=()=>new Promise(r=>setTimeout(r,0));
const L={mcp:null,sample:null,raw:null,DB:null,res:null,busy:false};

function errCopy(e){const c=e&&e.code;if(isQuota(e))return"Fintables günlük sorgu sınırına ulaşıldı (Fintables tarafındaki hesap limiti). Yarın tekrar basın; inen veri korunur ve kaldığı yerden devam eder.";switch(c){
  case"upstream_error":return"Fintables sunucusu hata döndü"+(e.message?": "+String(e.message).slice(0,160):"")+". Bu genelde günlük sorgu sınırı ya da geçici bir arızadır; bir süre sonra tekrar basın, inen veri korunur.";
  case"server_not_connected":return"Fintables bağlantısı bulunamadı. claude.ai'de Ayarlar → Bağlayıcılar bölümünden Fintables'ı ekleyin.";
  case"needs_reauth":return"Fintables oturumunuzun süresi dolmuş. Ayarlar → Bağlayıcılar bölümünden yeniden bağlanın.";
  case"selection_required":return"Birden fazla Fintables bağlantınız var; açılan pencereden birini seçin.";
  case"not_in_manifest":case"not_granted":case"consent_required":return"Bu sayfanın Fintables'a erişimine izin verilmedi. Sayfanın İzinler menüsünden açabilirsiniz.";
  case"server_unavailable":case"rate_limited":return"Fintables şu an yanıt vermiyor. Biraz sonra yeniden deneyin; inen veri kaybolmaz.";
  case"tool_error":if(isQuota(e))return"Fintables günlük sorgu sınırına ulaşıldı. Yarın tekrar basın; inen veri korunur ve kaldığı yerden devam eder.";return"Fintables sorguyu çalıştıramadı: "+(e.message||"");
  default:return"Veri alınamadı ("+(c||(e&&e.message)||"hata")+").";}}
const AUTH=["server_not_connected","needs_reauth","not_in_manifest","not_granted","consent_required","blocked_by_policy","selection_required","capability_disabled"];
const isTimeout=e=>e&&e.code==="tool_error"&&/zaman aşımı|timeout|timed out/i.test(String(e.message||""));
const isUnsafe=e=>e&&e.code==="tool_error"&&/güvenli|sadeleştir|desteklenen|unsafe|not supported/i.test(String(e.message||""));
const isQuota=e=>e&&/istek sınırı|sınırına ulaş|daily limit|quota|rate limit exceeded/i.test(String(e.message||"")+" "+String(e.detail||"")+" "+String(e.body||""));
const splittable=e=>isTimeout(e)||isUnsafe(e);
async function call(tool,input){const run=()=>L.mcp.callTool(SERVER,tool,input,{cache:{staleTime:60000,gcTime:3600000}});
  for(let k=0;;k++){try{return await run();}catch(e){
    if(e&&e.retryable&&k<1){await new Promise(r=>setTimeout(r,Math.min(e.retryAfterMs||2000,10000)+Math.random()*800));continue;}
    if((isTimeout(e)||(e&&e.code==="upstream_error"&&!isQuota(e)))&&k<1){await new Promise(r=>setTimeout(r,2500+Math.random()*2500));continue;}
    throw e;}}}
function parseTable(md){if(!md||typeof md!=="string")return[];const lines=md.split("\n").filter(l=>l.trim().startsWith("|"));if(lines.length<2)return[];
  const cells=l=>{const s=l.trim();return s.slice(1,s.endsWith("|")?-1:undefined).split("|").map(c=>c.trim());};const head=cells(lines[0]);
  return lines.slice(2).map(l=>{const c=cells(l);const o={};head.forEach((h,i)=>{const v=c[i];o[h]=v===undefined||v===""?null:(/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v)?Number(v):v);});return o;});}
async function sql(q,purpose){const r=await call("veri_sorgula",{sql:q,purpose});let p=r.payload;if(typeof p==="string"){try{p=JSON.parse(p);}catch{}}
  if(p&&typeof p==="object"&&"table" in p)return parseTable(p.table);if(typeof p==="string")return parseTable(p);return[];}
const inList=a=>a.map(s=>"'"+String(s).replace(/'/g,"''")+"'").join(",");

/* IndexedDB (yalnızca bu tarayıcı) */
const idb={db:null,open(){return this.db||(this.db=new Promise(res=>{try{const r=indexedDB.open("bist-lab",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);}catch{res(null);}}));},
  async get(k){const d=await this.open();if(!d)return null;return new Promise(res=>{try{const q=d.transaction("kv").objectStore("kv").get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);}catch{res(null);}});},
  async set(k,v){const d=await this.open();if(!d)return false;return new Promise(res=>{try{const t=d.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=()=>res(true);t.onerror=()=>res(false);}catch{res(false);}});}};

