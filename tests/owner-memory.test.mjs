import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/js/owner-memory.js',import.meta.url),'utf8');
function model(){const c=vm.createContext({});vm.runInContext(source,c);return c.OwnerMemoryModel;}
const now=Date.parse('2026-11-10T10:00:00Z'),day=86400000,station='苏州仿真电站';
test('semantic interests mature after three questions without retaining original messages',()=>{
  const M=model();let s=M.empty();
  for(let i=0;i<3;i++)s=M.learn(s,'我想知道今天收益怎么样',station,now+i);
  assert.equal(s.long[0].count,3);assert.equal(s.recent.length,1);
  assert.equal(M.suggestions({...s,recent:[]},station,now+4)[0].source,'长期常问');
  assert.equal(JSON.stringify(s).includes('我想知道'),false);
  assert.deepEqual(Object.keys(s.long[0]).sort(),['at','count','pinned','station','topic']);
});
test('memory excludes commands, personal information and unrelated text',()=>{
  const M=model();
  for(const q of ['上网电价改成0.4元','更新收益策略','关闭电站','邮箱a@b.com收益','验证码12345678收益','你好','设备密码收益','https://x.com/收益']){
    assert.equal(M.learn(M.empty(),q,station,now).long.length,0,q);
  }
  assert.equal(M.classify('电池SOC是多少'),'battery');
});
test('recent interests rank before frequent topics; pins rank first; plants remain distinct',()=>{
  const M=model();let s=M.empty();
  for(let i=0;i<5;i++)s=M.learn(s,'收益多少',station,now+i);
  s=M.learn(s,'温度会过高吗','山东济宁光储电站',now+6);
  let list=M.suggestions(s,station,now+7);assert.equal(list[0].topic,'temperature');assert.ok(list[0].query.includes('山东济宁'));
  s.long[0].pinned=true;list=M.suggestions(s,station,now+7);assert.equal(list[0].source,'已置顶');
  s.enabled=false;assert.ok(M.suggestions(s,station,now+7).every(r=>r.source==='常用问题'));
});
test('short memory expires in 24h, long in 90d; invalid and inherited topics are removed',()=>{
  const M=model(),s=M.learn(M.empty(),'收益如何',station,now);
  assert.equal(M.clean(s,now+day).recent.length,0);assert.equal(M.clean(s,now+day).long.length,1);
  assert.equal(M.clean(s,now+90*day).long.length,0);
  s.long.push({topic:'__proto__',station,at:now,count:3},{topic:'health',station,at:now+2*day,count:3});
  assert.equal(M.clean(s,now).long.length,1);
});
test('forget suppresses an interest and paused memory does not learn',()=>{
  const M=model();let s=M.empty();s.hidden=[`temperature|${station}`];
  s=M.learn(s,'温度如何',station,now);assert.equal(s.long.length,0);
  assert.ok(M.suggestions(s,station,now).every(r=>r.topic!=='temperature'));
  s.enabled=false;s=M.learn(s,'收益如何',station,now);assert.equal(s.long.length,0);
});

// Minimal DOM exercises the real event handlers and persistence, without a browser dependency.
function ui(local=new Map(),session=new Map()){
  const doc={activeElement:null};
  class Element{
    constructor(tag='div',cls=''){this.tagName=tag;this.className=cls;this.children=[];this.listeners={};this.attrs={};this.value='';this.hidden=false;this.classList={add:()=>{}};}
    append(...nodes){nodes.forEach(n=>{n.parentElement=this;this.children.push(n);});}
    prepend(n){n.parentElement=this;this.children.unshift(n);}
    insertBefore(n,b){n.parentElement=this;this.children.splice(this.children.indexOf(b),0,n);}
    replaceChildren(...nodes){this.children=[];this.append(...nodes);}
    setAttribute(k,v){this.attrs[k]=v;}
    addEventListener(k,fn){this.listeners[k]=fn;}
    querySelectorAll(sel){const all=this.children.flatMap(n=>[n,...n.querySelectorAll(sel)]);return all.filter(n=>n.tagName===sel);}
    querySelector(sel){return this.querySelectorAll(sel)[0];}
    focus(){doc.activeElement=this;}
    click(){this.listeners.click?.({});}
  }
  const nodes={};for(const id of ['xiaoyuan','xy-sugs','xy-input','xy-questions-tab','xy-skills-tab','xy-refresh'])nodes[id]=new Element();
  const top=new Element(),bottom=new Element(),intro=new Element(),chat=new Element(),fresh=new Element(),newButton=new Element('button');top.append(newButton);intro.append(nodes['xy-sugs']);bottom.append(nodes['xy-input']);nodes.xiaoyuan.append(top,intro,chat,bottom);
  const selectors={'.xy-top':top,'.xy-bottom':bottom,'.xy-new-chat':newButton,'.xy-refresh':fresh};
  doc.createElement=t=>new Element(t);doc.getElementById=id=>nodes[id];doc.querySelector=q=>selectors[q];
  const storage=m=>({getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}),asks=[],notes=[];
  const c=vm.createContext({document:doc,window:{addEventListener(){}},localStorage:storage(local),sessionStorage:storage(session),stations:[{name:station},{name:'山东济宁光储电站'}],xyScope:'all',generating:false,pendingImgs:[],toast:t=>notes.push(t),askAI:q=>{asks.push(q);c.OwnerMemory.record(q);},newChat:()=>c.OwnerMemory.newSession()});
  vm.runInContext(source,c);
  const buttons=()=>nodes.xiaoyuan.querySelectorAll('button');
  const click=text=>{const b=buttons().find(b=>b.textContent===text);assert.ok(b,`button ${text}`);b.click();};
  return {c,nodes,local,session,asks,notes,buttons,click};
}
test('sample mode is isolated, exit restores own memory, new chat clears recent only',()=>{
  const u=ui();for(let i=0;i<3;i++)u.c.OwnerMemory.record('苏州今天收益如何');
  const own=u.local.get('xy-owner-memory-v1');
  u.c.OwnerMemory.open();u.click('载入业主样例');u.click('模拟最近关注：逆变器温度');
  assert.equal(u.local.get('xy-owner-memory-v1'),own);
  assert.ok(u.session.get('xy-owner-sample-v1').includes('temperature'));
  u.click('新开对话，验证长期记忆');
  const sample=JSON.parse(u.session.get('xy-owner-sample-v1'));assert.equal(sample.recent.length,0);assert.equal(sample.long.find(r=>r.topic==='revenue').count,6);
  u.c.OwnerMemory.open();u.click('退出业主样例');assert.equal(u.local.get('xy-owner-memory-v1'),own);
  u.c.OwnerMemory.newSession();assert.equal(JSON.parse(u.session.get('xy-owner-recent-v1')).length,0);
  assert.equal(JSON.parse(u.local.get('xy-owner-memory-v1')).long[0].count,3);
  const reloaded=ui(u.local,u.session);assert.ok(reloaded.buttons().some(b=>b.attrs['aria-label']?.includes('长期常问')));
});
test('capsule sends exact read-only question, guards active replies, attachments and drafts',()=>{
  const u=ui();const capsule=()=>u.buttons().find(b=>b.attrs['aria-label']?.includes('今天收益怎么样'));
  u.c.generating=true;capsule().click();assert.equal(u.asks.length,0);
  u.c.generating=false;u.c.pendingImgs=['photo'];capsule().click();assert.equal(u.asks.length,0);
  u.c.pendingImgs=[];u.nodes['xy-input'].value='我的草稿';capsule().click();assert.equal(u.asks.length,0);assert.equal(u.nodes['xy-input'].value,'我的草稿');
  u.nodes['xy-input'].value='';capsule().click();assert.deepEqual(u.asks,[`${station}今天收益怎么样？`]);
});
test('manager pin, forget and pause controls update persisted and displayed memory',()=>{
  const u=ui();u.c.OwnerMemory.record('苏州今天收益如何');u.c.OwnerMemory.open();u.click('置顶');
  assert.equal(JSON.parse(u.local.get('xy-owner-memory-v1')).long[0].pinned,true);
  u.click('忘记');assert.equal(JSON.parse(u.local.get('xy-owner-memory-v1')).long.length,0);
  u.c.OwnerMemory.record('苏州今天收益如何');assert.equal(JSON.parse(u.local.get('xy-owner-memory-v1')).long.length,0);
  u.click('个性化推荐 已开启');u.c.OwnerMemory.record('查询健康度');assert.equal(JSON.parse(u.local.get('xy-owner-memory-v1')).long.length,0);
});
test('left entry starts collapsed, toggles disclosure, rotates questions and folds after sending',()=>{
  const u=ui(),toggle=()=>u.buttons().find(b=>b.attrs['aria-controls']==='om-recommendations');
  const panel=()=>u.nodes.xiaoyuan.querySelectorAll('div').find(e=>e.id==='om-recommendations');
  assert.equal(toggle().attrs['aria-expanded'],'false');assert.equal(panel().hidden,true);
  toggle().click();assert.equal(toggle().attrs['aria-expanded'],'true');assert.equal(panel().hidden,false);
  const first=()=>panel().querySelectorAll('button').find(b=>b.className.includes('om-pill'));
  const before=first().attrs['aria-label'];u.click('换一组');assert.notEqual(first().attrs['aria-label'],before);
  first().click();assert.equal(u.asks.length,1);assert.equal(toggle().attrs['aria-expanded'],'false');assert.equal(panel().hidden,true);
  toggle().click();toggle().click();assert.equal(panel().hidden,true);
});
test('six recent presets are available without fabricated history; pinning does not count as asking',()=>{
  const u=ui();u.c.OwnerMemory.open();
  const rows=()=>u.buttons().filter(b=>b.className==='om-memory-query');
  assert.equal(rows().length,6);assert.equal(u.local.has('xy-owner-memory-v1'),false);
  u.click('置顶');assert.equal(JSON.parse(u.local.get('xy-owner-memory-v1')).long[0].count,0);
  rows()[0].click();assert.equal(u.asks.length,1);
  assert.equal(JSON.parse(u.local.get('xy-owner-memory-v1')).long[0].count,1);
  assert.equal(JSON.parse(u.session.get('xy-owner-recent-v1')).length,1);
  const M=u.c.OwnerMemoryModel,hidden=[`temperature|${station}`];
  assert.equal(M.presets(station,hidden).length,5);
  assert.ok(M.presets(station,hidden).every(r=>r.topic!=='temperature'));
});
test('welcome questions and skills remain independent of personalized memory',()=>{
  const u=ui(),monitor=fs.readFileSync(new URL('../public/js/monitor.js',import.meta.url),'utf8');
  vm.runInContext(monitor.slice(monitor.indexOf('const sugs ='),monitor.indexOf('const lvIcon'))+monitor.slice(monitor.indexOf('let sugIdx = 0;'),monitor.indexOf('/* ---------- 小源对话 ---------- */')),u.c);
  const home=u.nodes['xy-sugs'];u.c.renderSugs();
  const questions=()=>home.querySelectorAll('button').map(b=>b.children[1].children[1].textContent);
  const first=questions();assert.equal(first.length,4);assert.ok(first.includes('我名下有哪些电站？'));
  u.c.OwnerMemory.render();u.c.OwnerMemory.refresh();u.c.OwnerMemory.newSession();assert.deepEqual(questions(),first);
  const toggle=u.buttons().find(b=>b.attrs['aria-controls']==='om-recommendations');toggle.click();assert.deepEqual(questions(),first);
  u.c.refreshSugs();const second=questions();assert.notDeepEqual(second,first);
  u.c.selectWelcome('skills');assert.equal(u.nodes['xy-refresh'].hidden,true);
  u.nodes['xy-input'].value='还在写';
  home.children[0].click();assert.equal(u.asks.length,0);assert.equal(u.nodes['xy-input'].value,'还在写');
  u.nodes['xy-input'].value='';
  const opened=[];
  u.c.ChatSkillSheet={open:key=>opened.push(key)};
  home.children[0].click();home.children[1].click();
  assert.deepEqual(opened,['design','battery']);assert.equal(u.asks.length,0);
  u.c.selectWelcome('questions');assert.deepEqual(questions(),second);
  assert.equal(u.nodes['xy-refresh'].hidden,false);
});
