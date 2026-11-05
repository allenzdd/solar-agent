import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createWorkspaceApi} from '../server/workspace.mjs';
const env={MANAGER_TOKEN:'manager-test-secret',APP_CONTROL_TOKEN:'control-test'};
test('HTTP fallback retains the same publisher identity after reload',()=>{
 const source=fs.readFileSync(new URL('../public/js/manager-bridge.js',import.meta.url),'utf8');
 const chunk=source.slice(source.indexOf("  let token ="),source.indexOf('  const status'))+'\nglobalThis.savedOwner=owner;';
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const run=()=>{const c=vm.createContext({sessionStorage:storage,crypto:{}});vm.runInContext(chunk,c);return c.savedOwner;};
 assert.equal(run(),run());assert.ok(values.get('solar_manager_owner'));
});
function store(){let document=null;return {read:async()=>structuredClone(document),update:async(k,f)=>(document=f(structuredClone(document)),structuredClone(document))};}
function req(method='GET',{cookie,token,remember=true,origin,url='https://solar.test'}={}){return new Request(url+'/api/workspace/session',{method,headers:{...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{}),...(origin?{Origin:origin}:{})},...(method==='POST'?{body:JSON.stringify({remember})}:{})});}
test('remember cookie survives API recreation, expires, and stores no plaintext credential',async()=>{
 const s=store();let now=1000;const api=createWorkspaceApi(s,{now:()=>now});
 assert.equal((await api(req('POST',{token:'bad'}),env)).status,401);
 const login=await api(req('POST',{token:env.MANAGER_TOKEN}),env);assert.equal(login.status,200);
 const header=login.headers.get('set-cookie'),cookie=header.split(';')[0];assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);assert.match(header,/Secure/);assert.match(header,/Max-Age=2592000/);
 const persisted=JSON.stringify(await s.read());assert.ok(!persisted.includes(env.MANAGER_TOKEN));assert.ok(!persisted.includes(cookie.split('=')[1]));
 assert.equal((await createWorkspaceApi(s,{now:()=>now})(req('GET',{cookie}),env)).status,200);
 assert.equal((await api(req('GET',{cookie}),{...env,MANAGER_TOKEN:'changed'})).status,401);
 now+=30*86400000;assert.equal((await api(req('GET',{cookie}),env)).status,401);
});
test('HTTP works with a host-only cookie, session-only mode omits persistence, logout revokes replay',async()=>{
 const s=store(),api=createWorkspaceApi(s);const login=await api(req('POST',{token:env.MANAGER_TOKEN,remember:false,url:'http://solar.test'}),env);
 const header=login.headers.get('set-cookie'),cookie=header.split(';')[0];assert.doesNotMatch(header,/Secure|Domain|Max-Age/);
 const cross=await api(req('DELETE',{cookie,origin:'https://evil.test'}),env);assert.equal(cross.status,403);
 assert.equal((await api(req('GET',{cookie}),env)).status,200);
 const logout=await api(req('DELETE',{cookie}),env);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
 assert.equal((await api(req('GET',{cookie}),env)).status,401);
});
test('cookie authorizes management mutations only from the same origin and never replaces APP control credentials',async()=>{
 const api=createWorkspaceApi(store());const login=await api(req('POST',{token:env.MANAGER_TOKEN}),env);const cookie=login.headers.get('set-cookie').split(';')[0];
 const lease=origin=>new Request('https://solar.test/api/workspace/lease',{method:'POST',headers:{Cookie:cookie,Origin:origin},body:JSON.stringify({owner:'browser'})});
 assert.equal((await api(lease('https://evil.test'),env)).status,403);
 assert.equal((await api(lease('https://solar.test'),env)).status,200);
 assert.equal((await api(req('POST',{token:env.APP_CONTROL_TOKEN}),env)).status,401);
});
