/* ---------- ortak: biçimlendirme ve küçük yardımcılar (iki sayfada aynı) ---------- */
const nf=(d=2)=>new Intl.NumberFormat("tr-TR",{minimumFractionDigits:d,maximumFractionDigits:d});
const fmt=(v,d=2)=>v==null||!isFinite(v)?"—":nf(d).format(v);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
/* UTC zaman damgasını İstanbul takvim gününe çevirir (YYYY-MM-DD) */
const istDate=iso=>{const t=Date.parse(iso);return isNaN(t)?null:new Date(t+3*3600e3).toISOString().slice(0,10);};
/* "YYYY-MM-DD" -> "GG.AA.YYYY"; "YYYY-MM" -> "AA.YYYY" */
const trDate=d=>{if(!d)return"—";const[y,m,dd]=d.split("-");return dd?`${dd}.${m}.${y}`:`${m}.${y}`;};
const tick=()=>new Promise(r=>setTimeout(r,0));
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
function niceStep(r){if(!(r>0))return 1;const p=Math.pow(10,Math.floor(Math.log10(r)));const f=r/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p;}
