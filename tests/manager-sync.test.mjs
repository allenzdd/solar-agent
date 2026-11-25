import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/js/manager-bridge.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function setup(upload,renew=async()=>({})) {
  let clock=100000,leases=0;
  const calls=[],nodes=new Map(),timers=[];
  const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',checked:true,hidden:false,addEventListener(){},replaceChildren(){},append(){}});return nodes.get(id);};
  const storage={getItem(){return null;},setItem(){},removeItem(){}};
  const context=vm.createContext({
    Date:class extends Date{static now(){return clock;}},crypto:{randomUUID:()=> 'browser-one'},AbortSignal,
    sessionStorage:storage,localStorage:storage,location:{reload(){}},setInterval:callback=>timers.push(callback),
    document:{getElementById:node,querySelectorAll:()=>[],body:{dataset:{},removeAttribute(){}}},
    SIMTIME:{},PLANTS:[],lastTickWall:0,simInit(){},savePlantCfg(){},simRender(){},
    WorkspaceClient:{async request(path,options={}){
      calls.push({path,...options});
      if(path==='session')return{config:[],appControlToken:''};
      if(path==='lease'){leases++;return leases===1?{}:renew(options);}
      if(path==='state'&&options.method)return upload(options);
      if(path==='state')return{snapshot:null};
      if(path==='commands')return{commands:[]};
      return{};
    }},
  });
  vm.runInContext(source,context);await tick();
  return{context,calls,nodes,timers,advance:ms=>{clock+=ms;},publish:snapshot=>context.ManagerBridge.publish(snapshot)};
}
const error=status=>Object.assign(new Error('test error'),{status});
test('snapshot POST renews an expired lease without requesting takeover',async()=>{
  let attempts=0;const u=await setup(async()=>{if(++attempts===1)throw error(409);return{};});
  u.publish({version:'newest'});await tick();
  const uploads=u.calls.filter(c=>c.path==='state'&&c.method);
  assert.equal(uploads.length,2);assert.ok(uploads.every(c=>c.method==='POST'));
  const renewal=u.calls.filter(c=>c.path==='lease').at(-1);
  assert.equal(renewal.data.owner,'browser-one');assert.equal(renewal.data.takeover,undefined);
  assert.match(u.nodes.get('manager-sync').textContent,/共享数据已更新/);
});
test('active publisher conflict still requires explicit takeover',async()=>{
  const u=await setup(async()=>{throw error(409);},async()=>{throw error(409);});
  u.publish({v:1});await tick();
  assert.equal(u.nodes.get('manager-access').hidden,false);
  const count=u.calls.length;u.advance(5000);u.publish({v:2});await tick();assert.equal(u.calls.length,count);
});
test('upload failures back off and retry the latest pending snapshot',async()=>{
  let attempts=0;const u=await setup(async()=>{if(++attempts===1)throw error(408);return{};});
  u.publish({v:1});await tick();
  for(let i=2;i<=4;i++){u.advance(500);u.publish({v:i});await tick();}
  assert.equal(attempts,1);
  u.advance(1501);for(const timer of u.timers)timer();await tick();
  assert.equal(attempts,2);
  assert.equal(u.calls.filter(c=>c.path==='state'&&c.method).at(-1).data.snapshot.v,4);
});

test('large snapshot upload is losslessly compressed below the observed interrupted-upload size',async()=>{
  let request;
  const c=vm.createContext({Blob,Response,CompressionStream,fetch:async(url,options)=>{request=options;return Response.json({ok:true});}});
  vm.runInContext(fs.readFileSync(new URL('../public/js/workspace-client.js',import.meta.url),'utf8'),c);
  const data={owner:'one',snapshot:{hist:Array.from({length:1200},(_,i)=>({utc:i,pv:i/20,name:'苏州光储电站',soc:50}))}};
  await c.WorkspaceClient.request('state',{method:'POST',data});
  assert.equal(request.headers['Content-Encoding'],'gzip');
  assert.ok(request.body.byteLength<16000);
  const decoded=await new Response(new Blob([request.body]).stream().pipeThrough(new DecompressionStream('gzip'))).json();
  assert.deepEqual(decoded,data);
  await c.WorkspaceClient.request('config',{method:'PUT',data:{plants:[]}});
  assert.equal(request.headers['Content-Encoding'],undefined);
});
