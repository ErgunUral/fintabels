/* ---------- ortak: Fintables sorgu katmanı ----------
   Sayfa kendi call(tool,input) işlevini tanımlar (yeniden deneme ve önbellek ayarı sayfaya özgüdür);
   buradaki sql() onu kullanır. Fintables sonucu Markdown tablo metni olarak döner. */
const isQuota=e=>!!e&&/istek sınırı|sınırına ulaş|daily limit|quota|rate limit exceeded/i.test(String(e.message||"")+" "+String(e.detail||"")+" "+String(e.body||""));
function parseTable(md){
  if(!md||typeof md!=="string")return[];
  const lines=md.split("\n").filter(l=>l.trim().startsWith("|"));
  if(lines.length<2)return[];
  const cells=l=>{const s=l.trim();return s.slice(1,s.endsWith("|")?-1:undefined).split("|").map(c=>c.trim());};
  const head=cells(lines[0]);
  return lines.slice(2).map(l=>{const c=cells(l);const o={};head.forEach((h,i)=>{const v=c[i];
    if(v===undefined||v===""){o[h]=null;return;}
    o[h]=/^-?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(v)?Number(v):(v==="true"?true:v==="false"?false:v);});return o;});
}
async function sql(q,purpose){
  const r=await call("veri_sorgula",{sql:q,purpose});
  let p=r.payload;
  if(typeof p==="string"){try{p=JSON.parse(p);}catch{ }}
  if(p&&typeof p==="object"&&"table" in p)return parseTable(p.table);
  if(typeof p==="string")return parseTable(p);
  return[];
}
const inList=a=>a.map(s=>"'"+String(s).replace(/'/g,"''")+"'").join(",");
