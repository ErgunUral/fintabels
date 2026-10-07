/* ---------------- BAŞLAT ---------------- */
$("dSync").onclick=syncData;
(async function boot(){
  if(!window.claude||typeof window.claude.use!=="function"){$("dState").textContent="Bu sayfa claude.ai içinde açılmalı";return;}
  const [mcp,sample]=await Promise.all([window.claude.use("mcp").catch(()=>null),window.claude.use("sample").catch(()=>null)]);
  L.mcp=mcp;L.sample=sample;if(!sample)$("aiRun").hidden=true;
  if(!mcp){$("dState").textContent="Fintables bağlantısı bu görünümde kullanılamıyor";$("dSub").textContent="Sayfayı claude.ai içinde açın ve Fintables bağlayıcısının ekli olduğundan emin olun.";return;}
  $("dSync").disabled=false;
  const raw=await idb.get("raw");
  if(raw&&raw.bars&&Object.keys(raw.bars).length>50){L.raw=raw;L.DB=buildDB(raw);showDataState();$("run").disabled=false;
    if(raw.lastMonth<curMonth()||Date.now()-Date.parse(raw.lastSync)>3*864e5)$("dSub").textContent+=" · yeni veri var, Güncelle'ye basın";}
})();
