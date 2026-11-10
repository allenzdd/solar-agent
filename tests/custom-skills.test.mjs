import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=name=>fs.readFileSync(new URL('../public/js/'+name,import.meta.url),'utf8');
const modelSource=source('custom-skills-model.js'),uiSource=source('custom-skills.js');
function model(){const c=vm.createContext({});vm.runInContext(modelSource,c);return c.CustomSkillModel;}
const fixture=[{id:'P1',name:'苏州仿真电站'},{id:'P3',name:'山东济宁光储电站'}];
const savedComparison=()=>new Map([['xy-installer-skills-v1',JSON.stringify([{...model().template(),id:'user-created-compare',name:'多电站横向对比'}])]]);
test('generic definitions retain only five editable settings and migrate previous prompts',()=>{
  const M=model(),s=M.normalize({...M.template(),author:'旧安装商',metrics:['yield'],gap:20,heat:70,instructions:'旧提示词',prompt:undefined,plants:['P1','P1'],days:90});
  assert.equal(s.prompt,'旧提示词');assert.equal(s.days,90);assert.equal(s.plants.length,1);assert.equal(M.validate(s).length,0);
  assert.deepEqual(Object.keys(s).sort(),['days','description','enabled','id','name','plants','prompt']);
  assert.equal(M.validate(M.normalize({})).length,2);
});
test('user prompt, period and selected scope reach model execution without fixed comparison rules',()=>{
  const M=model(),s=M.normalize({name:'巡检简报',description:'三句简报',prompt:'只输出三句话，不做横向对比。',plants:['P1'],days:30});
  const messages=M.messages(s,fixture,'运行技能：巡检简报'),text=messages[0].content;
  assert.ok(text.includes(s.prompt));assert.ok(text.includes('最近 30 天'));assert.ok(text.includes('苏州仿真电站'));assert.equal(text.includes('山东济宁光储电站'),false);
  assert.equal(text.includes('低于本组中位数'),false);assert.equal(text.includes('70℃'),false);
});

function ui(store=new Map(),request,modelChat){
  const doc={activeElement:null,listeners:{},addEventListener(k,fn){this.listeners[k]=fn;}};
  class Node{
    constructor(tag='div'){this.tagName=tag;this.className='';this.children=[];this.listeners={};this.attrs={};this.style={};this.value='';this.hidden=false;this._text='';this.classList={add(){}};}
    set textContent(v){this._text=String(v);this.children=[];}
    get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
    append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n);}}
    prepend(n){n.parentElement=this;this.children.unshift(n);}
    replaceChildren(...nodes){this._text='';this.children=[];this.append(...nodes);}
    insertBefore(n,b){n.parentElement=this;this.children.splice(this.children.indexOf(b),0,n);}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,fn){this.listeners[k]=fn;}
    matches(sel){return sel.startsWith('.')?this.className.split(' ').includes(sel.slice(1)):this.tagName===sel;}
    querySelectorAll(sel){const selectors=sel.split(',');return this.descendants().filter(n=>selectors.some(s=>n.matches(s)));}
    descendants(){return this.children.flatMap(n=>[n,...n.descendants()]);}
    querySelector(sel){return this.querySelectorAll(sel)[0];}
    contains(n){return n===this||this.descendants().includes(n);}
    focus(){doc.activeElement=this;}
    click(){this.listeners.click?.({preventDefault(){}});}
    remove(){this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
  }
  const app=new Node(),top=new Node(),newButton=new Node('button'),chat=new Node(),input=new Node('input'),intro=new Node(),bottom=new Node(),home=new Node(),refresh=new Node();top.className='xy-top';bottom.className='xy-bottom';refresh.className='xy-refresh';newButton.className='xy-new-chat';top.append(newButton);intro.append(home,refresh);bottom.append(input);app.append(top,intro,chat,bottom);
  const nodes={xiaoyuan:app,'xy-chat':chat,'xy-input':input,'xy-intro':intro,'xy-sugs':home};
  doc.createElement=tag=>new Node(tag);doc.getElementById=id=>nodes[id]||app.descendants().find(n=>n.id===id);doc.querySelector=sel=>app.querySelector(sel);
  const notes=[],history=[],calls=[],c=vm.createContext({document:doc,localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},performance,AbortSignal,AbortController,DOMException,convoId:'chat-1',convo:{history},generating:false,abortCtl:null,pendingImgs:[],toast:t=>notes.push(t),openXY(){},showAnswerTime(row){row.timed=true;},renderChatMarkdown(node,text){node.textContent=text;},addMsg(role,text){const row=new Node(),bubble=new Node();bubble.className='bubble';bubble.textContent=text;row.append(bubble);chat.append(row);return row;}});
  vm.runInContext(modelSource,c);c.PLANTS=fixture;
  const session=new Map();c.window={addEventListener(){}};c.sessionStorage={getItem:k=>session.get(k)??null,setItem:(k,v)=>session.set(k,v)};c.stations=fixture;c.xyScope='all';
  c.WorkspaceClient={request:request||(()=>Promise.resolve({snapshot:{plants:fixture}}))};
  c.SolarApi={chat:async options=>{calls.push(options);if(modelChat)return modelChat(options);const answer=options.messages[0].content.includes('只输出四个字')?'运行正常':'这是自定义技能的结果';options.onDelta(answer);return answer;}};
  c.setGenerating=value=>{c.generating=value;};c.askAI=q=>{assert.equal(c.CustomSkills.handle(q),true);};vm.runInContext(uiSource,c);
  const click=(text,root=app)=>{const b=root.querySelectorAll('button').find(n=>n.textContent===text);assert.ok(b,`button ${text}`);b.click();return b;};
  const inputFor=text=>app.querySelectorAll('label').find(n=>n.children[0]?.textContent===text)?.children[1];
  const card=name=>app.querySelectorAll('.sk-library-card').find(n=>n.textContent.includes(name));
  return {c,app,top,doc,chat,input,store,history,notes,calls,click,inputFor,card};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('creation prefills five settings while a changed one-station task still runs its own prompt',async()=>{
  const u=ui();u.c.CustomSkills.open();u.click('＋ 创建技能');
  const form=u.app.querySelector('form');
  const fields=form.querySelectorAll('.sk-field').map(n=>n.children[0].textContent);
  assert.deepEqual(fields,['技能名称','一句话说明','详细提示词','周期']);assert.equal(form.querySelectorAll('h4')[0].textContent,'参与的电站');
  assert.equal(u.inputFor('技能名称').value,'横向对比电站 Skill');assert.ok(u.inputFor('详细提示词').value.includes('横向对比'));assert.equal(form.textContent.includes('创建安装商'),false);assert.equal(form.textContent.includes('对比指标'),false);
  u.inputFor('技能名称').value='运行快答';u.inputFor('一句话说明').value='快速回复';u.inputFor('详细提示词').value='只输出四个字：运行正常';u.inputFor('周期').value='30';
  const check=form.querySelectorAll('label').find(n=>n.children.at(-1)?.textContent==='苏州仿真电站').children[0];check.checked=true;check.listeners.change();
  form.listeners.submit({preventDefault(){}});const saved=JSON.parse(u.store.get('xy-installer-skills-v1'));assert.equal(saved.length,1);assert.equal(saved[0].plants.length,1);assert.equal(saved[0].days,30);assert.equal(saved[0].prompt,'只输出四个字：运行正常');assert.equal('author' in saved[0],false);
  u.click('在对话中运行',u.card('运行快答'));await tick();assert.ok(u.chat.textContent.includes('运行正常'));assert.equal(u.calls.length,1);assert.equal(u.c.generating,false);assert.equal(u.chat.textContent.includes('单位装机发电量'),false);
  const reloaded=ui(u.store);reloaded.c.CustomSkills.handle('运行技能：运行快答');await tick();assert.ok(reloaded.chat.textContent.includes('运行正常'));
});
test('edited prompt controls subsequent execution, disabled skills do not run, delete persists',async()=>{
  const u=ui(savedComparison());u.c.CustomSkills.open();u.click('编辑',u.card('多电站横向对比'));u.inputFor('详细提示词').value='只输出四个字：运行正常';u.app.querySelector('form').listeners.submit({preventDefault(){}});
  u.click('在对话中运行',u.card('多电站横向对比'));await tick();assert.ok(u.chat.textContent.includes('运行正常'));
  u.c.CustomSkills.open();u.click('停用',u.card('多电站横向对比'));const count=u.calls.length;u.c.CustomSkills.handle('运行技能：多电站横向对比');await tick();assert.equal(u.calls.length,count);assert.ok(u.chat.textContent.includes('尚未启用'));
  assert.equal(u.c.CustomSkills.handle('今天苏州发了多少电'),false);u.click('删除',u.card('多电站横向对比'));assert.equal(JSON.parse(u.store.get('xy-installer-skills-v1')).length,0);
});
test('old saved installer skills open with migrated prompt and no obsolete settings',()=>{
  const store=new Map([['xy-installer-skills-v1',JSON.stringify([{id:'old',name:'旧技能',instructions:'整理巡检建议',author:'安装商',days:7,metrics:['yield'],plants:[],enabled:true}])]]),u=ui(store);
  u.c.CustomSkills.open();u.click('编辑',u.card('旧技能'));assert.equal(u.inputFor('详细提示词').value,'整理巡检建议');assert.equal(u.inputFor('创建安装商'),undefined);assert.equal(u.app.querySelectorAll('input').some(i=>i.type==='number'),false);
});
test('new conversation prevents late model insertion and stop cancels data loading',async()=>{
  let resolve;const u=ui(savedComparison(),undefined,()=>new Promise(r=>{resolve=r;}));u.c.CustomSkills.handle('运行技能：多电站横向对比');await tick();u.c.convoId='chat-2';u.c.generating=false;resolve('不应插入');await tick();assert.equal(u.chat.textContent.includes('不应插入'),false);assert.equal(u.history.length,0);
  const v=ui(savedComparison(),(_,options)=>new Promise((yes,no)=>options.signal.addEventListener('abort',()=>no(new Error('aborted')))));v.c.CustomSkills.handle('运行技能：多电站横向对比');v.c.abortCtl.abort();await tick();assert.equal(v.c.generating,false);assert.equal(v.calls.length,0);assert.ok(v.chat.textContent.includes('已停止技能'));
});
test('secondary menu hosts memory, strategies and subscriptions with working callbacks',()=>{
  const u=ui(),opened=[];u.c.OwnerMemory={open:()=>opened.push('memory')};u.c.StrategyDemo={open:()=>opened.push('strategy')};u.c.SubscriptionDemo={open:()=>opened.push('subscription')};vm.runInContext(source('xiaoyuan-menu.js'),u.c);
  const trigger=u.top.querySelector('.xy-more-trigger'),menu=u.app.querySelector('.xy-more-menu');assert.equal(menu.hidden,true);assert.equal(u.top.querySelectorAll('.sk-header-entry').length,1);
  for(let i=0;i<3;i++){trigger.click();assert.equal(menu.hidden,false);menu.querySelectorAll('button')[i].click();assert.equal(menu.hidden,true);}
  assert.deepEqual(opened,['memory','strategy','subscription']);trigger.click();u.app.listeners.keydown({key:'Escape',preventDefault(){}});assert.equal(menu.hidden,true);assert.equal(u.doc.activeElement,trigger);
  for(const file of ['owner-memory.js','strategies.js','subscriptions.js'])assert.equal(source(file).includes('before(shortcut)'),false);
});
test('My Skill capsule sits beside questions, shows every skill and runs enabled items',async()=>{
  const list=Array.from({length:8},(_,i)=>({id:'test-'+i,name:'自定义技能 '+i,prompt:'输出简报',description:'我的任务',days:7,plants:[],enabled:i!==7}));
  const u=ui(new Map([['xy-installer-skills-v1',JSON.stringify(list)]]));vm.runInContext(source('owner-memory.js'),u.c);
  const toggle=()=>u.doc.getElementById('sk-shortcut-toggle'),panel=()=>u.doc.getElementById('sk-shortcut-panel'),guess=()=>u.app.querySelectorAll('button').find(b=>b.attrs['aria-controls']==='om-recommendations');
  assert.equal(toggle().parentElement,guess().parentElement);assert.equal(toggle().attrs['aria-expanded'],'false');assert.equal(panel().hidden,true);
  guess().click();assert.equal(guess().attrs['aria-expanded'],'true');toggle().click();assert.equal(guess().attrs['aria-expanded'],'false');assert.equal(panel().hidden,false);
  assert.equal(panel().querySelectorAll('.sk-shortcut-item').length,8);assert.ok(panel().textContent.includes('自定义技能 7'));
  panel().querySelectorAll('.sk-shortcut-item')[7].click();assert.equal(u.calls.length,0);assert.equal(panel().hidden,false);
  u.input.value='尚未发送的草稿';panel().querySelectorAll('.sk-shortcut-item')[0].click();assert.equal(u.calls.length,0);assert.equal(u.input.value,'尚未发送的草稿');assert.equal(panel().hidden,false);
  u.input.value='';panel().querySelectorAll('.sk-shortcut-item')[0].click();await tick();assert.equal(u.calls.length,1);assert.equal(panel().hidden,true);assert.ok(u.chat.textContent.includes('自定义技能 0'));
  toggle().click();guess().click();assert.equal(panel().hidden,true);assert.equal(guess().attrs['aria-expanded'],'true');
});
test('capsule synchronizes create, rename and delete; empty state provides creation',()=>{
  const u=ui(new Map([['xy-installer-skills-v1','[]']]));vm.runInContext(source('owner-memory.js'),u.c);
  const panel=()=>u.doc.getElementById('sk-shortcut-panel');u.doc.getElementById('sk-shortcut-toggle').click();assert.ok(panel().textContent.includes('还没有创建技能'));
  u.click('＋ 创建技能',panel());u.inputFor('技能名称').value='我的新任务';u.inputFor('详细提示词').value='写三条巡检建议';u.app.querySelector('form').listeners.submit({preventDefault(){}});
  assert.equal(panel().querySelectorAll('.sk-shortcut-item').length,1);assert.ok(panel().textContent.includes('我的新任务'));
  u.click('编辑',u.card('我的新任务'));u.inputFor('技能名称').value='改名后的任务';u.app.querySelector('form').listeners.submit({preventDefault(){}});assert.ok(panel().textContent.includes('改名后的任务'));assert.equal(panel().textContent.includes('我的新任务'),false);
  u.click('删除',u.card('改名后的任务'));assert.equal(panel().querySelectorAll('.sk-shortcut-item').length,0);assert.ok(panel().textContent.includes('还没有创建技能'));
  u.c.OwnerMemory.newSession();assert.equal(panel().hidden,true);
});
test('comparison exists only after explicit save; no typing creates a persistent user skill',()=>{
  const u=ui();vm.runInContext(source('owner-memory.js'),u.c);u.c.CustomSkills.open();
  assert.equal(u.app.querySelectorAll('.sk-library-card').length,0);assert.equal(u.doc.getElementById('sk-shortcut-panel').querySelectorAll('.sk-shortcut-item').length,0);
  u.click('＋ 创建技能');assert.equal(u.inputFor('技能名称').value,'横向对比电站 Skill');assert.ok(u.inputFor('一句话说明').value.length>0);assert.ok(u.inputFor('详细提示词').value.length>100);
  assert.equal(u.store.has('xy-installer-skills-v1'),false);u.app.querySelector('form').listeners.submit({preventDefault(){}});
  const saved=JSON.parse(u.store.get('xy-installer-skills-v1'));assert.equal(saved.length,1);assert.notEqual(saved[0].id,'installer-compare');assert.equal(saved[0].name,'横向对比电站 Skill');assert.equal(saved[0].days,7);assert.equal(saved[0].plants.length,0);
  assert.ok(u.doc.getElementById('sk-shortcut-panel').textContent.includes('横向对比电站 Skill'));
  const reload=ui(u.store);reload.c.CustomSkills.open();assert.equal(reload.app.querySelectorAll('.sk-library-card').length,1);reload.click('删除',reload.card('横向对比电站 Skill'));
  const afterDelete=ui(u.store);afterDelete.c.CustomSkills.open();assert.equal(afterDelete.app.querySelectorAll('.sk-library-card').length,0);
});
test('legacy preinstalled comparison is removed while actual user skills survive',()=>{
  const stored=[{...model().template(),id:'installer-compare',name:'多电站横向对比'},{...model().template(),id:'user-created',name:'我创建的技能'}];
  const u=ui(new Map([['xy-installer-skills-v1',JSON.stringify(stored)]]));u.c.CustomSkills.open();assert.equal(u.app.querySelectorAll('.sk-library-card').length,1);assert.ok(u.card('我创建的技能'));assert.equal(u.card('多电站横向对比'),undefined);
});
test('empty new fields fall back to comparison defaults; natural-language creation opens the draft only',()=>{
  const u=ui();assert.equal(u.c.CustomSkills.handle('帮我创建一个横向对比电站Skill'),true);
  u.inputFor('技能名称').value='  ';u.inputFor('一句话说明').value='';u.inputFor('详细提示词').value='';assert.equal(u.store.has('xy-installer-skills-v1'),false);
  u.app.querySelector('form').listeners.submit({preventDefault(){}});const s=JSON.parse(u.store.get('xy-installer-skills-v1'))[0];assert.equal(s.name,'横向对比电站 Skill');assert.ok(s.prompt.includes('横向对比'));assert.ok(s.description.length>0);
});
