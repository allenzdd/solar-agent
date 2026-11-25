import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {intentEventFor,applySeasonalShade} from '../server/seasonal-shade.mjs';
import {createWorkspaceApi} from '../server/workspace.mjs';import {queryWorkspace} from '../server/workspace-query.mjs';
const now=Date.parse('2026-11-17T01:30:00Z');
function fixture(){return {config:[{id:'P1',name:'苏州仿真电站',invKw:100,tariff:{sym:'¥',cur:'CNY',retail:.62,fit:.35}}],intentEvent:{id:'e1',type:'seasonal-shade',plantId:'P1',status:'active',expiresAt:now+86400000},snapshot:{v:3,ts:now,time:{utc:now},agg:{},plants:[{id:'P1',invKw:100,totalBase:1000,totalRev:500,pv:30,load:50,grid:20,bat:0,dayPv:10,dayRev:6,daySelf:10,hourly:Array(24).fill(1),energyTotals:{monthPvKwh:110,yearPvKwh:1010,knownPvKwh:1010}},{id:'P2',pv:10,load:20,grid:10,dayPv:20,dayRev:12}]}};}
test('PV, revenue, power flows and rollup counters share one reversible scenario without changing stored source',()=>{
 const d=fixture(),before=structuredClone(d),event=intentEventFor(d,now),view=applySeasonalShade(d,d.snapshot,now),p=view.plants[0];
 assert.equal(p.dayPv,event.evidence.shadedPvKwh);assert.equal(p.dayRev,event.evidence.shadedRevenue);assert.equal(p.dayPv,80);assert.ok(Math.abs(p.dayRev-45.28)<1e-9);
 assert.ok(Math.abs(p.dayRev-(p.daySelf*.62+p.dayExp*.35))<1e-9);assert.equal(p.pv+p.bat+p.grid,p.load);assert.equal(p.dayPv+p.dayImp,p.dayLoad+p.dayExp);assert.equal(p.energyTotals.monthPvKwh,180);
 assert.ok(Math.abs(p.hourly.reduce((s,v)=>s+v,0)-p.dayPv)<1e-9);assert.equal(view.agg.dayPv,100);assert.deepEqual(view.plants[1],d.snapshot.plants[1]);assert.equal(view.ts,d.snapshot.ts);assert.deepEqual(d,before);
 const repeat=applySeasonalShade(d,view,now);assert.equal(repeat.plants[0].dayPv,p.dayPv);assert.equal(repeat.plants[0].energyTotals.monthPvKwh,180);
 d.intentEvent.status='recovered';assert.strictEqual(applySeasonalShade(d,d.snapshot,now),d.snapshot);
});
test('state API, event explanation and Agent data query return matching values; recovery works with identical snapshot timestamp',async()=>{
 let d=fixture();const store={read:async key=>structuredClone(key==='workspace'?d:null),update:async(_,fn)=>(d=fn(structuredClone(d)))};
 const api=createWorkspaceApi(store,{now:()=>now}),req=path=>new Request('http://solar.test/api/workspace/'+path);
 const state=await (await api(req('state'))).json(),event=(await (await api(req('intent-event'))).json()).event;
 const query=await queryWorkspace(store,{queries:[{scope:'current',plantIds:['P1']}]},{now});const p=query.results[0].data.plants[0];
 assert.equal(state.snapshot.plants[0].dayPv,event.evidence.shadedPvKwh);assert.equal(p.dayRev,event.evidence.shadedRevenue);assert.equal(query.activeScenario.id,'e1');
 await api(new Request('http://solar.test/api/workspace/intent-event',{method:'POST',headers:{Authorization:'Bearer manager'},body:JSON.stringify({action:'restore'})}),{MANAGER_TOKEN:'manager'});
 const restored=await (await api(req('state'))).json();assert.equal(restored.snapshot.ts,state.snapshot.ts);assert.equal(restored.snapshot.viewRevision,undefined);assert.equal(restored.snapshot.plants[0].dayPv,10);assert.equal(restored.snapshot.plants[0].dayRev,6);
});
test('missing tariffs do not invent revenue, and expired/closed scenarios do not override telemetry',()=>{
 const d=fixture();delete d.config[0].tariff;assert.equal(intentEventFor(d,now).evidence.shadedRevenue,null);d.snapshot.plants[0].closed=true;assert.strictEqual(applySeasonalShade(d,d.snapshot,now),d.snapshot);d.snapshot.plants[0].closed=false;assert.strictEqual(applySeasonalShade(d,d.snapshot,now+86400001),d.snapshot);
});
test('APP refreshes scenario and restored data even when the publisher is offline and timestamp is unchanged',async()=>{
 const source=fs.readFileSync(new URL('../public/js/monitor.js',import.meta.url),'utf8');let current;const c=vm.createContext({AppBridge:{state:async()=>current},updates:0});
 vm.runInContext(`let SIMSTATE=null,SIMAGG=null;const TIME={},PLANTS=[];const curTab='home';function updateBridgeTip(){}function mergeSimAlarms(){}function ensureLiveDevices(){}function syncLiveToApp(){updates++;}\n`+source.slice(source.indexOf('async function loadSimState()'),source.indexOf('/* 旧版（v2）快照'))+'\nglobalThis.refresh=loadSimState;',c);
 const d=fixture();current=structuredClone(d.snapshot);await c.refresh();current=applySeasonalShade(d,d.snapshot,now);await c.refresh();await c.refresh();current=structuredClone(d.snapshot);await c.refresh();assert.equal(c.updates,3);
});
