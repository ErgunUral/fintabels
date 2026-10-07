/* ---------- KAP duygu analizi ---------- */
const SENT={"2":["Çok olumlu","pos"],"1":["Olumlu","pos"],"0":["Nötr","neu"],"-1":["Olumsuz","neg"],"-2":["Çok olumsuz","neg"]};
let kapCtl=null;
async function scoreKap(){
  const items=S.data.kapItems,code=S.code;if(!items||!items.length||!S.sample||kapCtl)return;
  const btn=$("kapSent");btn.disabled=true;$("kapSum").innerHTML=`<span class="thinking"><span class="dot"></span>Bildirim metinleri okunuyor…</span>`;
  kapCtl=new AbortController();
  try{
    const r=await call("dokuman_chunk_yukle",{ids:items.map(n=>String(n.id)),purpose:`${code} KAP bildirimlerinin içeriği (duygu analizi)`});
    let p=r.payload;if(typeof p==="string"){try{p=JSON.parse(p);}catch{p=[];}}
    const byId=Object.fromEntries((Array.isArray(p)?p:[]).map(x=>[String(x.id),String(x.content||"")]));
    const docs=items.map((n,i)=>`[${i}] ${istDate(n.yayinlanma_tarihi_utc)} · ${n.document_title||n.kap_bildirim_konu}\n${(byId[String(n.id)]||n.highlight||"").replace(/\|[\s-]*\|/g," ").replace(/\s+/g," ").slice(0,1600)}`).join("\n\n");
    if(S.code!==code)return;
    $("kapSum").innerHTML=`<span class="thinking"><span class="dot"></span>Yapay zeka bildirimleri puanlıyor…</span>`;
    const out=await S.sample.json(`Aşağıda ${code} hissesine ait KAP bildirimleri var. Her bildirimin hisse fiyatı ve şirketin değeri açısından muhtemel etkisini puanla:
2 = çok olumlu (büyük sözleşme, güçlü kâr artışı, değer yaratan önemli gelişme), 1 = olumlu, 0 = nötr/rutin (genel kurul, rutin duyuru, sermaye piyasası aracı işlemleri, tekrar eden idari bildirim), -1 = olumsuz, -2 = çok olumsuz (önemli dava/ceza, büyük zarar, sözleşme iptali, sulandırıcı sermaye artırımı).
Tutarları şirketin ölçeğine göre değerlendir. Metinde olmayan bilgi ekleme.
Yalnızca şu biçimde bir JSON dizisi döndür: [{"i":0,"skor":1,"ozet":"en fazla 15 kelimelik Türkçe özet"}]

BİLDİRİMLER:
${docs}`,{modelTier:"quick",signal:kapCtl.signal,cache:{gcTime:21600000}});
    if(S.code!==code)return;
    const arr=(Array.isArray(out)?out:[]).filter(x=>x&&Number.isInteger(Number(x.i)));
    const res=items.map((n,i)=>{const f=arr.find(x=>Number(x.i)===i);const sk=f?Math.max(-2,Math.min(2,Math.round(Number(f.skor)||0))):null;return{tarih:istDate(n.yayinlanma_tarihi_utc),baslik:n.document_title||n.kap_bildirim_konu,skor:sk,ozet:f?String(f.ozet||"").slice(0,160):""};});
    res.forEach((x,i)=>{const li=document.querySelector(`#news li[data-i="${i}"]`);if(!li||x.skor==null)return;const s=SENT[String(x.skor)];
      li.querySelector(".sent").innerHTML=`<span class="pill ${s[1]}">${s[0]}</span>`;if(x.ozet)li.querySelector(".oz").textContent=x.ozet;});
    const sc=res.filter(x=>x.skor!=null);const avg=sc.reduce((a,b)=>a+b.skor,0)/(sc.length||1);
    const cnt=k=>sc.filter(x=>Math.sign(x.skor)===k).length;
    $("kapSum").innerHTML=`Haber akışı ortalaması <b class="num" style="color:${avg>0.2?"var(--up)":avg<-0.2?"var(--down)":"inherit"}">${(avg>0?"+":"")+fmt(avg,2)}</b> (−2 ile +2 arası) · ${cnt(1)} olumlu, ${cnt(0)} nötr, ${cnt(-1)} olumsuz`;
    S.data.kapSent={ortalamaSkor:+avg.toFixed(2),olumlu:cnt(1),notr:cnt(0),olumsuz:cnt(-1),bildirimler:res};
  }catch(e){
    if(e&&e.code==="cancelled"){$("kapSum").textContent="";}
    else $("kapSum").innerHTML=`<span class="note err" style="display:inline-block">${esc(e&&e.code&&/^(not_granted|sampling_disabled|rate_limited|invalid_json|refused)$/.test(e.code)?({not_granted:"Yapay zeka kullanımına izin verilmedi.",sampling_disabled:"Yapay zeka bu hesapta kullanılamıyor.",rate_limited:"Kullanım sınırına ulaşıldı, biraz sonra deneyin.",invalid_json:"Yanıt okunamadı; yeniden deneyin.",refused:"Bu istek yanıtlanamadı."})[e.code]:errCopy(e))}</span>`;
  }finally{kapCtl=null;btn.disabled=!S.sample;}
}
$("kapSent").onclick=scoreKap;

