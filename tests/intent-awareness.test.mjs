import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createWorkspaceApi} from '../server/workspace.mjs';
const env={MANAGER_TOKEN:'manager'},now=10000;
function store(){let document={config:[{id:'P1',name:'苏州仿真电站',tariff:{sym:'¥',retail:.62,fit:.35}},{id:'P2',name:'三亚仿真电站'}],snapshot:{plants:[{id:'P1',pv:22,dayRev:10}]}};return {read:async()=>structuredClone(document),update:async(_,fn)=>(document=fn(structuredClone(document)))};}
const req=(action,token)=>new Request('http://solar.test/api/workspace/intent-event',{method:action?'POST':'GET',headers:token?{Authorization:'Bearer '+token}:{},...(action?{body:JSON.stringify({action})}:{})});
test('only a manager can trigger a Suzhou event; replay is distinct, recovery removes it and telemetry is untouched',async()=>{
 const s=store(),original=(await s.read()).snapshot,api=createWorkspaceApi(s,{now:()=>now});
 assert.equal((await api(req('trigger'),env)).status,401);
 assert.equal((await api(req('unknown','manager'),env)).status,400);
 const event=(await (await api(req('trigger','manager'),env)).json()).event;assert.equal(event.plantId,'P1');assert.equal(event.demo,true);assert.equal(event.evidence.equipment,'正常');assert.equal(event.evidence.cause,'季节性遮挡');assert.equal(event.evidence.shadedRevenue/event.evidence.referenceRevenue,.4);
 const replay=(await (await api(req('trigger','manager'),env)).json()).event;assert.notEqual(replay.id,event.id);
 assert.equal((await (await api(req(),env)).json()).event.id,replay.id);
 assert.deepEqual((await s.read()).snapshot,original);
 await api(req('restore','manager'),env);assert.equal((await (await api(req(),env)).json()).event,null);
  await api(req('trigger','manager'),env);await api(new Request('http://solar.test/api/workspace/reminders/reset',{method:'POST',headers:{Authorization:'Bearer manager'}}),env);assert.equal((await (await api(req(),env)).json()).event,null);
});
test('missing Suzhou stations and expired events never produce a valid reminder',async()=>{
 const s=store();await s.update('workspace',d=>({...d,config:[]}));assert.equal((await createWorkspaceApi(s,{now:()=>now})(req('trigger','manager'),env)).status,404);
 const live=store();await createWorkspaceApi(live,{now:()=>now})(req('trigger','manager'),env);
 assert.equal((await (await createWorkspaceApi(live,{now:()=>now+86400001})(req(),env)).json()).event,null);
});
const ctx=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../public/js/intent-policy.js',import.meta.url),'utf8'),ctx);
const context={detailOpen:true,chatOpen:false,hidden:false,plantId:'P1'};
const event={id:'e1',plantId:'P1',status:'active',expiresAt:100000};
test('reminder requires three seconds on matching plant detail and never follows a visitor to another page',()=>{
 const p=ctx.IntentPolicy.create();assert.equal(p.update({...context,detailOpen:false},event,0),false);assert.equal(p.update({...context,plantId:'P2'},event,1000),false);
 assert.equal(p.update(context,event,2000),false);assert.equal(p.update(context,event,4999),false);assert.equal(p.update(context,event,5000),true);
 p.mark('e1');assert.equal(p.update(context,event,8000),false);assert.equal(ctx.IntentPolicy.create(['e1']).update(context,event,9000),false);
});
test('leaving or opening chat resets dwell, while a new trigger becomes eligible and recovery invalidates it',()=>{
 const p=ctx.IntentPolicy.create();p.update(context,event,0);p.update({...context,chatOpen:true},event,2000);assert.equal(p.update(context,event,4000),false);assert.equal(p.update(context,event,6999),false);assert.equal(p.update(context,event,7000),true);p.mark('e1');
 assert.equal(p.update(context,{...event,id:'e2'},8000),false);assert.equal(p.update(context,{...event,id:'e2'},11000),true);assert.equal(p.update(context,{...event,id:'e2',status:'recovered'},12000),false);
});

test('intent uses the shared reminder bubble and opens evidence in chat without mounting a floating card',async()=>{
 let time=20000,current=null,opened=0;const messages=[],created=[],store=new Map();
 class Node{constructor(tag){this.tag=tag;this.children=[];this.classList={add(){}};}append(...children){this.children.push(...children);}setAttribute(){}addEventListener(){}scrollIntoView(){}}
 const detail={dataset:{plantId:'P1'},classList:{contains:()=>true}},chat={classList:{contains:()=>false,add(){}}},misc=new Node('div');
 const fixture={...event,expiresAt:100000,title:'冬季阴影',explanation:'季节性遮挡导致上午收益偏低',outlook:'中午观察出力回升',plantName:'苏州仿真电站',evidence:{shadedRevenue:48,referenceRevenue:120,reductionPercent:60,currency:'¥'}};
 const c=vm.createContext({Date:{now:()=>time},AbortSignal,document:{hidden:false,getElementById:id=>id==='plant-detail'?detail:id==='xiaoyuan'?chat:misc,addEventListener(){},createElement:tag=>{created.push(tag);return new Node(tag);}},localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},MutationObserver:class{observe(){}},setInterval(){},requestAnimationFrame:fn=>fn(),WorkspaceClient:{request:async()=>({event:fixture})},SolarReminders:{setContext:value=>{current=value;},clearContext:owner=>{if(current?.owner===owner)current=null;}},openXY:()=>opened++,closeXY(){},addMsg:(role,text)=>{const bubble=new Node('div'),row=new Node('div');row.querySelector=()=>bubble;row.append(bubble);messages.push({role,text,row});return row;}});
 for(const name of ['intent-policy.js','intent-awareness.js'])vm.runInContext(fs.readFileSync(new URL('../public/js/'+name,import.meta.url),'utf8'),c);
 await c.IntentAwareness.refresh();assert.equal(current,null);time+=3000;await c.IntentAwareness.refresh();
 assert.equal(current.owner,'intent-awareness');assert.equal(current.anchor,'bottom-right');assert.equal(current.actionLabel,'去对话');assert.equal(current.visible,true);assert.equal(created.includes('aside'),false);
 current.onOpen();assert.equal(current,null);assert.equal(opened,1);assert.equal(messages.length,2);assert.equal(messages[1].row.children[0].children[0].className,'xr-event');
});
