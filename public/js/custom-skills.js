(function(){
  'use strict';
  const M=globalThis.CustomSkillModel,KEY='xy-installer-skills-v1';
  if(!M||!document.getElementById('xiaoyuan'))return;
  let plants=[],layer,view='list',focusBefore,saveFailed=false,refreshScope,shortcutOpen=false;
  function readSkills(){try{const stored=JSON.parse(localStorage.getItem(KEY));return Array.isArray(stored)?stored.filter(s=>s&&s.id!=='installer-compare').map(M.normalize).filter(s=>!M.validate(s).length).slice(0,24):[];}catch{return [];}}
  let skills=readSkills();
  const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  const tell=text=>{if(typeof toast==='function')toast(text);};
  function save(){try{localStorage.setItem(KEY,JSON.stringify(skills));saveFailed=false;}catch{saveFailed=true;tell('存储不可用，技能仅在当前页面保留');}globalThis.OwnerMemory?.render();}
  function cachedPlants(){return typeof PLANTS!=='undefined'&&Array.isArray(PLANTS)?PLANTS:[];}
  async function refreshPlants(signal){try{const result=await WorkspaceClient.request('state',{signal:signal?AbortSignal.any([signal,AbortSignal.timeout(6000)]):AbortSignal.timeout(6000)});plants=result.snapshot?.plants||[];return true;}catch{if(!plants.length)plants=cachedPlants();return false;}}
  function inert(on){[...layer.parentElement.children].filter(e=>e!==layer).forEach(e=>{e.inert=on;});}
  function close(){if(!layer||layer.hidden)return;layer.hidden=true;inert(false);focusBefore?.focus();}
  function shell(title,back){
    layer.replaceChildren();const head=el('header','sk-header');head.append(button(back?'‹ 返回':'关闭',back||close,'sk-text'),el('strong','',title));if(back)head.append(button('关闭',close,'sk-text'));layer.append(head);const body=el('div','sk-body');layer.append(body);return body;
  }
  function list(){
    view='list';refreshScope=null;const body=shell('我的技能');
    const hero=el('section','sk-hero');hero.append(el('span','sk-eyebrow','✦ 小源技能空间'),el('h3','','把常用任务，变成自己的技能'),el('p','','写下提示词，选择周期和电站，小源就能按你的要求完成任务。'),button('＋ 创建技能',()=>edit(),'sk-primary'));body.append(hero);
    if(!skills.length)body.append(el('p','sk-note','还没有技能，创建一个你经常会用到的任务吧。'));
    skills.forEach(s=>{
      const card=el('section','sk-library-card'),top=el('div','sk-row');top.append(el('span','sk-icon','✦'),el('strong','',s.name),el('small',s.enabled?'sk-status':'sk-status off',s.enabled?'已启用':'未启用'));card.append(top,el('p','sk-note',s.description||'按自定义提示词执行任务'),el('div','sk-chips',`近 ${s.days} 天 · ${s.plants.length?s.plants.length+' 个电站':'全部电站'}`));
      const actions=el('div','sk-actions');actions.append(button('在对话中运行',()=>invoke(s),'sk-primary'),button('编辑',()=>edit(s),'sk-secondary'));card.append(actions);
      const manage=el('div','sk-actions sk-manage');manage.append(button('复制创建',()=>edit({...s,id:'',name:s.name+' · 副本'}),'sk-text'),button(s.enabled?'停用':'启用',()=>{s.enabled=!s.enabled;save();list();},'sk-text'),button('删除',()=>{skills=skills.filter(x=>x.id!==s.id);save();list();tell('已删除技能');},'sk-text'));card.append(manage);body.append(card);
    });
    const how=el('section','sk-help');how.append(el('strong','','在对话里按名称调用'),el('p','','创建保存后，说「运行技能：横向对比电站 Skill」即可调用。你也可以修改提示词，创建巡检总结、收益简报等其他任务。'),el('p','sk-note',saveFailed?'本次配置仅在当前页面保留。':'技能配置保存在当前浏览器，刷新后可继续使用。'));body.append(how);
  }
  function field(parent,label,value,tag='input'){
    const wrap=el('label','sk-field'),input=el(tag);wrap.append(el('span','',label));if(tag==='input')input.type='text';input.value=String(value??'');wrap.append(input);parent.append(wrap);return input;
  }
  function edit(original){
    view='edit';const fresh=!original?.id,defaults=M.template(),s=M.normalize(original||defaults),body=shell(fresh?'创建技能':'编辑技能',list),form=el('form','sk-form');body.append(form);
    const name=field(form,'技能名称',s.name);name.maxLength=32;name.required=!fresh;name.placeholder=defaults.name;
    const description=field(form,'一句话说明',s.description);description.maxLength=100;description.placeholder='这个技能能帮你做什么';
    const prompt=field(form,'详细提示词',s.prompt,'textarea');prompt.maxLength=4000;prompt.rows=7;prompt.required=!fresh;prompt.placeholder='描述要完成的任务、分析方法和期望输出。例如：汇总所选电站的运行情况，列出需要关注的问题，并生成三条巡检建议。';
    const days=field(form,'周期',s.days,'select');[7,30,90].forEach(n=>{const option=el('option','',`近 ${n} 天`);option.value=String(n);days.append(option);});days.value=String(s.days);
    const scope=el('section','sk-scope-field');scope.append(el('h4','','参与的电站'));const selected=new Set(s.plants),choices=el('div','sk-options');scope.append(choices);form.append(scope);
    function plantChoices(){
      choices.replaceChildren();const all=el('label','sk-check'),allInput=el('input');allInput.type='checkbox';allInput.checked=!selected.size;all.append(allInput,el('span','','全部电站'));choices.append(all);
      allInput.addEventListener('change',()=>{if(allInput.checked)selected.clear();plantChoices();});
      plants.forEach(p=>{const row=el('label','sk-check'),check=el('input');check.type='checkbox';check.checked=selected.has(p.id);check.addEventListener('change',()=>{if(check.checked)selected.add(p.id);else selected.delete(p.id);plantChoices();});row.append(check,el('span','',p.name));choices.append(row);});
      if(!plants.length)choices.append(el('p','sk-note','暂未读到电站列表，可先选择全部电站。'));
    }
    refreshScope=plantChoices;plantChoices();
    const error=el('p','sk-error');error.setAttribute('role','alert');form.append(error);const submit=el('button','sk-primary','保存技能');submit.type='submit';form.append(submit);
    form.addEventListener('submit',event=>{
      event.preventDefault();const draft=M.normalize({...s,name:fresh?(name.value.trim()||defaults.name):name.value,description:fresh?(description.value.trim()||defaults.description):description.value,prompt:fresh?(prompt.value.trim()||defaults.prompt):prompt.value,days:Number(days.value),plants:[...selected]});
      const errors=M.validate(draft);if(skills.some(x=>x.id!==draft.id&&x.name===draft.name))errors.push('已有同名技能，请换一个名称');if(fresh&&skills.length>=24)errors.push('最多保留 24 个技能，请先删除不再使用的技能');
      if(errors.length){error.textContent=errors.join('；');return;}
      skills=skills.filter(x=>x.id!==draft.id).concat(draft);save();list();tell('技能已保存，可在小源中按名称调用');
    });
  }
  function open(){
    openXY();focusBefore=document.activeElement;plants=cachedPlants();
    if(!layer){layer=el('section','sk-layer');layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','自定义技能');document.getElementById('xiaoyuan').append(layer);
      layer.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();return;}if(e.key!=='Tab')return;const nodes=[...layer.querySelectorAll('button,input,textarea,select')].filter(n=>!n.disabled),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});
    }
    layer.hidden=false;inert(true);list();layer.querySelector('button')?.focus();void refreshPlants().then(()=>{if(layer.hidden)return;if(view==='list')list();else refreshScope?.();});
  }
  function invoke(s){
    if(!s.enabled){tell('请先启用这个技能');return;}
    if(typeof generating!=='undefined'&&generating){tell('请等待当前回答完成后再运行技能');return;}
    if(document.getElementById('xy-input').value.trim()||(typeof pendingImgs!=='undefined'&&pendingImgs.length)||globalThis.ProductionStrategy?.hasFile()){tell('请先发送或清空输入框中的内容和附件');return;}
    shortcutOpen=false;globalThis.OwnerMemory?.render();close();askAI('运行技能：'+s.name);
  }
  function renderShortcut(heading,container,rerender){
    const toggle=button('',()=>{shortcutOpen=!shortcutOpen;rerender();document.getElementById('sk-shortcut-toggle')?.focus();},'om-compact-label sk-shortcut-toggle');
    toggle.id='sk-shortcut-toggle';toggle.append(el('span','','我的 Skill'),el('span','sk-shortcut-count',String(skills.length)),el('span','om-chevron',shortcutOpen?'⌃':'›'));
    toggle.setAttribute('aria-label',shortcutOpen?'收起我的 Skill':'展开我的 Skill');toggle.setAttribute('aria-expanded',String(shortcutOpen));toggle.setAttribute('aria-controls','sk-shortcut-panel');const badge=heading.querySelector('.om-sample-label');if(badge)heading.insertBefore(toggle,badge);else heading.append(toggle);
    const panel=el('section','sk-shortcut-panel');panel.id='sk-shortcut-panel';panel.hidden=!shortcutOpen;panel.setAttribute('aria-label','我的全部技能');
    const head=el('div','om-panel-tools');head.append(el('span','sk-shortcut-caption','全部技能 · '+skills.length),button('管理技能',open,'om-text-button'));panel.append(head);
    const items=el('div','sk-shortcut-items');
    skills.forEach(s=>{const b=button('',()=>invoke(s),'sk-shortcut-item'+(s.enabled?'':' off'));b.title=s.description||s.name;b.setAttribute('aria-label','运行技能：'+s.name+(s.enabled?'':'，未启用'));b.setAttribute('aria-disabled',String(!s.enabled));b.append(el('span','',s.name));if(!s.enabled)b.append(el('small','','未启用'));items.append(b);});
    if(!skills.length)items.append(el('p','sk-note','还没有创建技能。'),button('＋ 创建技能',()=>{open();edit();},'sk-text'));
    panel.append(items);container.append(panel);
  }
  async function run(s,question){
    if(generating){tell('请等待当前回答完成后再运行技能');return;}
    const started=performance.now(),id=convoId,controller=new AbortController(),row=addMsg('ai',''),host=el('div','sk-result'),answer=el('div','sk-answer');row.querySelector('.bubble').append(host);
    const head=el('div','sk-result-top');head.append(el('span','sk-eyebrow','✦ 正在运行自定义技能'),el('small','sk-status','近 '+s.days+' 天'));host.append(head,el('h3','',s.name),answer);answer.textContent='正在按你的提示词处理…';
    abortCtl=controller;setGenerating(true);let text='';
    try{
      await refreshPlants(controller.signal);if(controller.signal.aborted)throw new DOMException('已停止','AbortError');if(id!==convoId)return;
      text=await SolarApi.chat({messages:M.messages(s,plants,question),signal:controller.signal,maxTokens:2400,onDelta(value){text=value;if(id===convoId)renderChatMarkdown(answer,value);}});
      if(id!==convoId)return;if(!text)throw new Error('模型未返回结果，请重试');renderChatMarkdown(answer,text);head.children[0].textContent='✦ 自定义技能已完成';
      const details=el('details','sk-method');details.append(el('summary','','查看本次提示词'),el('p','sk-note',s.prompt));host.append(details,button('编辑这个技能',()=>{open();edit(s);},'sk-secondary'));
      convo.history.push({role:'user',content:question},{role:'assistant',content:'技能「'+s.name+'」运行结果：\n'+text});showAnswerTime(row,started);
    }catch(error){
      if(id!==convoId)return;const stopped=controller.signal.aborted||error.name==='AbortError';head.children[0].textContent=stopped?'✦ 技能运行已停止':'✦ 技能暂未完成';
      if(text)renderChatMarkdown(answer,text);else answer.textContent=stopped?'已停止技能运行。':error.message||'暂时无法运行技能，请重试。';
      if(!stopped)host.append(button('重试',()=>void run(s,question),'sk-secondary'));showAnswerTime(row,started);
    }finally{if(id===convoId&&abortCtl===controller){abortCtl=null;setGenerating(false);}}
  }
  const entry=button('技能',open,'sk-header-entry');entry.setAttribute('aria-label','打开自定义技能');document.querySelector('.xy-top').insertBefore(entry,document.querySelector('.xy-new-chat'));
  globalThis.CustomSkills={open,close,renderShortcut,collapseShortcut(){shortcutOpen=false;},handle(q){
    if(/^(打开|查看|管理)(我的|自定义|小源)?(技能|skill)/i.test(q)){open();return true;}
    if(/^(创建|新建|自定义)(一个|我的)?(技能|skill)/i.test(q)||/^(请|帮我|请帮我)?(创建|新建).{0,60}(技能|skill)/i.test(q)){open();edit();return true;}
    const exact=/^(?:运行|使用|执行)(?:技能)?[：:\s]*(.+?)[。！？?\s]*$/.exec(q);
    let s=exact?skills.find(x=>x.name===exact[1]):null;
    if(!s)s=skills.slice().sort((a,b)=>b.name.length-a.name.length).find(x=>q.includes(x.name));
    if(!s&&/(横向对比.*电站|电站.*横向对比|对比.*[各多所].*电站|各.*电站.*对比)/.test(q))s=skills.find(x=>/横向对比/.test(x.name));
    if(!s)return false;
    if(!s.enabled){const row=addMsg('ai','「'+s.name+'」尚未启用，请先在技能空间中启用。');row.querySelector('.bubble').append(button('管理技能',open,'sk-secondary'));showAnswerTime(row,performance.now());return true;}
    void run(s,q);return true;
  }};
  globalThis.addEventListener?.('storage',e=>{if(e.key!==KEY&&e.key!==null)return;skills=readSkills();globalThis.OwnerMemory?.render();if(layer&&!layer.hidden&&view==='list')list();});
  globalThis.OwnerMemory?.render();
})();
