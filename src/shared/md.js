/* ---------- ortak: yapay zeka çıktısı için küçük Markdown -> HTML (önce kaçışlanır, sonra biçimlenir) ---------- */
function mdRender(t){
  const lines=String(t).split("\n");let h="",inList=false;
  const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/(^|[^*])\*([^*]+)\*/g,"$1<em>$2</em>");
  for(const raw of lines){const l=raw.trimEnd();
    const li=l.match(/^\s*[-*•]\s+(.*)/);
    if(li){if(!inList){h+="<ul>";inList=true;}h+=`<li>${inline(li[1])}</li>`;continue;}
    if(inList){h+="</ul>";inList=false;}
    const hd=l.match(/^#{1,4}\s+(.*)/);
    if(hd){h+=`<h4>${inline(hd[1])}</h4>`;continue;}
    if(l.trim())h+=`<p>${inline(l)}</p>`;}
  if(inList)h+="</ul>";return h;
}
