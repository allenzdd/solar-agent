// Opaque browser sessions. Persist only hashes, never the password or cookie token.
export function createManagerSessions(store, now) {
  const name='solar_manager_session', lifetime=30*86400000;
  const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const token=request=>(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1)||'';
  const sameOrigin=request=>{
    const origin=request.headers.get('Origin');
    if(request.headers.get('Sec-Fetch-Site')==='cross-site') return false;
    if(!origin) return true;
    try{return new URL(origin).host===new URL(request.url).host;}catch{return false;}
  };
  const cookie=(request,value,maxAge)=>name+'='+value+'; Path=/api/workspace; HttpOnly; SameSite=Strict'+(maxAge!==undefined?'; Max-Age='+maxAge:'')+((new URL(request.url).protocol==='https:'||request.headers.get('X-Forwarded-Proto')==='https')?'; Secure':'');
  return {
    sameOrigin,
    async valid(request,secret){
      const value=token(request);if(!secret||!/^\w{64}$/.test(value))return false;
      const [id,credential]=await Promise.all([hash(value),hash(secret)]);
      return Boolean((await store.read('workspace'))?.managerSessions?.some(s=>s.id===id&&s.credential===credential&&s.expiresAt>now()));
    },
    async issue(request,secret,remember){
      const value=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
      const id=await hash(value), credential=await hash(secret), old=token(request), oldId=old?await hash(old):null;
      await store.update('workspace',current=>{
        const w=current||{revision:0,config:null,lease:null,commands:[]};
        w.managerSessions=(w.managerSessions||[]).filter(s=>s.expiresAt>now()&&s.credential===credential&&s.id!==oldId).slice(-29);
        w.managerSessions.push({id,credential,expiresAt:now()+(remember?lifetime:12*3600000)});return w;
      });
      return cookie(request,value,remember?lifetime/1000:undefined);
    },
    async revoke(request){
      const value=token(request);
      if(value){const id=await hash(value);await store.update('workspace',w=>{if(w)w.managerSessions=(w.managerSessions||[]).filter(s=>s.id!==id);return w||{revision:0,config:null,lease:null,commands:[]};});}
      return cookie(request,'',0);
    }
  };
}
