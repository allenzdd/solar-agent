import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createWorkspaceApi} from '../server/workspace.mjs';
const rows=()=>Array.from({length:24},(_,hour)=>({hour,batKw:hour<6?-20:hour>=17&&hour<21?20:0}));
const cmd=()=>({id:'strategy-command',type:'strategy',plantId:'P1',planId:'plan1',min:20,max:80,rows:rows()});
const env={MANAGER_TOKEN:'manager',APP_CONTROL_TOKEN:'operator'};
const request=(path,method='GET',body,token='operator')=>new Request('http://solar.test/api/workspace/'+path,{method,headers:{Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});
function memory(){let doc={config:[{id:'P1',batKw:100}],lease:{owner:'owner',expiresAt:200000},commands:[]};return {read:async()=>structuredClone(doc),update:async(_,fn)=>(doc=fn(structuredClone(doc)))};}
test('strategy commands require control, validate plant and power, enqueue idempotently and expose execution results',async()=>{
 const store=memory(),api=createWorkspaceApi(store,{now:()=>100000});
 assert.equal((await api(request('commands','POST',cmd(),'wrong'),env)).status,401);
 for(const patch of [{rows:[]},{min:90,max:20},{plantId:'missing'},{rows:rows().map(r=>({...r,batKw:101}))}])assert.ok((await api(request('commands','POST',{...cmd(),...patch}),env)).status>=400);
 for(let i=0;i<2;i++)assert.equal((await api(request('commands','POST',cmd()),env)).status,202);
 assert.equal((await store.read()).commands.length,1);
 assert.equal((await api(request('commands/strategy-command/ack','POST',{owner:'owner',ok:true,msg:'已安排下一天策略'},'manager'),env)).status,200);
 const c=(await (await api(request('commands/strategy-command'),env)).json()).command;assert.equal(c.ok,true);assert.equal(c.status,'done');
 assert.equal((await api(request('commands','POST',{id:'cancel1',type:'strategy',plantId:'P1',planId:'plan1',cancel:true}),env)).status,202);
});
function engine(){
 const source=fs.readFileSync(new URL('../public/js/simulator.js',import.meta.url),'utf8');
 const context=vm.createContext({HIST_LEN:200,acks:[]});
 const at=source.indexOf('function utcFromLocal('),end=source.indexOf('\nfunction ',at+10);
 vm.runInContext(source.slice(0,source.indexOf('function simEvent('))+'\n'+source.slice(at,end)+'\n'+source.slice(source.indexOf('function pollCmd(c)'),source.indexOf('function publishState()'))+`\nfunction savePlantCfg(){} function simEvent(){} function simRender(){} function publishState(){} function ackCmd(c,ok,msg){acks.push({ok,msg});} let lastCmdTs=0;globalThis.e={makePlant,simStepPlant,pollCmd,SIMTIME,add:p=>PLANTS.push(p),acks};`,context);
 return context.e;
}
test('management schedules next local day, retains the same plan on replay and cancels only the matching strategy',()=>{
 const e=engine();e.SIMTIME.utc=Date.parse('2026-11-16T04:00:00Z');const p=e.makePlant({name:'测试站',country:'中国',batKw:100,batHours:2});p.id='P1';e.add(p);
 e.pollCmd({...cmd(),ts:1});assert.equal(e.acks.at(-1).ok,true);assert.equal(p.strategy.startsAt,Date.parse('2026-11-17T00:00:00+08:00'));assert.equal(p.strategy.endsAt,Date.parse('2026-11-18T00:00:00+08:00'));
 const start=p.strategy.startsAt;e.SIMTIME.utc+=86400000;e.pollCmd({...cmd(),ts:2});assert.equal(p.strategy.startsAt,start);
 e.pollCmd({...cmd(),cancel:true,planId:'different',id:'cancel-wrong',ts:3});assert.equal(e.acks.at(-1).ok,false);assert.ok(p.strategy);
 e.pollCmd({...cmd(),cancel:true,id:'cancel-good',ts:4});assert.equal(e.acks.at(-1).ok,true);assert.equal(p.strategy,null);
});
test('scheduled power obeys SOC and power limits without manufacturing stored energy; grid balance is conserved',()=>{
 const e=engine(),utc=Date.parse('2026-11-17T00:00:00+08:00');
 for(const [soc,kw] of [[50,-20],[50,20],[10,20],[90,-20],[20,100]]){
  const p=e.makePlant({country:'中国',invKw:100,ratio:1.2,batKw:100,batHours:2});p.soc=soc;
  p.strategy={min:20,max:80,startsAt:utc,endsAt:utc+86400000,rows:Array.from({length:24},(_,hour)=>({hour,batKw:kw}))};
  e.simStepPlant(p,5,true,utc);
  assert.ok(Math.abs(p.bat)<=100);assert.ok(Math.abs(p.pv+p.bat+p.grid-p.load-p.curtail)<1e-8);
  const energyDelta=(p.soc-soc)/100*(p.cfg.batKwh*.9),expected=p.bat<=0?-p.bat*p.cfg.eff/12:-p.bat/p.cfg.eff/12;
  assert.ok(Math.abs(energyDelta-expected)<1e-8);
  if(soc<20&&kw>0)assert.equal(p.soc,soc);if(soc>80&&kw<0)assert.equal(p.soc,soc);
 }
});
