/* ---------- Sahiplik: fon portföy raporları ve açığa satış ---------- */
/* Takas (MKK) verisi bağlayıcıda yok; bu bölüm onun yerine fonların aylık portföy raporlarını ve günlük açığa satışı gösterir. */
const AYLAR=["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const FON_TIP={mutual:"Yatırım fonu",pension:"Emeklilik",exchange:"BYF",realestate:"Gayrimenkul"};
const ayAd=m=>`${AYLAR[m.ay-1]} ${m.yil}`;
/* Aylık toplamlar (yeni -> eski). Raporlar ayı izleyen ayın ilk 10 gününde gelir. En yeni ay bir önceki takvim
   ayıysa, ayın 15'i geçmemişse ve fon sayısı önceki ayın %85'inin altındaysa "eksik" sayılır; bir önceki ay esas alınır. */
function ownMonths(rows,today){
  const M=rows.filter(r=>r.ay>=1&&r.ay<=12&&r.yil>2000).map(r=>({k:r.yil*100+r.ay,yil:r.yil,ay:r.ay,n:r.fon_sayisi||0,lot:r.toplam_lot||0})).sort((a,b)=>b.k-a.k);
  const y=Number(today.slice(0,4)),m=Number(today.slice(5,7)),lastK=m===1?(y-1)*100+12:y*100+m-1;
  const partial=M.length>1&&M[0].k===lastK&&Number(today.slice(8,10))<=15&&M[0].n<0.85*M[1].n;
  return{M,partial,cur:M[partial?1:0]||null,prev:M[partial?2:1]||null};
}
/* rows yeni -> eski. Kaynak yalnızca açığa satış yapılan günleri içerir; oran o günlerin toplam hacmine göredir. */
function shortStats(rows){
  const R=rows.filter(r=>r.toplam_islem_hacmi_tl>0).map(r=>({d:String(r.tarih_europe_istanbul).slice(0,10),s:r.aciga_satis_hacmi_tl||0,v:r.toplam_islem_hacmi_tl,p:r.ortalama_aciga_satis_fiyati}));
  const ratio=n=>{const a=R.slice(0,n);if(!a.length)return null;return a.reduce((x,r)=>x+r.s,0)/a.reduce((x,r)=>x+r.v,0)*100;};
  return{R,r5:ratio(5),r20:ratio(20)};
}
async function loadOwn(code){
  const tiles=$("ownTiles").children,setT=(i,v,sub)=>{tiles[i].querySelector(".val").textContent=v;tiles[i].querySelector(".sub").textContent=sub||"";};
  const skel=(id,n,msg)=>{$(id).innerHTML=`<tr><td colspan="${n}" class="skel">${msg}</td></tr>`;};
  for(let i=0;i<4;i++)setT(i,"—","");$("ownStamp").textContent="";S.data.own=null;
  skel("ownFundsBody",5,"Yükleniyor…");skel("ownMonthsBody",4,"Yükleniyor…");skel("ownShortBody",4,"Yükleniyor…");
  const today=istDate(new Date().toISOString());
  const d0=new Date(Date.UTC(Number(today.slice(0,4)),Number(today.slice(5,7))-1-14,1)),fy=d0.getUTCFullYear(),fm=d0.getUTCMonth()+1;
  const shortFrom=new Date(Date.parse(today)-45*864e5).toISOString().slice(0,10);
  const JOIN=`FROM fon_portfoy_dagilim_raporu_sembol_agirliklari a JOIN fon_portfoy_dagilim_raporlari r ON r.fon_portfoy_dagilim_raporu_id = a.fon_portfoy_dagilim_raporu_id`;
  try{
    const [agg,sh]=await Promise.all([
      sql(`SELECT r.yil, r.ay, COUNT(DISTINCT r.fon_kodu) AS fon_sayisi, SUM(a.fondaki_lot) AS toplam_lot ${JOIN} WHERE a.fon_kodu = '${code}' AND (r.yil > ${fy} OR (r.yil = ${fy} AND r.ay >= ${fm})) AND r.ay >= 1 AND r.ay <= 12 GROUP BY r.yil, r.ay ORDER BY r.yil DESC, r.ay DESC LIMIT 20`,`${code} fon sahipliği aylık seyir`),
      sql(`SELECT tarih_europe_istanbul, aciga_satis_hacmi_tl, toplam_islem_hacmi_tl, ortalama_aciga_satis_fiyati FROM gunluk_aciga_satis_istatistikleri WHERE hisse_senedi_kodu = '${code}' AND tarih_europe_istanbul >= DATE '${shortFrom}' ORDER BY tarih_europe_istanbul DESC LIMIT 40`,`${code} açığa satış istatistikleri`)]);
    if(S.code!==code)return;
    const O=ownMonths(agg,today),SS=shortStats(sh),cur=O.cur,prev=O.prev;
    const cap=S.data.quote&&S.data.quote.odenmis_sermaye;
    const lotChg=cur&&prev&&prev.lot>0?(cur.lot/prev.lot-1)*100:null,capPct=cur&&cap>0?cur.lot/cap*100:null;
    if(cur){
      setT(0,nf(0).format(cur.n),ayAd(cur)+(prev?` · önceki aya göre ${cur.n-prev.n>0?"+":""}${cur.n-prev.n}`:""));
      setT(1,nf(1).format(cur.lot/1e6)+" mn",(lotChg!=null?`Önceki aya göre ${pct(lotChg)}`:"")+(capPct!=null?`${lotChg!=null?" · ":""}sermayenin ≈ %${fmt(capPct,2)}'i`:""));
      $("ownStamp").textContent=O.partial?`${ayAd(O.M[0])} raporları henüz tamamlanmadı (${O.M[0].n} fon); rakamlar ${ayAd(cur)} dönemine göre`:`Son rapor dönemi ${ayAd(cur)}`;
      $("ownMonthsBody").innerHTML=O.M.slice(0,9).map((m,i)=>{const p=O.M[i+1],part=O.partial&&i===0,ch=!part&&p&&p.lot>0?(m.lot/p.lot-1)*100:null;
        return`<tr><td>${ayAd(m)}${part?' <span class="pill warn">Eksik</span>':""}</td><td class="r num">${nf(0).format(m.n)}</td><td class="r num">${nf(1).format(m.lot/1e6)}</td><td class="r num" style="color:${ch>0?"var(--up)":ch<0?"var(--down)":"inherit"}">${pct(ch)}</td></tr>`;}).join("");
    }else{skel("ownMonthsBody",4,"Son 14 ayda bu hisseyi raporlayan fon yok.");skel("ownFundsBody",5,"Fon pozisyonu bulunamadı.");}
    if(SS.R.length){
      setT(2,"%"+fmt(SS.r5,1),`Açığa satış yapılan son ${Math.min(5,SS.R.length)} gün`+(SS.R.length>5?` · ${Math.min(20,SS.R.length)} gün ort. %${fmt(SS.r20,1)}`:""));
      setT(3,big(SS.R[0].s),`${trDate(SS.R[0].d)}${SS.R[0].p?` · ort. fiyat ${fmt(SS.R[0].p)}`:""}`);
      $("ownShortBody").innerHTML=SS.R.slice(0,6).map(r=>`<tr><td class="num">${trDate(r.d)}</td><td class="r num">${big(r.s)}</td><td class="r num">%${fmt(r.s/r.v*100,1)}</td><td class="r num">${fmt(r.p)}</td></tr>`).join("");
    }else skel("ownShortBody",4,"Son 45 günde açığa satış kaydı yok (izin verilmeyen ya da açığa satılmayan hisse).");
    let funds=[];
    if(cur){
      const top=await sql(`SELECT r.fon_kodu, f.unvan, f.fon_tipi, a.yuzdesel_agirlik, a.fondaki_lot ${JOIN} LEFT JOIN fonlar f ON f.fon_kodu = r.fon_kodu WHERE a.fon_kodu = '${code}' AND r.yil = ${cur.yil} AND r.ay = ${cur.ay} AND a.fondaki_lot > 0 ORDER BY a.fondaki_lot DESC LIMIT 12`,`${code} hisseyi en çok tutan fonlar`);
      if(S.code!==code)return;
      const pm={};
      if(prev&&top.length){const pr=await sql(`SELECT r.fon_kodu, a.fondaki_lot ${JOIN} WHERE a.fon_kodu = '${code}' AND r.yil = ${prev.yil} AND r.ay = ${prev.ay} AND r.fon_kodu IN (${inList(top.map(x=>x.fon_kodu))}) LIMIT 40`,`${code} fon pozisyonlarının önceki ayı`);
        if(S.code!==code)return;pr.forEach(x=>{pm[x.fon_kodu]=(pm[x.fon_kodu]||0)+(x.fondaki_lot||0);});}
      funds=top.map(x=>({fon:x.fon_kodu,unvan:x.unvan,tip:FON_TIP[x.fon_tipi]||"—",lot:x.fondaki_lot,w:x.yuzdesel_agirlik,ch:pm[x.fon_kodu]>0?(x.fondaki_lot/pm[x.fon_kodu]-1)*100:null,yeni:!!prev&&!(pm[x.fon_kodu]>0)}));
      $("ownFundsBody").innerHTML=funds.length?funds.map(x=>`<tr><td><b class="num">${esc(x.fon)}</b><div class="sub" style="max-width:38ch;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(x.unvan||"")}">${esc(x.unvan||"")}</div></td><td>${esc(x.tip)}</td><td class="r num">${nf(0).format(x.lot)}</td><td class="r num">${x.w!=null?"%"+fmt(x.w,1):"—"}</td><td class="r num" style="color:${x.ch>0?"var(--up)":x.ch<0?"var(--down)":"inherit"}">${x.yeni?'<span class="pill pos">Yeni</span>':pct(x.ch)}</td></tr>`).join(""):`<tr><td colspan="5" class="skel">Fon pozisyonu bulunamadı.</td></tr>`;
    }
    const r1=v=>v==null?null:+v.toFixed(1);
    S.data.own={not:"Takas (MKK) verisi değildir; fon portföy raporları ve açığa satış istatistikleridir",
      fonlar:cur?{donem:ayAd(cur),sonAyEksik:O.partial,tutanFonSayisi:cur.n,oncekiAyFonSayisi:prev?prev.n:null,toplamLot_mn:r1(cur.lot/1e6),lotDegisimYuzde:r1(lotChg),sermayeOraniYuzde:capPct==null?null:+capPct.toFixed(2),
        enBuyukler:funds.slice(0,6).map(x=>({fon:x.fon,tur:x.tip,lot_mn:+(x.lot/1e6).toFixed(2),fonIciAgirlikYuzde:x.w,lotDegisimYuzde:x.yeni?"yeni":r1(x.ch)}))}:"yok",
      acigaSatis:SS.R.length?{son5GunOraniYuzde:r1(SS.r5),son20GunOraniYuzde:r1(SS.r20),sonGun:SS.R[0].d,sonGunHacim_mnTL:r1(SS.R[0].s/1e6)}:"yok"};
  }catch(e){if(S.code===code){const m=`<div class="note err">${esc(errCopy(e))}</div>`;$("ownFundsBody").innerHTML=`<tr><td colspan="5">${m}</td></tr>`;skel("ownMonthsBody",4,"—");skel("ownShortBody",4,"—");}}
}
