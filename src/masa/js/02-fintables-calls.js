/* ---------- Fintables calls ---------- */
//@include shared/fintables.js
function errCopy(e){
  const c=e&&e.code;
  if(isQuota(e))return"Fintables günlük sorgu sınırına ulaşıldı (Fintables tarafındaki hesap limiti). Yarın yeniden deneyin.";
  switch(c){
    case"server_not_connected":return"Fintables bağlantısı bulunamadı. claude.ai'de Ayarlar → Bağlayıcılar bölümünden Fintables'ı ekleyin, sonra sayfayı yenileyin.";
    case"needs_reauth":return"Fintables oturumunuzun süresi dolmuş. Ayarlar → Bağlayıcılar bölümünden Fintables'a yeniden bağlanın.";
    case"selection_required":return"Birden fazla Fintables bağlantınız var. Açılan pencereden birini seçin.";
    case"not_in_manifest":case"not_granted":case"consent_required":return"Bu sayfanın Fintables'a erişimine izin verilmedi. Sayfanın İzinler menüsünden açabilirsiniz.";
    case"blocked_by_policy":case"approval_required":return"Kuruluşunuzun politikası bu Fintables aracını engelliyor.";
    case"server_unavailable":case"rate_limited":return"Fintables şu an yanıt vermiyor. Biraz sonra yeniden deneyin.";
    case"capability_disabled":case"capability_removed":return"Bu görünüm bağlayıcı çağrılarını desteklemiyor. Sayfayı claude.ai içinde açın.";
    case"tool_error":return"Fintables sorguyu çalıştıramadı: "+(e.message||"bilinmeyen hata");
    default:return"Veri alınamadı ("+(c||"hata")+"). Yeniden denemek için Analiz et'e basın.";
  }
}
async function call(tool,input){
  const run=()=>S.mcp.callTool(SERVER,tool,input,{cache:{staleTime:60000,gcTime:600000}});
  try{return await run();}
  catch(e){
    if(e&&e.retryable){await new Promise(r=>setTimeout(r,Math.min(e.retryAfterMs||1500,8000)+Math.random()*600));return await run();}
    throw e;
  }
}

