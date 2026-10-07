/* ---------- ortak: IndexedDB anahtar-değer deposu (yalnızca bu tarayıcıda; açılamazsa sessizce boş döner) ---------- */
function makeIdb(name){return{db:null,
  open(){return this.db||(this.db=new Promise(res=>{try{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>res(r.result);r.onerror=()=>res(null);}catch{res(null);}}));},
  async get(k){const d=await this.open();if(!d)return null;return new Promise(res=>{try{const q=d.transaction("kv").objectStore("kv").get(k);q.onsuccess=()=>res(q.result||null);q.onerror=()=>res(null);}catch{res(null);}});},
  /* yazılabildiyse true */
  async set(k,v){const d=await this.open();if(!d)return false;return new Promise(res=>{try{const t=d.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=()=>res(true);t.onerror=()=>res(false);}catch{res(false);}});},
  /* prefix ile başlayan anahtarlardan keep dışındakileri siler */
  async clearOld(keep,prefix){const d=await this.open();if(!d)return;try{const st=d.transaction("kv","readwrite").objectStore("kv");const q=st.getAllKeys();q.onsuccess=()=>q.result.filter(k=>String(k).startsWith(prefix)&&k!==keep).forEach(k=>st.delete(k));}catch{}}
};}
