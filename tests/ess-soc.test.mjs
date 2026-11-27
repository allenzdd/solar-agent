import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {createWorkspaceApi} from '../server/workspace.mjs';
const read=name=>fs.readFileSync(new URL('../public/js/'+name,import.meta.url),'utf8');
const modelContext=vm.createContext({});vm.runInContext(read('ess-soc-model.js'),modelContext);const M=modelContext.EssSocModel;
test('100% triggers daily longevity advice, 85% respects device limits and is not a mandatory universal ceiling',()=>{
 const p={socMin:10,socMax:98};assert.equal(M.advice({target:100},p).recommended,85);assert.equal(M.advice({target:85},p),null);assert.equal(M.recommended({socMin:10,socMax:80}),80);assert.equal(M.recommended({socMin:90,socMax:98}),90);
 assert.equal(M.validate({target:85,direction:'charge'},p),'');assert.ok(M.validate({target:100,direction:'charge'},p));assert.equal(M.validate({target:100,direction:'charge'},{socMax:100}),'');assert.ok(M.validate({target:85.5,direction:'charge'},p));
});
test('SOC target commands enforce operator permissions, station bounds and idempotency',async()=>{
 let d={config:[{id:'P1',batKw:100,socMin:10,socMax:98}],lease:{owner:'manager',expiresAt:100000},commands:[]};const api=createWorkspaceApi({read:async()=>structuredClone(d),update:async(_,fn)=>(d=fn(structuredClone(d)))},{now:()=>1000}),env={APP_CONTROL_TOKEN:'operator'};
 const call=(patch={},token='operator')=>api(new Request('http://solar.test/api/workspace/commands',{method:'POST',headers:{Authorization:'Bearer '+token},body:JSON.stringify({id:'target1',type:'target-soc',plantId:'P1',target:85,direction:'charge',...patch})}),env);
 assert.equal((await call({},'bad')).status,401);for(const patch of [{target:100},{target:85.5},{target:-1},{direction:'auto'},{plantId:'missing'}])assert.ok((await call(patch)).status>=400);
 assert.equal((await call()).status,200);assert.equal((await call()).status,200);assert.equal(d.commands.length,1);assert.equal(d.commands[0].status,'done');assert.equal(d.config[0].targetSoc.target,85);
});
function engine(){const s=read('simulator.js'),at=s.indexOf('function utcFromLocal('),end=s.indexOf('\nfunction ',at+10),c=vm.createContext({HIST_LEN:200,acks:[]});vm.runInContext(s.slice(0,s.indexOf('function simEvent('))+'\n'+s.slice(at,end)+'\n'+s.slice(s.indexOf('function pollCmd(c)'),s.indexOf('function publishState()'))+`\nlet lastCmdTs=0;function savePlantCfg(){}function simEvent(){}function simRender(){}function publishState(){}function ackCmd(c,ok,msg){acks.push({ok,msg});}globalThis.e={makePlant,simStepPlant,pollCmd,add:p=>PLANTS.push(p),acks};`,c);return c.e;}
test('execution sets a separate target without teleporting current SOC; charging/discharging stop at 85%',()=>{
 const e=engine(),at=Date.parse('2026-11-17T00:00:00Z');
 for(const direction of ['charge','discharge']){
  const p=e.makePlant({country:'中国',batKw:100,batHours:2,socMin:10,socMax:98});p.id=direction;p.soc=direction==='charge'?50:90;e.add(p);const before=p.soc;
  e.pollCmd({id:direction,type:'target-soc',plantId:p.id,target:85,direction,ts:direction==='charge'?1:2});assert.equal(e.acks.at(-1).ok,true);assert.equal(p.soc,before);assert.equal(p.socMax,98);
  for(let i=0;i<80;i++)e.simStepPlant(p,1,true,at+i*60000);
  assert.ok(Math.abs(p.soc-85)<1e-7);assert.equal(p.batMode,'idle');assert.equal(p.bat,0);
 }
});
function ui(command){
 const screen=new Node(),chat=new Node(),menu=new Node(),intro=new Node();let shared=null,chatOpen=false;const calls=[],notes=[],timers=[];let ack=null;
 function Node(tag='div'){this.tag=tag;this.children=[];this.events={};this.attrs={};this.hidden=false;this._text='';this.classList={add(){},contains:()=>false};}
 Object.defineProperty(Node.prototype,'textContent',{get(){return this._text+this.children.map(c=>c.textContent).join('');},set(v){this._text=String(v);this.children=[];}});
 Node.prototype.append=function(...nodes){this.children.push(...nodes);};Node.prototype.replaceChildren=function(...nodes){this._text='';this.children=nodes;};Node.prototype.setAttribute=function(k,v){this.attrs[k]=String(v);};Node.prototype.addEventListener=function(k,f){this.events[k]=f;};Node.prototype.desc=function(){return this.children.flatMap(c=>[c,...c.desc()]);};Node.prototype.querySelector=function(s){return this.desc().find(n=>s==='.bubble'?n.className==='bubble':n.tag===s);};Node.prototype.scrollIntoView=function(){};
 const xy={classList:{contains:()=>chatOpen}};const doc={createElement:t=>new Node(t),querySelector:()=>screen,getElementById:id=>id==='xiaoyuan'?xy:id==='app-more-menu'?menu:id==='xy-chat'?chat:intro};
 const c=vm.createContext({document:doc,PLANTS:[{id:'P1',name:'苏州仿真电站',socMin:10,socMax:98,soc:50,dayChg:5,dayDis:2}],SolarReminders:{openPrepared(key,question,answer){c.openXY();c.addMsg('user',question);answer();},setContext:v=>shared=v,clearContext:owner=>{if(shared?.owner===owner)shared=null;}},openXY:()=>chatOpen=true,closeXY:()=>chatOpen=false,closeAppMenu(){},toast:t=>notes.push(t),setInterval:f=>timers.push(f),requestAnimationFrame:f=>f(),crypto:{randomUUID:()=> 'cmd-1'},AppBridge:{command:async value=>{calls.push(value);return command?command(value):{command:{id:value.id,status:'pending'}};},acknowledgment:async()=>ack},addMsg:(role,text)=>{const row=new Node(),bubble=new Node();bubble.className='bubble';bubble.textContent=text;row.append(bubble);chat.append(row);return row;}});
 vm.runInContext(read('ess-soc-model.js'),c);vm.runInContext(read('ess-soc-settings.js'),c);
 const find=(text,root=screen)=>root.desc().find(n=>n.tag==='button'&&n.textContent===text),click=async(text,root=screen)=>{const b=find(text,root);assert.ok(b,text);if(!b.disabled)await b.events.click();};
 return {c,screen,chat,calls,notes,get shared(){return shared;},input:label=>screen.desc().find(n=>n.attrs['aria-label']===label),click,ack:v=>ack=v,tick:async()=>{timers.forEach(f=>f());await new Promise(r=>setImmediate(r));}};
}
test('typing 100% opens shared bubble; adopting 85% directly queues one command and awaits execution',async()=>{
 const u=ui();u.c.EssSocSettings.open('P1');const input=u.input('目标SOC(%)');input.value='100';input.valueAsNumber=100;input.events.input();assert.equal(u.shared.kind,'soc-longevity');assert.equal(u.calls.length,0);u.shared.onOpen();assert.ok(u.chat.textContent.includes('不是所有设备的统一要求'));
 await u.click('采用建议并执行',u.chat);assert.equal(u.input('目标SOC(%)').value,85);assert.equal(u.shared,null);assert.equal(u.calls.length,1);assert.equal(u.calls[0].type,'target-soc');assert.equal(u.calls[0].target,85);assert.equal(u.notes.length,0);assert.ok(u.screen.textContent.includes('正在执行目标SOC设置'));assert.equal(u.screen.textContent.includes('等待执行'),false);await u.click('正在执行…');assert.equal(u.calls.length,1);u.ack({status:'done',ok:true,msg:'85%已保存'});await u.tick();assert.ok(u.screen.textContent.includes('目标 SOC 已设置为 85%'));assert.ok(u.notes.includes('目标 SOC 已设置为 85%'));
});
test('failed direct submission reports the actual failure without claiming a command was issued',async()=>{
 const u=ui(async()=>{throw Object.assign(Error('管理端未运行'),{status:409});});u.c.EssSocSettings.open('P1',{target:100});u.shared.onOpen();await u.click('采用建议并执行',u.chat);assert.ok(u.notes.some(t=>t.includes('未下达：管理端未运行')));assert.equal(u.notes.some(t=>t.startsWith('已下达')),false);assert.ok(u.screen.textContent.includes('未下达：管理端未运行'));
});
test('server-completed settings immediately show success without entering an execution wait state',async()=>{
 const u=ui(async value=>({command:{...value,status:'done',ok:true,execution:'server-settings'}}));u.c.EssSocSettings.open('P1',{target:100});u.shared.onOpen();await u.click('采用建议并执行',u.chat);assert.equal(u.calls.length,1);assert.ok(u.notes.includes('目标 SOC 已设置为 85%'));assert.equal(u.screen.textContent.includes('正在执行'),false);assert.equal(u.screen.textContent.includes('暂未收到'),false);
});
