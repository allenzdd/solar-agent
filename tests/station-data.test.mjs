import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkspaceApi} from '../server/workspace.mjs';
import {createStationToolExecutor,stationEndpoints,stationOpenApi} from '../server/station-data.mjs';
import worker from '../dist/server/index.js';

const now=Date.parse('2026-11-16T04:00:00Z');
const workspace={config:[{id:'P1',name:'济宁',invKw:100,batKw:50,batHours:2,cloud:.25,tariff:{cur:'CNY',buy:.5}}],snapshot:{ts:now,time:{utc:now},plants:[{id:'P1',name:'济宁',pv:50,soc:60,batTemp:25,dayPv:180,cloud:.25}],alarms:[]},lease:{owner:'private-owner',expiresAt:now+5000},managerSessions:[],commands:[]};
const store={read:async key=>structuredClone(key==='workspace'?workspace:null)};
const env={MANAGER_TOKEN:'private-manager'};
const request=(route,token)=>new Request('https://solar.test/api/workspace/data/'+route,{headers:token?{Authorization:'Bearer '+token}:{}});

test('each station REST endpoint and tool returns identical authoritative data without secrets',async()=>{
 const api=createWorkspaceApi(store,{now:()=>now});const execute=createStationToolExecutor(store,{now,origin:'https://solar.test',manager:true});
 for(const [route,name] of stationEndpoints){
  const response=await api(request(route==='catalog'?'catalog':'plants/P1/'+route,env.MANAGER_TOKEN),env);
  assert.equal(response.status,200,route);const body=await response.json();
  assert.deepEqual(body,JSON.parse(JSON.stringify(await execute(name,route==='catalog'?{}:{plantIds:['P1']}))));
  assert.doesNotMatch(JSON.stringify(body),/private-owner|private-manager/);assert.equal(body.stale,false);
 }
 const device=(await execute('get_plant_devices',{plantIds:['P1']})).results[0].data.plants[0].devices;
 assert.equal(device[0].virtual,true);assert.equal(device[1].capacityKwh,100);
 const weather=(await execute('get_plant_weather',{})).results[0].data;assert.equal(weather.plants[0].available,false);assert.equal(weather.plants[0].forecast,null);assert.equal(weather.plants[0].cloudPercent,25);
});

test('HTTP validates ranges, dates, unknown stations and parameters; operations require manager',async()=>{
 const api=createWorkspaceApi(store,{now:()=>now});
 for(const route of ['plants/P1/history?lastDays=0','plants/P1/history?calendar=anything','plants/P1/history?from=2026-02-30','plants/P1/history?limit=NaN','plants/P1/realtime?secret=true','plants/P1/realtime?limit=1&limit=2'])assert.equal((await api(request(route),env)).status,400,route);
 assert.equal((await api(request('plants/missing/realtime'),env)).status,404);
 assert.equal((await api(request('plants/P1/operations'),env)).status,401);
 const execute=createStationToolExecutor(store,{now});assert.equal((await execute('get_plant_operations',{})).results[0].data.requiresManager,true);
 await assert.rejects(execute('get_plant_realtime',{arbitrary:'x'}));await assert.rejects(execute('run_shell',{}));
 const post=new Request('https://solar.test/api/workspace/data/query',{method:'POST',body:JSON.stringify({queries:[{scope:'current'},{scope:'weather'}]})});
 assert.equal((await (await api(post,env)).json()).results.length,2);
 const wrong=await api(new Request('https://solar.test/api/workspace/data/catalog',{method:'DELETE'}),env);assert.equal(wrong.status,405);assert.equal(wrong.headers.get('Allow'),'GET');
});

test('data age and absent measurements remain explicit; catalog never invents stations',async()=>{
 const api=createWorkspaceApi(store,{now:()=>now+60000});const current=await (await api(request('plants/P1/realtime'),env)).json();assert.equal(current.stale,true);assert.equal(current.results[0].data.plants[0].bat,null);
 const empty=createWorkspaceApi({read:async()=>null});const result=await (await empty(request('catalog'))).json();assert.deepEqual(result.results[0].data.plants,[]);
 const unavailable=createWorkspaceApi({read:async()=>{throw Error('private database error');}});
 const failed=await unavailable(request('catalog'));assert.equal(failed.status,503);assert.doesNotMatch(await failed.text(),/private database/);
});

test('built Worker shares the station registry and exposes generated OpenAPI',async()=>{
 const bucket={get:async key=>({json:async()=>key.endsWith('/workspace.json')?workspace:null})};
 const response=await worker.fetch(request('plants/P1/devices'),{BUCKET:bucket});assert.equal(response.status,200);assert.equal((await response.json()).results[0].data.plants[0].devices[0].virtual,true);
 const spec=await (await worker.fetch(request('openapi.json'),{BUCKET:bucket})).json();assert.deepEqual(spec,stationOpenApi());assert.equal(Object.keys(spec.paths).length,stationEndpoints.length+1);
});
