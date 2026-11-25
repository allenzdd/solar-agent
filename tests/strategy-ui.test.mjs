import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
function ui(command){
 const store=new Map(),notes=[],timers=[];let acknowledgment=null;
 class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.listeners={};this.className='';this._text='';this.classList={add:()=>{},remove:()=>{}};}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}set textContent(v){this._text=String(v);this.children=[];}
  append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this._text='';this.children=nodes;}setAttribute(){}addEventListener(k,f){this.listeners[k]=f;}
  descendants(){return this.children.flatMap(c=>[c,...c.descendants()]);}querySelectorAll(s){return this.descendants().filter(e=>s==='[data-so-id]'?!!e.dataset.soId:s.startsWith('.')?e.className.split(' ').includes(s.slice(1)):e.tag===s);}
  querySelector(s){return this.querySelectorAll(s)[0];}after(){}focus(){}scrollIntoView(){}
 }
 const screen=new Element(),chat=new Element();screen.append(chat);const extra=new Element();
 const doc={activeElement:null,createElement:t=>new Element(t),createElementNS:(_,t)=>new Element(t),getElementById:()=>extra,querySelector:s=>s==='.screen'?screen:screen.querySelector(s),querySelectorAll:s=>screen.querySelectorAll(s)};
 const context=vm.createContext({document:doc,PLANTS:[{id:'P1',name:'测试站',batKw:100,batHours:2.15,cfg:{batKwh:215,pvKwp:120,loadPeak:70}}],xyScope:'all',localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},toast:t=>notes.push(t),openXY(){},setInterval:f=>timers.push(f),requestAnimationFrame:f=>f(),crypto:{randomUUID:()=> 'test-'+Math.random().toString(36).slice(2)},AppBridge:{command,acknowledgment:async()=>acknowledgment},addMsg:(_,text)=>{const row=new Element(),bubble=new Element();bubble.className='bubble';bubble.textContent=text;row.append(bubble);chat.append(row);return row;}});
 for(const file of ['strategy-model.js','strategies.js'])vm.runInContext(fs.readFileSync(new URL('../public/js/'+file,import.meta.url),'utf8'),context);
 const click=async text=>{const b=screen.querySelectorAll('button').find(b=>b.textContent===text);assert.ok(b,text);if(!b.disabled)await b.listeners.click();};
 return {context,screen,notes,store,click,tick:async()=>{for(const f of timers)f();await new Promise(r=>setImmediate(r));},ack:value=>acknowledgment=value};
}
test('strategy card submits real queue command, waits for acknowledgment and prevents duplicate submission',async()=>{
 const calls=[],u=ui(async c=>{calls.push(c);return {command:{id:c.id,status:'pending'}};});
 u.context.StrategyDemo.handle('明天10-16点停电，给我多留备用电');await u.click('确认下达指令');assert.equal(calls.length,1);assert.equal(calls[0].type,'strategy');assert.equal(calls[0].rows.length,24);
 assert.ok(u.screen.textContent.includes('等待管理端执行'));assert.equal(u.screen.textContent.includes('✓ 策略指令已执行'),false);await u.click('等待执行…');assert.equal(calls.length,1);
 u.ack({status:'done',ok:true,msg:'已安排下一仿真日'});await u.tick();assert.ok(u.screen.textContent.includes('✓ 策略指令已执行'));
 u.ack(null);await u.click('撤销策略');assert.equal(calls.length,2);assert.equal(calls[1].cancel,true);u.ack({status:'done',ok:true});await u.tick();assert.equal(Object.keys(JSON.parse(u.store.get('solar-strategy-demo-v1')).applied).length,0);
});
test('offline and missing-control errors never produce a successful issued state',async()=>{
 const u=ui(async()=>{throw Object.assign(Error('管理端未运行'),{status:409});});u.context.StrategyDemo.handle('明天10-16点停电，给我多留备用电');await u.click('确认下达指令');assert.ok(u.notes.some(s=>s.includes('指令未下达：管理端未运行')));assert.equal(u.screen.textContent.includes('已下达 · 待执行'),false);assert.equal(u.screen.textContent.includes('✓ 策略指令已执行'),false);
});
