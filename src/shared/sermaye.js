/* ---------- ortak: sermaye işlemi (bölünme/bedelsiz) kuralı ----------
   Aday fiyat sıçramalarından sermaye işlemi sayılacakları seçer; eşiği (günlükte ±%12 gibi) çağıran belirler.
   ev: [{d:"YYYY-MM-DD", pd:önceki işlem günü, r:kapanış/önceki kapanış}]
   Sayılmayanlar: araya 10 günden uzun ara girmiş sıçramalar (işlem durması sonrası gerçek fiyat hareketi)
   ve 14 gün içinde tersine dönen sıçramalar (veri hatası ya da serbest marjlı gerçek hareket). */
function corporateEvents(ev){
  return ev.filter(e=>(Date.parse(e.d)-Date.parse(e.pd))/864e5<=10&&
    !ev.some(o=>o!==e&&Math.abs(Date.parse(o.d)-Date.parse(e.d))<=14*864e5&&Math.abs(Math.log(o.r*e.r))<0.2));
}
