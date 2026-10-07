/* ---------------- GRAFİK ---------------- */
function css(n){return getComputedStyle(document.documentElement).getPropertyValue(n).trim();}
function niceStep(r){if(!(r>0))return 1;const p=Math.pow(10,Math.floor(Math.log10(r)));const f=r/p;return(f<=1?1:f<=2?2:f<=5?5:10)*p;}
function lineChart(el,months,series,{log=false,h=260,area=false,fmtY=v=>pct(v,0)}={}){
  const W=760,H=h,pl=56,pr=12,pt=10,pb=24;const n=months.length;const vals=series.flatMap(s=>s.data.filter(isNum));if(!vals.length){el.innerHTML="";return;}
  let lo=Math.min(...vals),hi=Math.max(...vals);if(area){hi=0;}const tf=log?v=>Math.log(v):v=>v;let a=tf(lo),b=tf(hi);const pad=(b-a)*0.06||0.05;a-=pad;if(!area)b+=pad;
  const X=i=>pl+i/(n-1||1)*(W-pl-pr),Y=v=>pt+(b-tf(v))/(b-a)*(H-pt-pb);
  let g="";
  if(log){const step=[1.5,2,3,5,10,20,50].find(s=>Math.log(hi/lo)/Math.log(s)<=6)||100;let v=Math.pow(step,Math.floor(Math.log(lo)/Math.log(step)));for(;v<=hi*1.01;v*=step){if(v<lo*0.95)continue;const y=Y(v);g+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="var(--line-soft)"/><text x="${pl-6}" y="${y+3.5}" text-anchor="end" font-size="10" fill="var(--faint)" font-family="IBM Plex Mono,monospace">${v>=10?nf(0).format(v)+"×":nf(1).format(v)+"×"}</text>`;}}
  else{const st=niceStep((hi-lo)/4||0.1);for(let v=Math.ceil(lo/st)*st;v<=hi+1e-9;v+=st){const y=Y(v);g+=`<line x1="${pl}" x2="${W-pr}" y1="${y}" y2="${y}" stroke="var(--line-soft)"/><text x="${pl-6}" y="${y+3.5}" text-anchor="end" font-size="10" fill="var(--faint)" font-family="IBM Plex Mono,monospace">${fmtY(v)}</text>`;}}
  const yrs=[];months.forEach((m,i)=>{if(m.endsWith("-01"))yrs.push(i);});const every=Math.ceil(yrs.length/9)||1;
  yrs.forEach((i,k)=>{if(k%every)return;g+=`<text x="${X(i)}" y="${H-6}" text-anchor="middle" font-size="10" fill="var(--faint)" font-family="IBM Plex Mono,monospace">${months[i].slice(0,4)}</text>`;});
  let p="";series.forEach(s=>{let d="",pen=false;s.data.forEach((v,i)=>{if(!isNum(v)){pen=false;return;}d+=(pen?"L":"M")+X(i).toFixed(1)+","+Y(v).toFixed(1);pen=true;});
    if(area)p+=`<path d="${d}L${X(n-1)},${Y(0)}L${X(0)},${Y(0)}Z" fill="${s.color}" opacity=".18"/>`;p+=`<path d="${d}" fill="none" stroke="${s.color}" stroke-width="${s.w||1.6}" stroke-linejoin="round"/>`;});
  el.innerHTML=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block" role="img" aria-label="Grafik">${g}${p}</svg>`;
}

