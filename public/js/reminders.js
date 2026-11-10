(function () {
  'use strict';
  const home = document.getElementById('xr-featured');
  const open = document.getElementById('xr-open');
  const bubble = document.getElementById('xy-reminder-float');
  const ball = document.getElementById('xy-ball');
  const screen = document.querySelector('.screen');
  const drawer = document.createElement('section');
  drawer.className = 'xr-drawer'; drawer.hidden = true;
  drawer.setAttribute('role', 'dialog'); drawer.setAttribute('aria-modal', 'true'); drawer.setAttribute('aria-label', '小源提醒中心');
  drawer.innerHTML = '<header class="xr-top"><h2>小源提醒</h2><button type="button" aria-label="关闭提醒">✕</button></header><div class="xr-tabs"><button type="button" data-filter="active" aria-pressed="true">待关注</button><button type="button" data-filter="all" aria-pressed="false">全部记录</button></div><div class="xr-body"></div>';
  document.querySelector('.screen').append(drawer);
  const body = drawer.querySelector('.xr-body');
  let feed = { events: [], stale: false }, filter = 'active', selected = null, busy = false, failed = false;
  let preferences = {}, lastFocus, context = null, savedBallPosition = null;
  try { preferences = JSON.parse(localStorage.getItem('solar-reminders-v1') || '{}'); } catch {}
  if (!preferences || Array.isArray(preferences) || typeof preferences !== 'object') preferences = {};
  const make = (tag, className, text) => { const e = document.createElement(tag); if (className) e.className = className; if (text !== undefined) e.textContent = text; return e; };
  const fmt = n => Number(n || 0).toLocaleString('zh-CN', { maximumFractionDigits: 1 });
  const label = e => ['saving-opportunity','storage-upgrade'].includes(e.type) ? '策略建议' : e.level === 'urgent' ? '紧急' : e.level === 'warning' ? '建议关注' : '运营报告';
  const events = () => feed.events.slice();
  function active(e) { const pref = preferences[e.id]; return e.status === 'active' && !(pref?.done && pref.level === e.level) && !(pref?.until > Date.now() && pref.level === e.level); }
  function sorted() {
    const rank = { urgent: 3, warning: 2, info: 1 };
    return events().sort((a, b) => (rank[b.level] - rank[a.level]) || b.createdAt - a.createdAt);
  }
  function save(e, value) {
    preferences[e.id] = { ...value, level: e.level };
    const keys = Object.keys(preferences); for (const key of keys.slice(0, -200)) delete preferences[key];
    try { localStorage.setItem('solar-reminders-v1', JSON.stringify(preferences)); } catch {}
    selected = null; render(); renderBody(); drawer.querySelector('[data-filter][aria-pressed="true"]').focus();
  }
  function tags(e) {
    const row = make('div');
    row.append(make('span', 'xr-tag ' + e.level, label(e)), make('span', 'xr-tag', e.demo ? '仿真演练' : '仿真数据'));
    if (e.status !== 'active') row.append(make('span', 'xr-tag', e.status === 'archived' ? '演示已重置 · 已收起' : '已恢复 / 已结束'));
    else if (preferences[e.id]?.done && preferences[e.id].level === e.level) row.append(make('span', 'xr-tag', '本设备已处理'));
    else if (preferences[e.id]?.until > Date.now() && preferences[e.id].level === e.level) row.append(make('span', 'xr-tag', '本设备稍后提醒'));
    return row;
  }
  function positionBubble() {
    bubble.hidden = context ? !context.visible : !events().some(active) || !drawer.hidden || document.getElementById('xiaoyuan').classList.contains('open');
    if (bubble.hidden) return;
    const width = Math.min(300, screen.clientWidth - 24);
    bubble.style.width = width + 'px';
    const x = ball.offsetLeft, y = ball.offsetTop, center = x + ball.offsetWidth / 2;
    const left = Math.max(12, Math.min(screen.clientWidth - width - 12, x + ball.offsetWidth - width));
    const below = y - bubble.offsetHeight - 14 < 58;
    bubble.classList.toggle('xr-below', below);
    bubble.style.left = left + 'px';
    bubble.style.top = Math.max(58, Math.min(screen.clientHeight - bubble.offsetHeight - 20, below ? y + ball.offsetHeight + 14 : y - bubble.offsetHeight - 14)) + 'px';
    bubble.style.setProperty('--xr-arrow-x', Math.max(16, Math.min(width - 22, center - left - 5)) + 'px');
  }
  function show(id) { lastFocus = document.activeElement; selected = id || null; drawer.hidden = false; positionBubble(); renderBody(); drawer.querySelector('.xr-top button').focus(); }
  function close() { drawer.hidden = true; selected = null; positionBubble(); if (lastFocus?.isConnected && !bubble.hidden) lastFocus.focus(); }
  function chatAbout(e) {
    if (!e) return;
    if (['saving-opportunity','storage-upgrade','weather-backup'].includes(e.type)) {
      if (!drawer.hidden) close();
      openXY();
      document.getElementById('xy-intro').classList.add('hide');
      document.getElementById('xy-chat').classList.add('on');
      const row = addMsg('ai', e.plantName + ' · ' + e.title);
      if(e.type==='saving-opportunity') globalThis.StrategyDemo.renderOpportunity(row.querySelector('.bubble'), e.plantId);
      else row.querySelector('.bubble').append(sceneCard(e));
      row.querySelector('.bubble').append(make('p', '', e.advice));
      const actions = make('div', 'xr-actions');
      const optimize = sceneAction(e);
      const later = make('button', '', '30 分钟后提醒');
      later.addEventListener('click', () => { save(e, { until: Date.now() + 1800000 }); later.disabled = true; later.textContent = '已设置稍后提醒'; });
      actions.append(optimize, later); row.querySelector('.bubble').append(actions);
      setTimeout(() => row.scrollIntoView({ block: 'start' }), 70);
      return;
    }
    if (!drawer.hidden) close();
    openXY();
    document.getElementById('xy-intro').classList.add('hide');
    const chat = document.getElementById('xy-chat'); chat.classList.add('on');
    const question = e.type === 'inverter-risk' ? '逆变器为什么有过热风险，应如何排查？' : e.type === 'temperature' ? '设备温度偏高，怎么办？' : e.type === 'weather' ? '台风来前，要做什么准备？' : e.report?.historical ? `${e.report.month} 运营得怎么样？` : '上个月运营得怎么样？';
    const queryText = `系统代问 · ${e.plantName}\n${question}`;
    let queryRow = [...chat.querySelectorAll('[data-reminder-query]')].find(el => el.dataset.reminderQuery === e.id);
    if (!queryRow) { queryRow = addMsg('user', ''); queryRow.dataset.reminderQuery = e.id; queryRow.classList.add('xr-system-query'); }
    const queryBubble = queryRow.querySelector('.bubble'); queryBubble.replaceChildren();
    queryBubble.append(make('span', 'xr-query-label', `系统代问 · ${e.plantName}`), make('span', 'xr-query-text', question));
    let text = `小源主动提醒 · ${e.demo ? '仿真演练' : '仿真数据'}\n${e.plantName} · ${e.title}\n\n${e.summary}`;
    if (e.risk) text += '\n\n判断依据：'+e.risk.sampleCount+' 个温度采样，覆盖 '+e.risk.observedMinutes+' 个仿真分钟；升温速率 '+(e.risk.rateCPerMinute ?? '暂无')+' ℃/仿真分钟。'+e.risk.method;
    if (e.report) {
      const r = e.report, t = r.totals;
      text += `\n\n仿真用电：${fmt(t.dayLoad)} kWh\n自用率：${r.selfUsePercent === null ? '—' : fmt(r.selfUsePercent) + '%'}\n储能充电 / 放电：${fmt(t.dayChg)} / ${fmt(t.dayDis)} kWh\n统计范围（UTC）：${new Date(r.observedFrom).toISOString().slice(0, 16).replace('T', ' ')} 至 ${new Date(r.observedUntil).toISOString().slice(0, 16).replace('T', ' ')}，${r.partial === false ? '完整月份模型仿真，非真实历史数据' : r.historical ? '90天窗口内时段模型仿真，今天仅截至批次时间' : '非完整自然月统计'}。`;
    }
    text += '\n\n' + e.advice;
    if (e.status !== 'active') text += e.status === 'archived' ? '\n\n演示已重置，这条提醒已收起，历史记录仍可查看。' : '\n\n这条提醒已恢复或结束。';
    if (feed.stale || failed) text += '\n\n当前数据已停更或连接失败，以上是最后观测记录。';
    text += '\n\n你可以继续问我这件事。';
    let row = [...chat.querySelectorAll('[data-reminder-id]')].find(el => el.dataset.reminderId === e.id);
    if (row) setBubbleText(row, text);
    else { row = addMsg('ai', text); row.dataset.reminderId = e.id; }
    if (e.risk) {
      const b=row.querySelector('.bubble'); b.replaceChildren();
      b.append(make('strong','','发现 1 个设备存在过热风险'),make('p','',e.plantName+' · '+(e.demo?'仿真演练':'仿真温度观测')),riskChart(e),make('p','','建议优先排查通风、风扇与散热片积尘。'));
      if (feed.stale || failed) b.append(make('small','','数据已停更，以上为最后观测 / 演练记录。'));
      const detail=make('details','xr-risk-advice');detail.append(make('summary','','查看处理建议'),make('p','','判断依据：'+e.risk.sampleCount+' 个温度采样，覆盖 '+e.risk.observedMinutes+' 个仿真分钟。'+e.risk.method),make('p','',e.advice));
      const actions=make('div','xr-actions'), later=make('button','','暂不处理 · 30 分钟后提醒');later.type='button';later.addEventListener('click',()=>{save(e,{until:Date.now()+1800000});later.textContent='已设置稍后提醒';later.disabled=true;});
      actions.append(later);const optimize=make('button','','评估保守充放电方案');optimize.type='button';optimize.addEventListener('click',()=>globalThis.StrategyDemo?.fromReminder('life',e.plantId));actions.append(optimize);b.append(detail,actions);
    }
    if(['weather','temperature'].includes(e.type)){const strategy=make('button','',e.type==='weather'?'生成备用电方案':'评估保守充放电方案');strategy.type='button';strategy.addEventListener('click',()=>globalThis.StrategyDemo?.fromReminder(e.type==='weather'?'backup':'life',e.plantId));row.querySelector('.bubble').append(strategy);}
    if (e.report) {
      const attachment = make('a', 'xr-report-file');
      attachment.href = '/api/workspace/reports/' + encodeURIComponent(e.id);
      attachment.target = '_blank'; attachment.rel = 'noopener';
      attachment.append(make('strong', '', '▤ 查看完整报告（HTML）'), make('span', '', `${e.plantName} · ${e.report.month} · 可打印保存为 PDF ↗`));
      row.querySelector('.bubble').append(attachment);
      if(e.demo) row.querySelector('.bubble').prepend(reportHero(e));
    }
    convo.history = convo.history.filter(message => message.reminderId !== e.id);
    convo.history.push({ role: 'user', content: queryText, reminderId: e.id }, { role: 'assistant', content: text, reminderId: e.id });
    // Keep the system-authored question visible instead of jumping past it to a long report's end.
    setTimeout(() => { if (queryRow.isConnected) queryRow.scrollIntoView({ block: 'start' }); }, 70);
  }
  function riskChart(e) {
    const r=e.risk, box=make('div','xr-risk-chart');
    box.append(make('strong','','逆变器过热风险 · '+e.deviceId));
    const points=(r.points||[]).filter(p=>Number.isFinite(p.utc)&&Number.isFinite(p.temperature));
    const now=e.simUtc, start=points[0]?.utc ?? now-600000, end=Math.max(now+60000,r.forecastUtc||now);
    const x=t=>32+Math.max(0,Math.min(1,(t-start)/Math.max(60000,end-start)))*266;
    const y=t=>113-Math.max(0,Math.min(100,t))*0.9;
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.setAttribute('viewBox','0 0 320 144');svg.setAttribute('role','img');
    svg.setAttribute('aria-label','逆变器温度观测与线性趋势外推；当前 '+r.currentC+' 摄氏度');
    svg.innerHTML=[20,40,70,90].map(t=>'<line x1="32" y1="'+y(t)+'" x2="298" y2="'+y(t)+'" stroke="#dce3ec"/><text x="2" y="'+(y(t)+4)+'" font-size="10" fill="#68778b">'+t+'℃</text>').join('')+
      '<line x1="32" y1="'+y(70)+'" x2="298" y2="'+y(70)+'" stroke="#e85b62" stroke-dasharray="4 4"/>'+
      '<polyline fill="none" stroke="#25aa88" stroke-width="2.5" points="'+points.map(p=>x(p.utc)+','+y(p.temperature)).join(' ')+'"/>'+
      (r.forecastUtc?'<line x1="'+x(now)+'" y1="'+y(r.currentC)+'" x2="'+x(r.forecastUtc)+'" y2="'+y(70)+'" stroke="#ed626b" stroke-width="2" stroke-dasharray="5 4"/>':'')+
      '<circle cx="'+x(now)+'" cy="'+y(r.currentC)+'" r="4" fill="#f29b35"/>'+
      '<text x="32" y="135" font-size="10" fill="#68778b">观测</text><text x="218" y="135" font-size="10" fill="#68778b">'+(r.forecastUtc?'预计 +'+r.etaMinutes+' 分钟':'当前')+'</text>';
    box.append(svg,make('div','xr-risk-current','当前 '+r.currentC+'℃ · '+(r.rateCPerMinute!==null?'升温 '+r.rateCPerMinute+'℃/仿真分钟':'待持续观测')),
      make('small','',r.currentC>=r.thresholdC?'已达到 70℃ 演示阈值，请优先排查。':'若趋势持续，预计约 '+r.etaMinutes+' 个仿真分钟后达到 70℃ 演示阈值。'),
      make('small','', (e.demo?'本案例为手动启动的温升演练。':'实线为已收到的模拟温度采样。')+'虚线为线性外推，非已发生数据；阈值以厂家规范为准。'));
    return box;
  }
  function sceneAction(e) {
    const button=make('button','',e.type==='storage-upgrade'?'查看详情':e.type==='weather-backup'?'调整备用电策略':'去优化');
    button.type='button';
    button.addEventListener('click',()=>{
      if(e.type==='storage-upgrade'){
        showStorageProduct(e,button);
        return;
      }
      close();
      if(e.type==='weather-backup') globalThis.StrategyDemo?.optimizeBackup(e.plantId,e.backup?.afterReserve||60);
      else globalThis.StrategyDemo?.optimize(e.plantId);
    });return button;
  }
  function showStorageProduct(e,trigger){
    const layer=make('section','xr-product-layer');layer.setAttribute('role','dialog');layer.setAttribute('aria-modal','true');layer.setAttribute('aria-label','户用储能设备详情');
    const panel=make('div','xr-product-panel'),head=make('header','xr-top'),dismiss=make('button','','✕');dismiss.type='button';dismiss.setAttribute('aria-label','关闭设备详情');
    const exit=()=>{layer.remove();if(trigger.isConnected)trigger.focus();};dismiss.addEventListener('click',exit);head.append(make('h2','','户用储能设备'),dismiss);
    const content=make('div','xr-product-content'),visual=make('div','xr-product-visual');
    visual.innerHTML='<svg viewBox="0 0 280 210" role="img" aria-label="户用储能电池设备示意图"><ellipse cx="145" cy="192" rx="88" ry="10" fill="#d9e6ee"/><path d="M87 20h114l16 12v146l-16 13H87z" fill="#e3e9ec" stroke="#bbcbd6"/><rect x="67" y="20" width="134" height="171" rx="12" fill="#fff" stroke="#b7c9d6" stroke-width="2"/><rect x="78" y="32" width="112" height="32" rx="6" fill="#f0f5f8"/><circle cx="91" cy="48" r="3" fill="#29bb7f"/><text x="102" y="52" font-size="10" fill="#526c82">HOME ENERGY</text><path d="M78 78h112M78 132h112" stroke="#dce6ed" stroke-width="2"/><path d="m139 92-15 22h12l-6 17 22-26h-13l6-13z" fill="#4a9d79"/><path d="M88 161h44M88 168h44M88 175h44" stroke="#ccd8df" stroke-width="2"/></svg>';
    const capacity=e.upgrade?.addKwh||10;
    content.append(visual,make('span','xr-product-tag','户用储能 · 推荐方案'),make('h3','','家庭智慧储能系统'),make('p','',`推荐配置 ${capacity} kWh · ${e.plantName}`));
    const specs=make('div','xr-scene-grid');for(const [value,label]of [[capacity+' kWh','演示配置容量'],['光储协同','提升光伏自用']]){const tile=make('div','xr-scene-tile');tile.append(make('strong','',value),make('p','',label));specs.append(tile);}
    content.append(specs,make('p','','白天储存富余光伏电量，晚间为家庭供电。安装商可进一步评估设备兼容性、安装条件及容量方案。'),make('small','xr-product-note','设备图与配置仅为演示示意，具体型号、报价和安装方案以安装商评估为准。'));
    const footer=make('div','xr-product-footer'),consent=make('button','xr-product-consent','同意安装商联系我'),status=make('p','xr-product-note','演示模式：点击后仅展示意向登记结果，不发送联系方式。');consent.type='button';status.setAttribute('role','status');
    consent.addEventListener('click',()=>{consent.textContent='✓ 已登记联系意向';consent.disabled=true;status.textContent='已登记成功（演示），安装商联系流程已展示；未实际提交或发送联系方式。';});
    footer.append(consent,status);panel.append(head,content,footer);layer.append(panel);screen.append(layer);dismiss.focus();
    layer.addEventListener('click',event=>{if(event.target===layer)exit();});
    layer.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();exit();}if(event.key==='Tab'){const last=consent.disabled?dismiss:consent;if(event.shiftKey&&document.activeElement===dismiss){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();dismiss.focus();}}});
  }
  function reportHero(e){
    const r=e.report,box=make('div','xr-scene');box.append(make('strong','',r.month+' 运营报告'),make('p','','▤ 上月关键数据'));
    const grid=make('div','xr-metrics');
    for(const [value,label] of [[fmt(r.totals.dayPv)+' kWh','发电量'],[r.currency+fmt(r.totals.dayRev),'收益'],[r.selfUsePercent===null?'—':fmt(r.selfUsePercent)+'%','自用率']]){const tile=make('div','',value);tile.append(make('span','',label));grid.append(tile);}
    box.append(grid,make('small','',r.demoFixture?'固定演示样例 · 非该电站历史统计':'模型仿真历史 · 非真实结算'));return box;
  }
  function sceneCard(e) {
    const box=make('div','xr-scene'),grid=make('div','xr-scene-grid');
    if(e.type==='storage-upgrade'){
      const u=e.upgrade;
      for(const [title,annual,self] of [['当前 · 仅光伏',u.beforeAnnual,u.beforeSelf],['推荐 · 光伏 + 储能 '+u.addKwh+' kWh',u.afterAnnual,u.afterSelf]]){
        const tile=make('div','xr-scene-tile');tile.append(make('strong','',title),make('div','xr-scene-symbol',title.startsWith('当前')?'☀':'ϟ'),make('p','',`年收益 ¥${fmt(annual)}`),make('p','',`自用率 ${self}%`));grid.append(tile);
      }
      box.append(make('strong','','储能扩容前后对比'),grid,make('small','','固定演示方案假设，非当前电站测算或报价。'));
    }else if(e.type==='weather-backup'){
      const u=e.backup;
      for(const [title,reserve] of [['当前备用目标',u.beforeReserve],['建议备用目标',u.afterReserve]]){const tile=make('div','xr-scene-tile');tile.append(make('strong','',title),make('div','xr-scene-symbol',reserve+'%'),make('p','','重要负载优先保障'));grid.append(tile);}
      box.append(make('strong','',`模拟明日天气 · 台风 ${u.wind}`),grid,make('small','',`演示保障时段 ${u.hours}。备用目标为场景假设，不是已读取的设备设置；确认前不修改。`));
    }return box;
  }
  function eventCard(e) {
    const card = make('article', 'xr-event');
    card.append(tags(e), make('h3', '', e.title), make('small', '', e.plantName), make('p', '', e.summary));
    if (e.report) {
      const report = e.report, t = report.totals, grid = make('div', 'xr-metrics');
      for (const [value, name] of [[fmt(t.dayPv) + ' kWh', '观测发电'], [report.currency + fmt(t.dayRev), '观测收益'], [fmt(t.dayLoad) + ' kWh', '观测用电'], [report.selfUsePercent === null ? '—' : fmt(report.selfUsePercent) + '%', '观测自用率'], [fmt(t.dayChg) + ' kWh', '储能充电'], [fmt(t.dayDis) + ' kWh', '储能放电']]) {
        const metric = make('div', '', value); metric.append(make('span', '', name)); grid.append(metric);
      }
      card.append(grid, make('small', '', `统计时间（UTC）：${new Date(report.observedFrom).toISOString().slice(0, 16).replace('T', ' ')} 至 ${new Date(report.observedUntil).toISOString().slice(0, 16).replace('T', ' ')} · ${report.samples} ${report.historical ? '个积分步，' + (report.partial === false ? '完整月份模型仿真。' : '90天窗口内时段仿真。') : '个快照，非完整自然月统计。'}`));
    }
    if (e.risk) card.append(riskChart(e));
    if (e.type === 'saving-opportunity') globalThis.StrategyDemo?.renderOpportunity(card, e.plantId);
    if(['storage-upgrade','weather-backup'].includes(e.type)) card.append(sceneCard(e));
    card.append(make('p', '', e.advice));
    if (e.simUtc) card.append(make('small', '', '事件仿真时间（UTC）：' + new Date(e.simUtc).toISOString().slice(0, 16).replace('T', ' ')));
    const actions = make('div', 'xr-actions');
    const ask = make('button', '', e.risk ? '查看处理建议' : e.report ? '请小源解读' : '问小源怎么做'); ask.type = 'button';
    ask.addEventListener('click', () => chatAbout(e));
    actions.append(ask);
    if (e.type === 'saving-opportunity') {
      ask.textContent = '请小源解读';
      const optimize = make('button', '', '去优化');
      optimize.addEventListener('click', () => { close(); globalThis.StrategyDemo?.optimize(e.plantId); });
      actions.append(optimize);
    }
    if(['storage-upgrade','weather-backup'].includes(e.type))actions.append(sceneAction(e));
    if(['weather','temperature','inverter-risk'].includes(e.type)){
      const strategy=make('button','',e.type==='weather'?'生成备用电方案':'评估保守充放电方案');strategy.type='button';strategy.addEventListener('click',()=>{if(!globalThis.StrategyDemo)return;close();StrategyDemo.fromReminder(e.type==='weather'?'backup':'life',e.plantId);});actions.append(strategy);
    }
    if (e.status === 'active') {
      const later = make('button', '', '30 分钟后提醒'), done = make('button', '', '本设备已处理'); later.type = done.type = 'button';
      later.addEventListener('click', () => save(e, { until: Date.now() + 1800000 }));
      done.addEventListener('click', () => save(e, { done: true })); actions.append(later, done);
    }
    card.append(actions); return card;
  }
  function renderBody() {
    if (drawer.hidden) return;
    // Poll updates must not destroy a keyboard user's currently focused action.
    body.replaceChildren();
    body.append(make('div', 'xr-notice', (failed ? '提醒服务连接失败，以下为最后加载记录。' : feed.stale ? '管理端数据已停更，以下为最后观测，不能代表当前设备状态。' : '服务器规则已启用，运行数据更新时自动判断。') + ' 仿真天气不是实际预报。处理和稍后提醒仅对本设备生效。'));
    const list = sorted().filter(e => selected ? e.id === selected : filter === 'all' || active(e));
    if (!list.length) body.append(make('p', 'xr-empty', filter === 'all' ? '还没有提醒记录。温度持续偏高、仿真跨月或管理端发起天气演练时，小源会在这里提醒你。' : '当前没有待关注事项，可到“全部记录”查看已处理或已结束的提醒。'));
    for (const e of list) body.append(eventCard(e));
  }
  function render() {
    if(context){document.getElementById('xr-count').textContent=context.attention?'(1)':'';document.getElementById('xr-open').firstChild.textContent=(context.actionLabel||'去对话')+' ';home.replaceChildren();const preview=make('button','xr-preview');preview.type='button';preview.append(make('strong','',context.title),make('p','',context.summary));preview.onclick=()=>context?.onOpen();home.append(preview);positionBubble();return;}
    document.getElementById('xr-open').firstChild.textContent='去对话 ';
    const list = sorted().filter(active), urgent = list[0];
    document.getElementById('xr-count').textContent = list.length ? `(${list.length})` : '';
    home.replaceChildren();
    if (urgent) {
      const preview = make('button', 'xr-preview'); preview.type = 'button';
      preview.append(make('strong', '', urgent.title), make('p', '', urgent.summary));
      preview.addEventListener('click', () => chatAbout(urgent)); home.append(preview);
    }
    if ((failed || feed.stale) && urgent) home.append(make('p', 'xr-empty', failed ? '连接失败 · 最后记录' : '数据停更 · 最后观测'));
    positionBubble();
    if (!body.contains(document.activeElement)) renderBody();
  }
  async function poll() {
    if (busy) return; busy = true;
    try { feed = await WorkspaceClient.request('reminders', { signal: AbortSignal.timeout(10000) }); feed.events=feed.events.map(e=>e.type==='storage-upgrade'?{...e,advice:'扩容容量、收益与自用率为演示方案假设。可查看户用储能设备详情，并选择是否同意安装商联系。'}:e); failed = false; }
    catch { failed = true; }
    finally { busy = false; render(); }
  }
  open.addEventListener('click', () => context ? context.onOpen() : chatAbout(sorted().find(active)));
  document.getElementById('xr-history').addEventListener('click', event => { event.preventDefault(); closeAppMenu(); show(); });
  new MutationObserver(positionBubble).observe(ball, { attributes: true, attributeFilter: ['style'] });
  new MutationObserver(positionBubble).observe(document.getElementById('xiaoyuan'), { attributes: true, attributeFilter: ['class'] });
  new ResizeObserver(positionBubble).observe(screen);
  drawer.querySelector('.xr-top button').addEventListener('click', close);
  for (const button of drawer.querySelectorAll('[data-filter]')) button.addEventListener('click', () => {
    filter = button.dataset.filter; selected = null;
    for (const other of drawer.querySelectorAll('[data-filter]')) other.setAttribute('aria-pressed', String(other === button));
    renderBody();
  });
  drawer.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); }
    if (event.key !== 'Tab') return;
    const nodes = [...drawer.querySelectorAll('button')].filter(e => !e.disabled), first = nodes[0], last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  void poll(); setInterval(poll, 5000);
  globalThis.SolarReminders = Object.freeze({
    setContext(value){
      if(!context&&!value)return;
      if(!context&&value)savedBallPosition={left:ball.style.left,top:ball.style.top};
      context=value;
      ball.classList.toggle('co-context-ball',Boolean(value));
      bubble.classList.toggle('co-context-bubble',Boolean(value));
      ball.classList.toggle('xr-context-ball',Boolean(value));
      bubble.classList.toggle('xr-context-bubble',Boolean(value));
      ball.classList.toggle('xr-has-attention',Boolean(value?.attention));
      if(value?.anchor==='bottom-right'){
        ball.style.left=Math.max(6,screen.clientWidth-ball.offsetWidth-16)+'px';
        ball.style.top=Math.max(58,screen.clientHeight-ball.offsetHeight-108)+'px';
      }else if(!value&&savedBallPosition){
        ball.style.left=savedBallPosition.left;ball.style.top=savedBallPosition.top;savedBallPosition=null;
      }
      render();
    },
    openContext(){if(!context)return false;context.onOpen();return true;},
    refresh: render,
    replaySaving() {
      const event=sorted().find(e=>e.type==='saving-opportunity'&&e.status==='active');
      if(!event){toast('请在仿真管理面点击“省钱机会 · 谷充峰放”触发提醒');return;}
      delete preferences[event.id];
      try { localStorage.setItem('solar-reminders-v1', JSON.stringify(preferences)); } catch {}
      render(); show(event.id);
    }
  });
})();
