/* ---------- indicators ---------- */
function sma(a,n){const o=Array(a.length).fill(null);let s=0;for(let i=0;i<a.length;i++){s+=a[i];if(i>=n)s-=a[i-n];if(i>=n-1)o[i]=s/n;}return o;}
function ema(a,n){const o=Array(a.length).fill(null);const k=2/(n+1);let prev=null,s=0,cnt=0;
  for(let i=0;i<a.length;i++){const v=a[i];if(v==null)continue;if(prev==null){s+=v;cnt++;if(cnt===n){prev=s/n;o[i]=prev;}}else{prev=v*k+prev*(1-k);o[i]=prev;}}return o;}
function rsi(c,n=14){const o=Array(c.length).fill(null);let g=0,l=0;
  for(let i=1;i<c.length;i++){const d=c[i]-c[i-1],up=Math.max(d,0),dn=Math.max(-d,0);
    if(i<=n){g+=up;l+=dn;if(i===n){g/=n;l/=n;o[i]=l===0?100:100-100/(1+g/l);}}
    else{g=(g*(n-1)+up)/n;l=(l*(n-1)+dn)/n;o[i]=l===0?100:100-100/(1+g/l);}}return o;}
function macd(c){const e12=ema(c.map((v,i)=>i<14?null:v),12),e26=ema(c,26);const m=c.map((_,i)=>e12[i]!=null&&e26[i]!=null?e12[i]-e26[i]:null);
  const sig=ema(m,9);return{m,sig,h:m.map((v,i)=>v!=null&&sig[i]!=null?v-sig[i]:null)};}
function boll(c,n=20,k=2){const mid=sma(c,n);const up=[],lo=[];for(let i=0;i<c.length;i++){if(mid[i]==null){up.push(null);lo.push(null);continue;}
  let s=0;for(let j=i-n+1;j<=i;j++)s+=(c[j]-mid[i])**2;const sd=Math.sqrt(s/n);up.push(mid[i]+k*sd);lo.push(mid[i]-k*sd);}return{mid,up,lo};}
function atr(h,l,c,n=14){const o=Array(c.length).fill(null);let a=null,s=0;
  for(let i=1;i<c.length;i++){const tr=Math.max(h[i]-l[i],Math.abs(h[i]-c[i-1]),Math.abs(l[i]-c[i-1]));
    if(i<=n){s+=tr;if(i===n){a=s/n;o[i]=a;}}else{a=(a*(n-1)+tr)/n;o[i]=a;}}return o;}
function stoch(h,l,c,n=14,d=3){const k=Array(c.length).fill(null);for(let i=n-1;i<c.length;i++){let hh=-Infinity,ll=Infinity;for(let j=i-n+1;j<=i;j++){hh=Math.max(hh,h[j]);ll=Math.min(ll,l[j]);}k[i]=hh===ll?50:(c[i]-ll)/(hh-ll)*100;}
  const dd=Array(c.length).fill(null);for(let i=0;i<c.length;i++){if(i>=n-1+d-1){let s=0;for(let j=i-d+1;j<=i;j++)s+=k[j];dd[i]=s/d;}}return{k,d:dd};}
function swings(h,l,w=5,look=160){const n=h.length,st=Math.max(w,n-look),hi=[],lo=[];
  for(let i=st;i<n-w;i++){let isH=true,isL=true;for(let j=i-w;j<=i+w;j++){if(j===i)continue;if(h[j]>h[i])isH=false;if(l[j]<l[i])isL=false;}if(isH)hi.push(h[i]);if(isL)lo.push(l[i]);}
  return{hi,lo};}
function cluster(levels,tol){const s=[...levels].sort((a,b)=>a-b),out=[];for(const v of s){const last=out[out.length-1];if(last&&Math.abs(v-last.v)/last.v<tol){last.v=(last.v*last.n+v)/(last.n+1);last.n++;}else out.push({v,n:1});}return out;}

