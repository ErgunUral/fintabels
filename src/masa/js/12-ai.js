/* ---------- AI ---------- */
//@include shared/md.js
function context(){
  const d=S.data,q=d.quote||{};
  return JSON.stringify({hisse:q.hisse_senedi_kodu,unvan:q.unvan,sektor:q.sektor,sonFiyat:q.son_fiyat,gunlukDegisimYuzde:q.gunici_getiri,piyasaDegeri_mrTL:q.piyasa_degeri&&+(q.piyasa_degeri/1e9).toFixed(1),
    teknik:d.tech||"yok",temel:d.fund||"yok",analistler:d.analyst||"yok",fonSahipligiVeAcigaSatis:d.own||"yok",kapBildirimleri:d.kap||"yok",kapDuyguAnalizi:d.kapSent||"yapılmadı",stratejiGeriTesti:d.bt||"yok",bist30Genisligi:S.scan||"tarama yapılmadı",yonTahminModeli:d.model||"eğitilmedi"});
}
const RULES=`Sen Borsa İstanbul hisselerini inceleyen deneyimli bir analistsin. Aşağıdaki JSON, Fintables'tan çekilmiş güncel verilerdir; yalnızca bu verilere dayan, veride olmayan rakam veya olay uydurma. Parasal değerler aksi belirtilmedikçe milyar TL (mr TL). Türkçe yaz, sade ve net ol.`;
let aiCtl=null;
async function runAI(promptTurns,{chat}={}){
  const out=$("aiOut");
  aiCtl=new AbortController();
  $("aiRun").disabled=true;$("aiStop").hidden=false;
  const holder=chat?document.createElement("div"):out;
  if(chat){holder.style.marginTop="16px";holder.style.paddingTop="12px";holder.style.borderTop="1px solid var(--line-soft)";out.appendChild(holder);}
  holder.innerHTML=`<div class="thinking"><span class="dot"></span>Veriler okunuyor ve yorumlanıyor…</div>`;
  try{
    const res=await S.sample(promptTurns,{signal:aiCtl.signal,modelTier:"default",cache:chat?false:{gcTime:1800000},onText:({text})=>{holder.innerHTML=mdRender(text);}});
    holder.innerHTML=mdRender(res.text)+(res.truncated?`<p class="sub">Yanıt uzunluk sınırında kesildi.</p>`:"");
    return res.text;
  }catch(e){
    const keep=e&&e.text?mdRender(e.text):"";
    const msg={cancelled:"",not_granted:"Yapay zeka kullanımına izin verilmedi; bu bölüm devre dışı.",sampling_disabled:"Yapay zeka bu hesapta kullanılamıyor.",rate_limited:"Kullanım sınırına ulaşıldı. Biraz sonra yeniden deneyin.",
      prompt_too_large:"Veri çok büyük geldi; yeniden deneyin.",refused:"Bu istek yanıtlanamadı.",session_expired:"Oturumunuzun süresi doldu; yeniden giriş yapın."}[e&&e.code];
    holder.innerHTML=(e&&e.code==="refused"?"":keep)+(msg===""?"":`<div class="note ${keep?"":"err"}" style="margin-top:8px">${esc(msg||"Yorum oluşturulamadı. Yeniden deneyin.")}</div>`);
    if(e&&(e.code==="not_granted"||e.code==="sampling_disabled")){S.sample=null;$("askForm").hidden=true;}
    return null;
  }finally{$("aiStop").hidden=true;$("aiRun").disabled=!S.sample;aiCtl=null;}
}
$("aiStop").onclick=()=>aiCtl&&aiCtl.abort();
$("aiRun").onclick=async()=>{
  if(!S.sample||!S.data.quote)return;
  const prompt=`${RULES}

Görev: Bu hisse için bütünleşik bir değerlendirme yaz. Şu başlıkları "### " ile kullan:
### Genel görünüm (2-3 cümle)
### Teknik tablo (trend, momentum, destek/direnç seviyelerini rakamlarıyla)
### Temel tablo (büyüme, kârlılık, borçluluk, değerleme çarpanları)
### Analist beklentileri (hedef fiyatlar ve potansiyel)
### Fon sahipliği ve açığa satış (veride fonSahipligiVeAcigaSatis varsa: fon sayısı ve lot değişimini, açığa satış oranını yorumla; bunun takas verisi olmadığını belirt. Yoksa bu başlığı atla.)
### KAP'tan öne çıkanlar (yalnızca anlamlı olanlar; kapDuyguAnalizi varsa puanları kullan)
### Yön tahmin modeli (veride yonTahminModeli varsa: olasılığı, test AUC'sini ve baz oranı birlikte yorumla; AUC 0,52'nin altındaysa sinyalin güvenilmez olduğunu açıkça söyle; stratejiGeriTesti varsa model sepetinin piyasaya göre sonucunu da belirt. Model yoksa bu başlığı atla.)
### Riskler ve izlenecekler (3-5 madde)
### Sonuç (teknik ve temel resmin birbirini destekleyip desteklemediği, kısa vade / orta vade görünümü)
Madde işaretleri için "- " kullan. Toplam 350-500 kelime. Al/sat tavsiyesi verme; olumlu ve olumsuz yönleri dengeli yaz.

VERİ:
${context()}`;
  S.turns=[{role:"user",content:prompt}];
  const text=await runAI(prompt);
  if(text){S.turns.push({role:"assistant",content:text});$("askForm").hidden=false;}
};
$("askForm").addEventListener("submit",async e=>{
  e.preventDefault();const v=$("askIn").value.trim();if(!v||!S.sample||aiCtl)return;
  $("askIn").value="";
  const turns=[...S.turns,{role:"user",content:v+"\n\n(Yalnızca yukarıdaki verilere dayanarak, kısa yanıtla.)"}];
  const out=$("aiOut");const qd=document.createElement("p");qd.style.cssText="margin:16px 0 0;font-weight:600";qd.textContent="Soru: "+v;out.appendChild(qd);
  const text=await runAI(turns,{chat:true});
  if(text){S.turns=turns.concat([{role:"assistant",content:text}]);if(S.turns.length>9)S.turns=[S.turns[0],S.turns[1],...S.turns.slice(-6)];}
});

