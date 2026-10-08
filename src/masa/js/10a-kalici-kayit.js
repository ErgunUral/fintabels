/* ---------- Kalıcı kayıt: portföy ve takip listesi hesaba bağlı saklanır ---------- */
/* Tarayıcı deposu (localStorage) silinebilir ve başka cihaza taşınmaz. Bu yüzden portföy ve takip listesi ayrıca
   sayfanın veri deposunda, kişiye özel yolda (data/users/<kimlik>/masa) tutulur; başkası göremez.
   Kural: hesapta kayıt varsa o geçerlidir; yoksa bu tarayıcıdaki veri hesaba yazılır. localStorage anlık yedek olarak kalır. */
const cloudDoc=()=>({v:1,pos:P.pos.map(x=>({c:x.c,q:x.q,m:x.m})),watch:W.list.slice(),rules:{...W.rules},at:new Date().toISOString()});
/* Depodan gelen belgeyi doğrulayıp P ve W'ye uygular; biçimi bozuksa false */
function cloudApply(d){
  if(!d||!Array.isArray(d.pos))return false;
  const ok=c=>typeof c==="string"&&/^[A-Z0-9]{3,6}$/.test(c);
  P.pos=d.pos.filter(x=>x&&ok(x.c)&&x.q>0&&x.m>0).map(x=>({c:x.c,q:Number(x.q),m:Number(x.m)}));
  W.list=(Array.isArray(d.watch)?d.watch:[]).filter(ok).filter((c,i,a)=>a.indexOf(c)===i).slice(0,W_MAX);
  if(d.rules&&typeof d.rules==="object")for(const k of ["rsiLo","rsiHi","pHi","pLo"])if(isFinite(d.rules[k]))W.rules[k]=Number(d.rules[k]);
  if(d.rules&&typeof d.rules.sma==="boolean")W.rules.sma=d.rules.sma;
  return true;
}
function cloudNote(msg){const e=$("pStore");if(e)e.textContent=msg;}
/* saveP/saveW her değişiklikte çağırır; art arda değişiklikler tek yazmada toplanır */
function cloudSave(){
  if(!CLOUD.ready){CLOUD.dirty=true;return;}
  clearTimeout(CLOUD.timer);
  CLOUD.timer=setTimeout(async()=>{
    try{await CLOUD.ref.set(cloudDoc());cloudNote("Portföy ve takip listesi hesabınıza kaydedildi; başka cihazda da açılır.");}
    catch(e){cloudNote("Hesaba kaydedilemedi; değişiklik şimdilik yalnızca bu tarayıcıda."+(e&&e.code==="not_granted"?" Sayfanın İzinler menüsünden veri saklamaya izin verin.":""));}
  },800);
}
async function cloudInit(){
  try{
    const [db,user]=await Promise.all([window.claude.use("db").catch(()=>null),window.claude.use("user").catch(()=>null)]);
    const id=db&&user?await user.id():null;
    if(!id){cloudNote("Portföy yalnızca bu tarayıcıda saklanıyor (hesaba kayıt bu görünümde kullanılamıyor).");return;}
    CLOUD.ref=db.collection("data/users/"+id).doc("masa");
    const snap=await CLOUD.ref.get();
    // yükleme bitmeden yapılmış bir değişiklik varsa o korunur ve hesaba yazılır
    const applied=!CLOUD.dirty&&snap.exists&&cloudApply(snap.data());
    CLOUD.ready=true;
    if(applied){
      try{localStorage.setItem("hm_port",JSON.stringify({pos:P.pos}));localStorage.setItem("hm_watch",JSON.stringify(W));}catch{}
      $("wRsiLo").value=W.rules.rsiLo;$("wRsiHi").value=W.rules.rsiHi;$("wPHi").value=W.rules.pHi;$("wPLo").value=W.rules.pLo;$("wSma").checked=!!W.rules.sma;
      syncStar();refreshPort();refreshWatch();
      cloudNote("Portföy ve takip listesi hesabınızdan yüklendi; başka cihazda da açılır.");
    }else if(P.pos.length||W.list.length||CLOUD.dirty)cloudSave();
    else cloudNote("Portföy ve takip listesi hesabınıza kaydedilir; başka cihazda da açılır.");
  }catch(e){cloudNote("Hesaptaki kayıt okunamadı; portföy şimdilik yalnızca bu tarayıcıda saklanıyor.");}
}
