/* Local, structured owner interests. Never persist raw questions or attachments. */
(function () {
  'use strict';
  const DAY = 86400000, LONG_TTL = 90 * DAY;
  const TOPICS = {
    revenue: {name:'收益', icon:'¥', question:s=>`${s}今天收益怎么样？`},
    generation: {name:'发电量', icon:'↗', question:s=>`${s}今天发了多少电？`},
    health: {name:'健康度', icon:'♡', question:s=>`查询${s}健康度`},
    temperature: {name:'逆变器温度', icon:'♨', question:s=>`${s}逆变器当前温度和未来过热风险怎么样？`},
    tariff: {name:'电价', icon:'◷', question:s=>`${s}当前购电和上网电价是多少？`},
    battery: {name:'储能电量', icon:'▤', question:s=>`${s}储能当前SOC是多少？`}
  };
  const empty = () => ({enabled:true, long:[], recent:[], hidden:[]});
  const key = r => r.topic + '|' + r.station;
  function clean(raw, now=Date.now()) {
    const s=empty();
    if (!raw || typeof raw!=='object') return s;
    s.enabled=raw.enabled!==false;
    const valid=r=>r && Object.hasOwn(TOPICS,r.topic) && typeof r.station==='string' && r.station.length>0 && r.station.length<=48 && Number.isFinite(r.at) && r.at<=now+60000;
    const unique=rows=>[...new Map(rows.map(r=>[key(r),r])).values()];
    s.long=unique((Array.isArray(raw.long)?raw.long:[]).filter(r=>valid(r)&&now-r.at<LONG_TTL).map(r=>({topic:r.topic,station:r.station,at:r.at,count:Math.min(999,Math.max(0,Math.floor(Number(r.count)||0))),pinned:r.pinned===true}))).slice(-36);
    s.recent=unique((Array.isArray(raw.recent)?raw.recent:[]).filter(r=>valid(r)&&now-r.at<DAY).map(r=>({topic:r.topic,station:r.station,at:r.at}))).slice(-6);
    s.hidden=(Array.isArray(raw.hidden)?raw.hidden:[]).filter(k=>typeof k==='string'&&k.length<100).slice(-36);
    return s;
  }
  function classify(q) {
    // Shortcuts only retrieve data. Do not learn commands, credentials, uploaded content or personal strings.
    if(typeof q!=='string'||q.length>180||/修改|更新|设置|设为|改成|增加|删除|关闭|开启|停机|密码|验证码|邮箱|手机号|\d{7,}|@|https?:/i.test(q)) return null;
    if (/温度|过热|温升/.test(q)) return 'temperature';
    if (/健康/.test(q)) return 'health';
    if (/电价|电费单价/.test(q)) return 'tariff';
    if (/收益|收入|赚了|赚多少|挣了/.test(q)) return 'revenue';
    if (/发电量|发了多少电|发多少电|发电情况/.test(q)) return 'generation';
    if (/SOC|剩余电量|储能.*电量/i.test(q)) return 'battery';
    return null;
  }
  function learn(state, q, station, now=Date.now()) {
    const s=clean(state,now),topic=classify(q);
    if(!s.enabled||!topic||!station||station.length>48) return s;
    const r={topic,station,at:now},k=key(r);
    if(s.hidden.includes(k)) return s;
    const old=s.long.find(x=>key(x)===k);
    s.long=s.long.filter(x=>key(x)!==k).concat({...r,count:(old?.count||0)+1,pinned:old?.pinned||false}).slice(-36);
    s.recent=s.recent.filter(x=>key(x)!==k).concat(r).slice(-6);
    return s;
  }
  function suggestions(state, station, now=Date.now()) {
    const s=clean(state,now), candidates=new Map();
    if(s.enabled){
      s.long.filter(r=>r.pinned||r.count>=3).forEach(r=>candidates.set(key(r),{...r,source:r.pinned?'已置顶':'长期常问',score:r.pinned?10000:100+r.count}));
      s.recent.forEach((r,i)=>{
        const old=candidates.get(key(r));
        if(!old?.pinned)candidates.set(key(r),{...r,count:s.long.find(x=>key(x)===key(r))?.count||1,source:'近期关注',score:2000+i});
      });
    }
    ['revenue','generation','health','tariff','battery'].forEach(topic=>{
      const r={topic,station,source:'常用问题',score:0,count:0};
      if(!candidates.has(key(r))&&!s.hidden.includes(key(r)))candidates.set(key(r),r);
    });
    return [...candidates.values()].sort((a,b)=>b.score-a.score).map(r=>({...r,query:TOPICS[r.topic].question(r.station)}));
  }
  function presets(station,hidden=[]){
    return ['revenue','generation','health','temperature','battery','tariff'].map(topic=>({topic,station,preset:true,source:'预制问题',score:50,count:0,query:TOPICS[topic].question(station)})).filter(r=>!hidden.includes(key(r)));
  }
  const Model={empty,clean,classify,learn,suggestions,presets,key,topics:TOPICS};
  globalThis.OwnerMemoryModel=Model;
  if(typeof document==='undefined')return;

  const REAL='xy-owner-memory-v1', SHORT='xy-owner-recent-v1', SAMPLE='xy-owner-sample-v1', MODE='xy-owner-sample-mode';
  function read(store,k,fallback){try{return JSON.parse(globalThis[store].getItem(k))??fallback;}catch{return fallback;}}
  let sample=false, storageFailed=false, rotation=0, expanded=false, activeTab='recent', previouslyFocused;
  try { sample=sessionStorage.getItem(MODE)==='1'; } catch {}
  function load(){
    if(sample)return clean(read('sessionStorage',SAMPLE,empty()));
    const saved=read('localStorage',REAL,empty());
    return clean({...saved,recent:read('sessionStorage',SHORT,[])});
  }
  let state=load();
  function save(){
    try{
      if(sample)sessionStorage.setItem(SAMPLE,JSON.stringify(state));
      else{
        localStorage.setItem(REAL,JSON.stringify({...state,recent:[]}));
        sessionStorage.setItem(SHORT,JSON.stringify(state.recent));
      }
    }catch{storageFailed=true;}
  }
  function plantNames(){return typeof stations!=='undefined'?stations.map(s=>s.name):[];}
  function stationFor(q=''){
    const names=plantNames(),explicit=names.find(n=>q.includes(n))||names.find(n=>q.includes(n.slice(0,2)));
    if(explicit)return explicit;
    if(typeof xyScope!=='undefined'&&xyScope!=='all')return xyScope;
    const recent=state.recent.at(-1)?.station;
    if(recent&&names.includes(recent))return recent;
    return names.find(n=>n.includes('苏州'))||names[0]||'苏州仿真电站';
  }
  function el(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function button(text,fn,cls=''){const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;}
  function note(text){if(typeof toast==='function')toast(text);}
  if(!document.getElementById('xiaoyuan'))return;
  const compact=el('div','om-compact');compact.setAttribute('aria-label','个性化快捷提问');
  document.querySelector('.xy-bottom').prepend(compact);
  const overlay=el('div','om-overlay');overlay.hidden=true;
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','小源的记忆');
  document.getElementById('xiaoyuan').append(overlay);

  function ask(r){
    if(typeof generating!=='undefined'&&generating){note('请等待当前回答完成后再提问');return;}
    if((typeof pendingImgs!=='undefined'&&pendingImgs.length)||globalThis.ProductionStrategy?.hasFile()){
      note('请先发送或移除已选附件，再使用快捷提问');return;
    }
    const input=document.getElementById('xy-input');
    if(input.value.trim()){input.focus();note('输入框中还有草稿，请先发送或清空');return;}
    expanded=false;render();askAI(r.query);
  }
  function capsule(r,small=false){
    const b=button('',()=>ask(r),small?'om-pill om-small':'om-pill');
    b.title=r.query;b.setAttribute('aria-label',r.query+'，'+r.source);
    b.append(el('span','om-topic-icon om-'+r.topic,TOPICS[r.topic].icon));
    const copy=el('span','om-pill-copy');copy.append(el('span','',small?r.station.slice(0,2)+' · '+TOPICS[r.topic].name:r.query));
    if(!small)copy.append(el('small','',r.source+(r.source==='长期常问'?' · 已问 '+r.count+' 次':'')));
    b.append(copy);return b;
  }
  function render(){
    state=clean(state);
    const station=stationFor(),candidates=new Map(suggestions(state,station).map(r=>[key(r),r]));
    if(state.enabled)presets(station,state.hidden).forEach(r=>{if(!candidates.has(key(r))||candidates.get(key(r)).score===0)candidates.set(key(r),r);});
    const list=[...candidates.values()].sort((a,b)=>b.score-a.score),limit=Math.min(3,list.length);
    // Manual rotation browses other recent/preset questions while pinned items stay first.
    const priority=list.filter(r=>r.score>=10000),rest=list.filter(r=>r.score<10000);
    const ordered=[...priority,...rest.slice(rotation%Math.max(1,rest.length)),...rest.slice(0,rotation%Math.max(1,rest.length))].slice(0,limit);
    compact.replaceChildren();
    const heading=el('div','om-compact-heading');
    const toggle=button('',()=>{expanded=!expanded;if(expanded)globalThis.CustomSkills?.collapseShortcut();render();compact.querySelector('button')?.focus();},'om-compact-label');
    toggle.append(el('span','','猜你想问'),el('span','om-chevron',expanded?'⌃':'›'));
    toggle.setAttribute('aria-label',expanded?'收起猜你想问':'展开猜你想问');
    toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-controls','om-recommendations');
    heading.append(toggle);
    if(sample)heading.append(el('small','om-sample-label','业主样例'));
    compact.append(heading);
    const panel=el('div','om-panel');panel.id='om-recommendations';panel.hidden=!expanded;
    const tools=el('div','om-panel-tools');tools.append(button('近期关注',()=>{activeTab='recent';openManager();},'om-text-button'),button('换一组',()=>{rotation+=3;render();},'om-text-button'));panel.append(tools);
    const strip=el('div','om-strip');ordered.forEach(r=>strip.append(capsule(r,true)));panel.append(strip);compact.append(panel);
    globalThis.CustomSkills?.renderShortcut(heading,compact,()=>{expanded=false;render();});
    globalThis.appendWelcomeShortcuts?.(heading);
    if(storageFailed&&expanded)compact.append(el('p','om-caption','本次记忆仅在当前页面保留。'));
  }
  function inertSiblings(on){[...overlay.parentElement.children].filter(e=>e!==overlay).forEach(e=>{e.inert=on;});}
  function closeManager(){overlay.hidden=true;inertSiblings(false);previouslyFocused?.focus();}
  function openManager(){previouslyFocused=document.activeElement;overlay.hidden=false;inertSiblings(true);renderManager();overlay.querySelector('button')?.focus();}
  function changed(){rotation=0;save();render();if(!overlay.hidden)renderManager();}
  function sampleData(){
    const now=Date.now(),s=empty(),station=stationFor();
    ['revenue','generation','health'].forEach((topic,i)=>s.long.push({topic,station,count:6-i,at:now-(i+1)*DAY,pinned:false}));
    s.recent=[{topic:'revenue',station,at:now-600000}];
    return s;
  }
  function toggleSample(){
    sample=!sample;rotation=0;expanded=true;
    try{sessionStorage.setItem(MODE,sample?'1':'0');}catch{storageFailed=true;}
    state=sample?sampleData():load();changed();note(sample?'已载入业主样例，你自己的记忆会保留':'已返回你的记忆');
  }
  function remove(k){state.long=state.long.filter(r=>key(r)!==k);state.recent=state.recent.filter(r=>key(r)!==k);state.hidden=[...state.hidden,k].slice(-36);changed();note('已忘记，不再推荐这个问题');}
  function renderManager(){
    const oldButtons=[...overlay.querySelectorAll('button')],focusIndex=oldButtons.indexOf(document.activeElement);
    overlay.replaceChildren();
    const header=el('div','om-manager-header');header.append(el('h3','','小源的记忆'),button('关闭',closeManager,'om-text-button'));overlay.append(header);
    const body=el('div','om-manager-body');overlay.append(body);
    const intro=el('div','om-info');intro.append(el('strong','',sample?'正在体验业主样例':'记住关心的事，下次少打字'),el('p','','近期关注保留本次对话，最长 24 小时；同类问题问满 3 次，进入长期常问，保留 90 天。可随时置顶或忘记。'));body.append(intro);
    const toggle=button('个性化推荐 '+(state.enabled?'已开启':'已暂停'),()=>{state.enabled=!state.enabled;changed();},'om-toggle');toggle.setAttribute('aria-pressed',String(state.enabled));body.append(toggle);
    const tabs=el('div','om-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','记忆类型');
    ['recent','long'].forEach((t,i)=>{const b=button(i?'长期常问':'近期关注',()=>{activeTab=t;renderManager();},activeTab===t?'on':'');b.setAttribute('role','tab');b.setAttribute('aria-selected',String(activeTab===t));tabs.append(b);});body.append(tabs);
    const recent=state.recent.slice().reverse(),seen=new Set(recent.map(key));
    const rows=activeTab==='recent'?[...recent,...presets(stationFor(),state.hidden).filter(r=>!seen.has(key(r)))]:state.long.slice().sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.count-a.count);
    if(activeTab==='recent')body.append(el('p','om-empty',recent.length?'先显示本次对话关注的问题，下面补充了可直接点击的预制问题。':'先试试这些业主常问的问题，点击后会进入本次对话的近期关注。'));
    if(!rows.length)body.append(el('p','om-empty',activeTab==='recent'?'本次对话还没有关注记录，先问问收益或温度吧。':'还没有常问记录。你可以把最近关注的问题置顶。'));
    rows.forEach(r=>{
      const card=el('section','om-memory-row'),record=state.long.find(x=>key(x)===key(r));
      card.append(button(TOPICS[r.topic].question(r.station),()=>{closeManager();ask({...r,query:TOPICS[r.topic].question(r.station)});},'om-memory-query'));
      const footer=el('div','om-memory-footer');
      footer.append(el('small','',record?.pinned?'已置顶':r.preset?'预制问题 · 点击即可提问':activeTab==='recent'?'本次对话 · 近期关注':record.count>=3?'已问 '+record.count+' 次 · 长期常问':'已问 '+record.count+' 次 · 再问 '+(3-record.count)+' 次加入常问'));
      const pin=button(record?.pinned?'取消置顶':'置顶',()=>{if(record)record.pinned=!record.pinned;else state.long.push({topic:r.topic,station:r.station,at:Date.now(),count:0,pinned:true});changed();},'om-text-button');pin.setAttribute('aria-pressed',String(!!record?.pinned));
      footer.append(pin,button('忘记',()=>remove(key(r)),'om-text-button'));card.append(footer);body.append(card);
    });
    const demo=el('section','om-demo');demo.append(el('strong','','体验记忆如何变化'),el('p','','1. 载入业主常问样例 → 2. 切换最近关注 → 3. 新开对话，长期常问仍保留。'),button(sample?'退出业主样例':'载入业主样例',toggleSample,'om-action'));
    if(sample){
      demo.append(button('模拟最近关注：逆变器温度',()=>{state=learn(state,'逆变器温度会不会过高',stationFor());activeTab='recent';expanded=true;changed();note('近期关注已变化，可关闭面板查看胶囊');},'om-secondary'));
      demo.append(button('新开对话，验证长期记忆',()=>{closeManager();newChat();},'om-secondary'));
    }
    body.append(demo,el('p','om-privacy',storageFailed?'存储不可用：本次记忆仅在当前页面生效。':'记忆仅保存在当前浏览器。本功能只记录电站名称、问题类别、次数和时间，不保存原始对话或附件。样例与自己的记忆分开保存。'));
    body.append(button('清空'+(sample?'样例':'我的')+'记忆',()=>{state=empty();changed();note('已清空记忆');},'om-clear'));
    if(focusIndex>=0){const buttons=[...overlay.querySelectorAll('button')];buttons[Math.min(focusIndex,buttons.length-1)]?.focus();}
  }
  overlay.addEventListener('keydown',e=>{
    if(e.key==='Escape'){e.preventDefault();closeManager();return;}
    if(e.key!=='Tab')return;
    const focusable=[...overlay.querySelectorAll('button')],first=focusable[0],last=focusable.at(-1);
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
  });
  globalThis.OwnerMemory={
    record(q){const station=stationFor(q);state=learn(state,q,station);changed();},
    newSession(){state.recent=[];expanded=false;globalThis.CustomSkills?.collapseShortcut();changed();},
    render,refresh(){rotation++;render();},open:openManager,
    close:closeManager
  };
  window.addEventListener('storage',e=>{if(e.key===REAL&&!sample){state=load();render();if(!overlay.hidden)renderManager();}});
  render();
})();
