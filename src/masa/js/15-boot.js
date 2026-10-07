/* ---------- boot ---------- */
(async function boot(){
  if(!window.claude||typeof window.claude.use!=="function"){
    const n=$("pageNote");n.hidden=false;setNote(n,"Bu sayfa verileri Fintables bağlantınız üzerinden çeker. Çalışması için claude.ai içinde açılmalı.");$("qTitle").textContent="Bağlantı yok";return;
  }
  const [mcp,sample]=await Promise.all([window.claude.use("mcp").catch(()=>null),window.claude.use("sample").catch(()=>null)]);
  S.mcp=mcp;S.sample=sample;
  if(!mcp){const n=$("pageNote");n.hidden=false;setNote(n,"Bu görünümde Fintables bağlantısı kullanılamıyor. Sayfayı claude.ai içinde açın ve Fintables bağlayıcısının ekli olduğundan emin olun.");$("qTitle").textContent="Bağlantı yok";return;}
  let last="ASELS";try{const v=localStorage.getItem("hm_last");if(v&&/^[A-Z0-9]{3,6}$/.test(v))last=v;}catch{}
  $("q").value=last;
  load(last,false);
  $("mTrain").disabled=false;$("scRun").disabled=false;
  if(ML.res)renderModel();
  refreshWatch();refreshPort();
})();
})();
