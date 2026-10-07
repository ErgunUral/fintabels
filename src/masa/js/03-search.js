/* ---------- search ---------- */
let sugTimer=null, sugCtl=0;
$("q").addEventListener("input",e=>{
  clearTimeout(sugTimer);
  const v=e.target.value.trim();
  if(v.length<2||!S.mcp){$("sugg").hidden=true;return;}
  sugTimer=setTimeout(()=>suggest(v),350);
});
document.addEventListener("click",e=>{if(!e.target.closest(".search"))$("sugg").hidden=true;});
async function suggest(v){
  const my=++sugCtl;
  const clean=v.replace(/[^\p{L}\p{N} .]/gu,"").slice(0,30);
  if(clean.length<2)return;
  try{
    const rows=await sql(`SELECT hisse_senedi_kodu, unvan FROM hisse_senetleri WHERE hisse_senedi_kodu ILIKE '${clean.toUpperCase()}%' OR unvan ILIKE '%${clean}%' ORDER BY CASE WHEN hisse_senedi_kodu ILIKE '${clean.toUpperCase()}%' THEN 0 ELSE 1 END, hisse_senedi_kodu LIMIT 8`,"Hisse arama önerileri");
    if(my!==sugCtl)return;
    const box=$("sugg");
    if(!rows.length){box.hidden=true;return;}
    box.innerHTML=rows.map(r=>`<button type="button" data-c="${esc(r.hisse_senedi_kodu)}"><b>${esc(r.hisse_senedi_kodu)}</b><span>${esc(r.unvan)}</span></button>`).join("");
    box.hidden=false;
    box.querySelectorAll("button").forEach(b=>b.onclick=()=>{$("q").value=b.dataset.c;box.hidden=true;load(b.dataset.c);});
  }catch{ $("sugg").hidden=true; }
}
$("searchForm").addEventListener("submit",async e=>{
  e.preventDefault();$("sugg").hidden=true;
  const v=$("q").value.trim().toUpperCase().replace(/[^A-Z0-9ÇĞİÖŞÜ]/g,"");
  if(/^[A-Z0-9]{3,6}$/.test(v)){load(v);return;}
  if(v.length>=2)suggest($("q").value.trim());
});

