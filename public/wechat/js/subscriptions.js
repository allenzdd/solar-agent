(function(global){
  'use strict';
  const M=global.SubscriptionDemoModel,KEY='solar-subscription-demo-v1';
  const screen=document.querySelector('.screen');if(!screen||!M)return;
  let state={items:[],deliveries:[]},pending=null,tab='items',lastFocus=null;
  const running=new Set();
  try{const raw=JSON.parse(localStorage.getItem(KEY)||'null');if(raw&&Array.isArray(raw.items)&&Array.isArray(raw.deliveries)){state.items=raw.items.filter(s=>s.id&&M.validate(s).length===0).slice(-50);state.deliveries=raw.deliveries.slice(-120);}}catch{}
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  const channelName={email:'邮件',sms:'短信',inapp:'站内通知'};
  const icon={monthly:'▦',profit:'↘',temperature:'♨',offline:'◷'};
  const id=()=>global.crypto?.randomUUID?.()||'sub-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  const fmt=n=>Number.isFinite(n)?n.toLocaleString('zh-CN',{maximumFractionDigits:2,minimumFractionDigits:2}):'暂无数据';
  function plants(){try{return PLANTS.map(p=>({id:p.id,name:p.name,city:p.city,tariff:p.tariff}));}catch{return [];}}
  function scopeName(s){return s.scope==='all'?'全部电站（合计）':plants().find(p=>p.id===s.scope)?.name||'所选电站';}
  function find(s){return state.items.find(x=>x.id===(typeof s==='string'?s:s.id));}
  function commit(next){try{localStorage.setItem(KEY,JSON.stringify(next));state=next;refreshCards();return true;}catch{toast('本浏览器无法保存，请检查存储空间后重试');return false;}}
  function copy(){return JSON.parse(JSON.stringify(state));}
  function record(s,log,patch={}){const next=copy(),p=next.items.find(x=>x.id===s.id);if(!p)return false;Object.assign(p,patch,{updatedAt:Date.now()});next.deliveries.unshift(log);next.deliveries=next.deliveries.slice(0,120);return commit(next);}
  function refreshCards(){document.querySelectorAll('[data-xs-id]').forEach(card=>{const s=find(card.dataset.xsId);if(s)drawSaved(card,s);});}
  function chat(){openXY();document.getElementById('xy-intro').classList.add('hide');document.getElementById('xy-chat').classList.add('on');}
  function say(text){chat();return addMsg('ai',text);}
  const layer=el('section','xs-layer');layer.hidden=true;layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');screen.append(layer);
  function close(){layer.hidden=true;if(lastFocus?.isConnected)lastFocus.focus();}
  function openLayer(title,render,back){lastFocus=document.activeElement;layer.hidden=false;layer.replaceChildren();layer.setAttribute('aria-label',title);const head=el('header','xs-layer-head');head.append(button(back?'‹':'✕',back||close,'xs-icon-button'),el('h2','',title),el('span','xs-demo-tag','演示'));const body=el('div','xs-layer-body');layer.append(head,body);render(body);head.querySelector('button').focus();}
  layer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}if(event.key==='Tab'){const a=[...layer.querySelectorAll('button,input,select,textarea,a[href]')].filter(x=>!x.disabled&&x.getClientRects().length),first=a[0],last=a.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  function header(s){const h=el('div','xs-card-head'),i=el('span','xs-card-icon',icon[s.kind]);const text=el('div');text.append(el('strong','',s.title),el('small','',s.kind==='monthly'?'定时生成 · 按月推送':'条件触发 · 异常提醒'));h.append(i,text,el('span','xs-demo-tag','Demo'));return h;}
  function row(label,value,click){const r=click?button('',click,'xs-detail-row'):el('div','xs-detail-row');r.append(el('span','',label),el('b','',value));if(click)r.append(el('span','xs-chevron','›'));return r;}
  function drawSaved(card,s){
    card.className='xs-card';card.dataset.xsId=s.id;card.replaceChildren(header(s));
    const edit=()=>editSubscription(s.id);
    card.append(row(s.kind==='monthly'?'执行时间':'触发条件',M.description(s),edit),row(s.kind==='monthly'?'报告范围':'监测范围',(s.kind==='monthly'?'上个自然月 · ':'')+scopeName(s),edit),row('通知方式',channelName[s.channel]+' · '+M.mask(s),edit));
    const active=s.status==='active',cancelled=s.status==='cancelled';
    card.append(el('div','xs-success '+(!active?'xs-muted-state':''),active?'✓ 已设置成功 · 演示':cancelled?'已退订 · 可随时恢复':'已暂停 · 不触发提醒'));
    if(active){const plan=s.kind==='monthly'?'下次计划：'+M.format(M.nextRun(s,Date.now()))+'（北京时间）':s.kind==='profit'?'监测完整自然日；同一轮异常只提醒一次，恢复后重新计数。':'条件满足后提醒；同一轮异常只提醒一次。';card.append(el('p','xs-next',plan));}
    if(s.latched&&active)card.append(el('p','xs-latched','本轮异常已模拟提醒，避免重复发送。'));
    const actions=el('div','xs-actions');const send=button(s.kind==='monthly'?'模拟生成并发送':'模拟异常并提醒',()=>simulate(s.id),'xs-primary');send.disabled=!active||running.has(s.id);actions.append(send,button(active?'暂停':cancelled?'恢复订阅':'启用',()=>setStatus(s.id,active?'paused':'active')));
    if(s.kind!=='monthly'&&s.latched)actions.append(button('模拟恢复正常',()=>recover(s.id)));
    actions.append(button('编辑',edit),button('我的订阅',()=>openManager()));card.append(actions,el('small','xs-foot','仅交互演示：不后台定时执行，不会真实发送邮件或短信。'));
  }
  function field(form,label,node){const wrap=el('label','xs-field');wrap.append(el('span','',label),node);form.append(wrap);return node;}
  function input(type,value,name){const n=el('input');n.type=type;n.value=value??'';n.name=name;return n;}
  function select(options,value,name){const n=el('select');n.name=name;options.forEach(([v,t])=>{const o=el('option','',t);o.value=v;n.append(o);});n.value=value;return n;}
  function formEditor(host,draft,onSave){
    host.replaceChildren(header(draft));const form=el('form','xs-form');
    if(draft.kind==='monthly'){const n=input('number',draft.day,'day');n.min=1;n.max=31;field(form,'每月几号',n);field(form,'执行时间（北京时间）',input('time',draft.time,'time'));}
    if(draft.kind==='profit'){const n=input('number',draft.days,'days');n.min=1;n.max=30;field(form,'连续完整自然日',n);field(form,'每日收益≤（元）',input('number',draft.threshold,'threshold'));field(form,'每日检查时间（北京时间）',input('time',draft.time,'time'));}
    if(draft.kind==='temperature'){field(form,'温度达到（℃）',input('number',draft.threshold,'threshold'));field(form,'持续时长（分钟）',input('number',draft.minutes,'minutes'));}
    if(draft.kind==='offline')field(form,'连续离线（分钟）',input('number',draft.minutes,'minutes'));
    const options=[['all','全部电站（合计）'],...plants().map(p=>[p.id,p.name])];field(form,draft.kind==='monthly'?'报告范围':'监测范围',select(options,draft.scope,'scope'));
    const channel=field(form,'通知方式',select([['email','邮件'],['sms','短信'],['inapp','站内通知']],draft.channel,'channel'));
    const recipient=el('div','xs-recipient'),name=el('label','xs-field'),nameText=el('span'),target=input('text',draft.recipient,'recipient');target.autocomplete='off';name.append(nameText,target);
    const demo=button('使用演示地址',()=>{target.value=channel.value==='sms'?'演示号码':'demo@example.com';});recipient.append(name,demo);form.append(recipient);
    function sync(){recipient.hidden=channel.value==='inapp';nameText.textContent=channel.value==='sms'?'接收手机号':'接收邮箱';target.placeholder=channel.value==='sms'?'输入手机号，或使用演示号码':'如 demo@example.com';demo.textContent=channel.value==='sms'?'使用演示号码':'使用演示地址';}
    channel.addEventListener('change',()=>{target.value='';sync();});sync();
    const note=draft.kind==='profit'?'已按“连续完整自然日收益≤阈值”理解；全部电站表示合计每日收益。':draft.kind==='monthly'?'报告范围为上一个自然月；不足指定日的月份按月末计划。':'演示异常不会修改电站的实际仿真数据。';form.append(el('p','xs-hint',note));
    const error=el('p','xs-error');error.setAttribute('role','status');form.append(error);
    const confirm=el('button','xs-primary',draft.id?'保存修改（演示）':'确认订阅（演示）');confirm.type='submit';form.append(confirm,el('small','xs-foot','订阅与接收地址仅保存在当前浏览器，不真实投递。'));
    form.noValidate=true;form.addEventListener('submit',event=>{event.preventDefault();const data={...draft};for(const key of ['day','days','threshold','minutes','scope','time','channel','recipient']){const n=form.elements.namedItem(key);if(n)data[key]=['day','days','threshold','minutes'].includes(key)?Number(n.value):n.value.trim();}const errors=M.validate(data);if(errors.length){error.textContent=errors.join('；');if(errors.some(e=>/邮箱|手机号/.test(e)))target.focus();return;}onSave(data);});host.append(form);return {form,target,channel};
  }
  function saveSubscription(data){
    const next=copy(),duplicate=next.items.find(s=>s.id!==data.id&&s.status!=='cancelled'&&M.signature(s)===M.signature(data));if(duplicate){toast('已有相同订阅，已打开原订阅');return duplicate;}
    if(!data.id&&next.items.length>=50){toast('演示最多保存50条订阅');return null;}
    const saved={...data,id:data.id||id(),status:data.id?find(data.id)?.status||'active':'active',createdAt:data.createdAt||Date.now(),updatedAt:Date.now(),latched:false};
    const at=next.items.findIndex(s=>s.id===saved.id);if(at>=0)next.items[at]=saved;else next.items.push(saved);return commit(next)?saved:null;
  }
  function draftCard(data){
    const row=say('可以，我先帮你整理成订阅，请确认条件和接收方式。');const card=el('div','xs-card');row.querySelector('.bubble').append(card);
    const editor=formEditor(card,data,values=>{const saved=saveSubscription(values);if(!saved)return;pending=null;drawSaved(card,saved);toast('演示订阅已保存');});pending={data,card,...editor};
    requestAnimationFrame(()=>row.scrollIntoView({block:'start',behavior:'smooth'}));
  }
  function editSubscription(sid){const s=find(sid);if(!s)return;openLayer('编辑订阅',body=>{const card=el('div','xs-card');body.append(card);formEditor(card,{...s},values=>{const saved=saveSubscription(values);if(saved){openManager();toast('订阅已更新');}});},()=>openManager());}
  function setStatus(sid,status){const next=copy(),s=next.items.find(x=>x.id===sid);if(!s)return;s.status=status;s.updatedAt=Date.now();s.latched=false;if(commit(next)){if(!layer.hidden)openManager();toast(status==='active'?'订阅已启用（演示）':status==='paused'?'订阅已暂停':'已退订，仍可恢复');}}
  function template(kind){close();draftCard(M.defaults(kind));}
  function templates(body){const grid=el('div','xs-templates');for(const kind of ['monthly','profit','temperature','offline'])grid.append(button(icon[kind]+' '+M.titles[kind],()=>template(kind)));body.append(grid);}
  function openManager(){
    openLayer('我的订阅',body=>{
      body.append(el('p','xs-banner','演示模式 · 不真实发送，也不在后台执行。数据仅保存在当前浏览器。'));
      const tabs=el('div','xs-tabs');for(const [key,label]of [['items','订阅管理'],['deliveries','模拟发送记录']]){const b=button(label,()=>{tab=key;openManager();});b.setAttribute('aria-pressed',String(tab===key));tabs.append(b);}body.append(tabs);
      if(tab==='items'){body.append(el('h3','','新建订阅'));templates(body);if(!state.items.length)body.append(el('p','xs-empty','还没有订阅。选择上方场景，或直接对小源说出你的需求。'));
        for(const s of state.items.slice().reverse()){const box=el('article','xs-list-card'),card=el('div','xs-card');box.append(card);drawSaved(card,s);if(s.status!=='cancelled')box.append(button('退订',()=>setStatus(s.id,'cancelled'),'xs-unsubscribe'));body.append(box);}}
      else{if(!state.deliveries.length)body.append(el('p','xs-empty','还没有模拟发送记录。保存订阅后点击“模拟生成并发送”或“模拟异常并提醒”。'));
        for(const log of state.deliveries){const b=button('',()=>preview(log),'xs-log');b.append(el('strong','',log.title),el('span','',log.kind==='recovery'?'模拟恢复正常':channelName[log.channel]+' · '+log.to),el('small','',M.format(log.at)+' · '+(log.kind==='recovery'?'已恢复':'模拟发送成功')));body.append(b);}}
    });
  }
  async function reportData(s){
    const month=M.monthBefore(Date.now()),p=plants(),selected=s.scope==='all'?p:p.filter(x=>x.id===s.scope);let history;
    try{history=await WorkspaceClient.request('history');}catch{}
    const datasets=history?.datasets||[],rows=selected.map(st=>{const d=datasets.find(d=>d.plantId===st.id&&d.month===month);return {name:st.name,energy:d?.totals?.dayPv??null,revenue:d?.totals?.dayRev??null,symbol:st.tariff?.sym||'¥',days:d?.days||0,complete:!!d?.completeMonth};});
    return {month,rows,partial:!rows.length||rows.some(r=>!r.complete),available:rows.some(r=>r.energy!==null)};
  }
  async function simulate(sid){
    let s=find(sid);if(!s||s.status!=='active'){toast('请先启用订阅');return;}if(running.has(sid))return;running.add(sid);refreshCards();
    try{
      let report=null,data=null;
      if(s.kind==='monthly'){report=await reportData(s);const old=state.deliveries.find(l=>l.subscriptionId===sid&&l.report?.month===report.month&&l.subscriptionSignature===M.signature(s));if(old){toast('该月报告已模拟发送，打开原记录');preview(old);return;}}
      else{data=M.evidence(s,Date.now());const check=M.shouldSend(s,s,data);if(!check.send){toast(check.reason);return;}}
      s=find(sid);if(s?.status!=='active'){toast('订阅已暂停或退订，本次未发送');return;}
      const log={id:id(),subscriptionId:s.id,subscriptionSignature:M.signature(s),at:Date.now(),title:s.kind==='monthly'?report.month+' 运营报告':s.title,channel:s.channel,to:M.mask(s),scope:scopeName(s),kind:s.kind,status:'simulated',simulated:true,report,evidence:data};
      const patch={lastRunAt:log.at,lastDeliveryId:log.id,latched:s.kind!=='monthly'};
      if(record(s,log,patch))preview(log);
    }catch{toast('演示暂未完成，请重试');}finally{running.delete(sid);refreshCards();}
  }
  function recover(sid){const s=find(sid);if(!s?.latched){toast('当前没有待恢复的异常');return;}const log={id:id(),subscriptionId:sid,at:Date.now(),title:s.title+' · 恢复正常',channel:'inapp',to:'小源站内通知',scope:scopeName(s),kind:'recovery',status:'recovered',simulated:true};if(record(s,log,{latched:false}))preview(log);}
  function preview(log){
    const render=body=>{
      body.append(el('div','xs-success',log.kind==='recovery'?'✓ 已模拟恢复正常':'✓ 模拟发送成功 · 未真实投递'),el('p','xs-banner','这是交互演示，不会调用邮件或短信服务。'));
      const letter=el('article','xs-letter');letter.append(el('span','xs-letter-channel',channelName[log.channel]+'预览'),el('h3','',log.title),row('接收人',log.to),row('电站范围',log.scope));
      if(log.report){const r=log.report;letter.append(el('p','','报告月份：'+r.month+'。本次为手动演示，预览最近一个自然月；不改变订阅的下次计划。'));
        if(r.available){const table=el('table','xs-report-table'),head=el('tr');for(const h of ['电站','发电量(kWh)','收益'])head.append(el('th','',h));table.append(head);for(const p of r.rows){const tr=el('tr');tr.append(el('td','',p.name),el('td','',fmt(p.energy)),el('td','',p.revenue===null?'暂无数据':p.symbol+fmt(p.revenue)));table.append(tr);}letter.append(table,el('p','xs-hint',r.partial?'所选月份含缺失或部分时段记录，不能代表完整月。':'覆盖完整自然月，报告指标引用已有历史仿真数据。'));}
        else letter.append(el('p','xs-hint','该月暂无已保存数据。此处仅演示报告版式，不补造发电量或收益。'));
        letter.append(el('p','','运营建议：结合各站发电、收益及设备告警排查异常，按计划检查散热与设备连接。'));
      }else if(log.kind==='profit'){const d=log.evidence;letter.append(el('p','',`【小源演示】${log.scope}连续${d.days.length}个完整自然日收益不达阈值，请关注电站运行。`));for(const day of d.days)letter.append(el('p','xs-evidence',day.date+'：'+day.revenue+'元'));letter.append(el('p','xs-hint','以上收益为本次构造的演练样本，不会改写电站历史数据。'));
      }else if(log.kind==='temperature'){letter.append(el('p','',`【小源演示】${log.scope}逆变器温度达到${log.evidence.temperature}℃，持续${log.evidence.durationMinutes}分钟，建议检查通风、风扇与散热片。`),el('p','xs-hint','本次使用演练样本，不改变电站温度与运行策略。'));
      }else if(log.kind==='offline'){letter.append(el('p','',`【小源演示】${log.scope}设备已连续离线${log.evidence.durationMinutes}分钟，请检查网络、电源及采集链路。`),el('p','xs-hint','这是离线演练，不会将电站实际置为离线。'));
      }else letter.append(el('p','','异常已模拟恢复，重复提醒锁定已解除。下一轮异常可重新模拟触发。'));
      body.append(letter,el('p','xs-next','演示时间：'+M.format(log.at)+'（北京时间）') );
      if(!log.report)body.append(button('查看模拟发送记录',()=>{tab='deliveries';openManager();},'xs-primary'));
    };
    if(log.report){
      ReportReader.open('订阅运营月报',body=>{
        const content=el('div','xs-layer-body');render(content);body.append(content);
      },layer.hidden?null:layer,layer.hidden?'返回对话':tab==='deliveries'?'返回发送记录':'返回订阅');
    }else openLayer(log.kind==='recovery'?'模拟恢复':'发送预览',render,()=>openManager());
  }
  function chooseScope(data,q){const matches=plants().filter(p=>q.includes(p.name)||(p.city&&q.includes(p.city.replace(/市$/,''))));if(matches.length===1)data.scope=matches[0].id;return data;}
  function handle(q){
    if(pending&&!pending.card.isConnected)pending=null;
    if(/^(查看|打开|看看|管理)?(我的)?订阅(列表|记录|管理)?[。！？?\s]*$/.test(q)||/订阅/.test(q)&&/查看|打开|管理|有哪些|订阅了|发送记录|列表/.test(q)){say('可以，在“我的订阅”里管理计划、触发条件和模拟发送记录。');openManager();return true;}
    if(/模拟.*恢复/.test(q)){const target=state.items.slice().reverse().find(s=>s.latched&&(/收益/.test(q)?s.kind==='profit':/温度|高温/.test(q)?s.kind==='temperature':/离线/.test(q)?s.kind==='offline':true));if(target)recover(target.id);else say('当前没有待恢复的演示异常。');return true;}
    const action=/(暂停|取消|退订|恢复|启用).*(订阅|月报|运营报告|收益提醒|高温提醒|离线提醒)/.exec(q);
    if(action){let target=state.items.filter(s=>s.status!=='cancelled'||/恢复|启用/.test(action[1]));if(!/全部|所有/.test(q)){target=target.filter(s=>q.includes(s.title)||(s.kind==='monthly'&&/月报|运营报告/.test(q))||(s.kind==='profit'&&/收益/.test(q))||(s.kind==='temperature'&&/高温|温度/.test(q))||(s.kind==='offline'&&/离线/.test(q)));if(!target.length&&state.items.length===1)target=state.items;}
      if(!target.length){say('没有找到对应订阅，可以先打开“我的订阅”选择。');openManager();return true;}const status=/取消|退订/.test(action[1])?'cancelled':action[1]==='暂停'?'paused':'active';for(const s of target)setStatus(s.id,status);say('已'+(status==='active'?'启用':status==='paused'?'暂停':'退订')+target.length+'条演示订阅。');return true;}
    if(pending&&(/^[\s\S]*@/.test(q)||/1[3-9]\d{9}/.test(q)||/改成|改为|每月|点|短信|邮箱|演示地址|演示号码/.test(q))){
      const current={...pending.data};for(const key of ['day','days','threshold','minutes','scope','time','channel','recipient']){const n=pending.form.elements.namedItem(key);if(n)current[key]=['day','days','threshold','minutes'].includes(key)?Number(n.value):n.value.trim();}
      let data=M.parse(q,current);if(data){data=chooseScope(data,q);if(/演示地址|演示邮箱/.test(q))data.recipient='demo@example.com';if(/演示号码/.test(q))data.recipient='演示号码';pending.data=data;const card=pending.card;const editor=formEditor(card,data,values=>{const saved=saveSubscription(values);if(saved){pending=null;drawSaved(card,saved);toast('演示订阅已保存');}});pending={data,card,...editor};say('已更新订阅草稿，请在卡片中确认。');card.scrollIntoView({block:'start',behavior:'smooth'});return true;}}
    let data=M.parse(q);if(!data)return false;data=chooseScope(data,q);
    if(/修改|改成|改为|调整/.test(q)){const old=state.items.slice().reverse().find(s=>s.kind===data.kind&&s.status!=='cancelled');if(old)data=chooseScope(M.parse(q,old),q);}
    draftCard(data);return true;
  }
  global.SubscriptionDemo=Object.freeze({handle,open:openManager});
})(globalThis);
