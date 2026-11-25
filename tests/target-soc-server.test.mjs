import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createWorkspaceApi} from '../server/workspace.mjs';import {queryWorkspace} from '../server/workspace-query.mjs';
const env={MANAGER_TOKEN:'manager',APP_CONTROL_TOKEN:'operator'},now=100000;
const request=(route,method='GET',body,token='operator')=>new Request('http://solar.test/api/workspace/'+route,{method,headers:{Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});
function store(){let d={revision:0,config:[{id:'P1',name:'苏州仿真电站',invKw:100,batKw:100,socMin:10,socMax:98}],lease:null,commands:[],snapshot:{v:3,ts:1,time:{utc:now},agg:{},plants:[{id:'P1',name:'苏州仿真电站',soc:50,batMode:'auto',dayPv:10,dayRev:6}]}};return {read:async k=>structuredClone(k==='workspace'?d:null),update:async(_,fn)=>(d=fn(structuredClone(d)))};}
const command={id:'soc85',type:'target-soc',plantId:'P1',target:85,direction:'stop'};
test('target SOC saves immediately with no publisher lease and survives API recreation without altering actual SOC',async()=>{
 const s=store(),api=createWorkspaceApi(s,{now:()=>now});const response=await api(request('commands','POST',command),env);assert.equal(response.status,200);const c=(await response.json()).command;assert.equal(c.status,'done');assert.equal(c.ok,true);assert.equal(c.execution,'server-settings');
 const d=await s.read('workspace');assert.equal(d.config[0].targetSoc.target,85);assert.equal(d.snapshot.plants[0].targetSoc.target,85);assert.equal(d.snapshot.plants[0].soc,50);assert.equal(d.snapshot.ts,1);assert.equal(d.commands.filter(c=>c.status==='pending').length,0);
 const reload=createWorkspaceApi(s,{now:()=>now});const result=await (await reload(request('commands/soc85'),env)).json();assert.equal(result.command.status,'done');assert.equal((await api(request('commands','POST',command),env)).status,200);assert.equal((await s.read('workspace')).commands.length,1);
 const q=await queryWorkspace(s,{queries:[{scope:'current',plantIds:['P1']}]},{now});assert.equal(q.results[0].data.plants[0].targetSoc.target,85);
 assert.equal((await api(request('commands','POST',{id:'other',type:'soc',plantId:'P1',min:20,max:80}),env)).status,409);
});
test('old manager config and snapshot publications cannot overwrite newer server SOC targets; sync is provided to manager',async()=>{
 const s=store(),api=createWorkspaceApi(s,{now:()=>now});const old=await s.read('workspace');await api(request('commands','POST',command),env);await api(request('lease','POST',{owner:'browser'},'manager'),env);
 assert.equal((await api(request('config','PUT',{owner:'browser',plants:old.config},'manager'),env)).status,200);
 assert.equal((await api(request('state','PUT',{owner:'browser',snapshot:old.snapshot},'manager'),env)).status,200);
 const d=await s.read('workspace');assert.equal(d.config[0].targetSoc.target,85);assert.equal(d.snapshot.plants[0].targetSoc.target,85);assert.equal(d.snapshot.plants[0].soc,50);
 const feed=await (await api(request('commands','GET',undefined,'manager'),env)).json();assert.equal(feed.targetSocSettings[0].target,85);assert.equal(feed.commands.length,0);
});
test('offline target setting still rejects unauthorized access and invalid targets',async()=>{
 const api=createWorkspaceApi(store(),{now:()=>now});assert.equal((await api(request('commands','POST',command,'wrong'),env)).status,401);
 assert.equal((await api(request('commands','POST',{...command,target:100}),env)).status,400);
});
test('APP bridge supports manager cookie authentication and reads execution receipts without requiring a token',async()=>{
 const calls=[],c=vm.createContext({AbortSignal,sessionStorage:{getItem:()=>'',removeItem(){}},WorkspaceClient:{request:async(path,options)=>{calls.push({path,options});return path==='commands'?{command:{status:'done',ok:true}}:{command:{id:'soc85',status:'done',ok:true}};}}});vm.runInContext(fs.readFileSync(new URL('../public/js/app-bridge.js',import.meta.url),'utf8'),c);
 assert.equal((await c.AppBridge.command(command)).command.ok,true);assert.equal((await c.AppBridge.acknowledgment('soc85')).ok,true);assert.equal(calls.length,2);
});
test('permission cancellation is a concrete pre-submit error and never becomes an unknown queued command',async()=>{
 const screen={append:n=>screen.node=n};class Node{constructor(tag){this.tag=tag;this.events={};this.children=[];}append(...n){this.children.push(...n);}setAttribute(){}addEventListener(k,f){this.events[k]=f;}focus(){}remove(){screen.node=null;}}
 const c=vm.createContext({AbortSignal,sessionStorage:{getItem:()=>'',removeItem(){}},document:{createElement:t=>new Node(t),querySelector:()=>screen},WorkspaceClient:{request:async()=>{throw Object.assign(Error('unauthorized'),{status:401});}}});vm.runInContext(fs.readFileSync(new URL('../public/js/app-bridge.js',import.meta.url),'utf8'),c);
 const promise=c.AppBridge.command(command);await new Promise(r=>setImmediate(r));assert.ok(screen.node);const form=screen.node.children[0],cancel=form.children.at(-1).children[0];cancel.events.click();await assert.rejects(promise,e=>e.status===401&&e.stage==='before_submit');assert.equal(screen.node,null);
});
