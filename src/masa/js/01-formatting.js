/* ---------- formatting ---------- */
const nf=(d=2)=>new Intl.NumberFormat("tr-TR",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmt=(v,d=2)=>v==null||!isFinite(v)?"—":nf(d).format(v);
const pct=(v,d=1)=>v==null||!isFinite(v)?"—":(v>0?"+":"")+nf(d).format(v)+"%";
const bn=v=>v==null||!isFinite(v)?"—":nf(1).format(v/1e9);
function big(v){if(v==null||!isFinite(v))return"—";const a=Math.abs(v);
  if(a>=1e12)return nf(2).format(v/1e12)+" trn TL";if(a>=1e9)return nf(1).format(v/1e9)+" mr TL";if(a>=1e6)return nf(1).format(v/1e6)+" mn TL";return nf(0).format(v)+" TL";}
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const istDate=iso=>{const t=Date.parse(iso);return isNaN(t)?null:new Date(t+3*3600e3).toISOString().slice(0,10);};
const trDate=d=>{if(!d)return"—";const[y,m,dd]=d.split("-");return `${dd}.${m}.${y}`;};
const istDateTime=iso=>{const t=Date.parse(iso);if(isNaN(t))return"";const d=new Date(t+3*3600e3).toISOString();return `${trDate(d.slice(0,10))} ${d.slice(11,16)}`;};

