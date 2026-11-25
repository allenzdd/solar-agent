(function(g){
'use strict';
const M=g.SolarDesignModel,$=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;},fmt=(n,d=0)=>Number(n).toLocaleString('zh-CN',{maximumFractionDigits:d}),wan=n=>fmt(n/10000,2),esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),pay=n=>n===null?'无正净收益':fmt(n,1)+' 年';
function equipmentTable(equipment) {
  const body = equipment.map(item => {
    const brand = item.brand ? `<small>${esc(item.brand)}</small>` : '';
    const model = item.source
      ? `<a href="${esc(item.source)}" target="_blank" rel="noopener">${esc(item.model)}</a>`
      : esc(item.model || '');
    const spec = model ? model + '<small>' + esc(item.spec) + '</small>' : esc(item.spec);
    return `<tr><th scope="row">${brand}${esc(item.name)}${item.optional?'（可选）':''}</th><td>${spec}</td><td>${fmt(item.count)} ${item.unit}</td></tr>`;
  }).join('');
  return `<table class="sd-inventory"><caption>设备清单</caption><thead><tr><th>品牌 / 设备</th><th>型号 / 规格</th><th>数量</th></tr></thead><tbody>${body}</tbody></table>`;
}
function energyLabel(kwh) {
  return kwh >= 10000 ? wan(kwh) + ' 万度' : fmt(kwh,1) + ' 度';
}
function energyFlow(r) {
  const ratio = (part, whole) => whole ? 100 * part / whole : 0;
  const pvSelf = ratio(r.selfKwh,r.generation), loadSelf = ratio(r.selfKwh,r.p.annualLoad);
  function node(x,y,name,value,share,color,track) {
    return `<g transform="translate(${x} ${y})"><circle r="37" fill="var(--sd-node)" stroke="${track}" stroke-width="7"/>
    <circle r="37" pathLength="100" transform="rotate(-90)" fill="none" stroke="${color}" stroke-width="7" stroke-dasharray="${share} ${100-share}"/>
    <text y="-2" class="sd-node-name">${name}</text><text y="15">${energyLabel(value)}</text></g>`;
  }
  function edge(x,y,label,kwh) {
    return `<g transform="translate(${x} ${y})"><text class="sd-edge-name">${label}</text><text y="15">${energyLabel(kwh)}</text></g>`;
  }
  return `<figure class="sd-figure"><figcaption>首年能量流向</figcaption>
    <svg class="sd-flow" viewBox="0 0 340 232" role="img" aria-label="首年光伏、电网和负载的电量流向">
    <g fill="none" stroke="currentColor" opacity=".75" stroke-width="1.8">
    <path d="M151 83 L102 145 L109 142 M102 145 l2 -8 M189 83 L238 145 l-2 -8 M238 145 l-7 -3 M101 178 H238 l-7 -4 M238 178 l-7 4"/></g>
    ${node(170,46,'光伏发电',r.generation,pvSelf,'var(--sd-pv)','var(--sd-export)')}
    ${node(56,178,'电网购电',r.gridKwh,100,'var(--sd-grid)','var(--sd-grid)')}
    ${node(284,178,'厂房负载',r.p.annualLoad,loadSelf,'var(--sd-pv)','var(--sd-grid)')}
    ${edge(64,90,'余电上网',r.exportKwh)}${edge(276,90,'光伏自用',r.selfKwh)}${edge(170,200,'购电供厂房',r.gridKwh)}
    </svg><div class="sd-flow-key"><span>发电去向</span><b>自用 ${fmt(pvSelf,1)}% · 上网 ${fmt(ratio(r.exportKwh,r.generation),1)}%</b>
    <span>负载来源</span><b>光伏 ${fmt(loadSelf,1)}% · 电网 ${fmt(ratio(r.gridKwh,r.p.annualLoad),1)}%</b></div>
    </figure>`;
}
function monthlyTrend(months) {
  const max = Math.max(...months.map(m => Math.max(m.pv,m.load)));
  const unit = max >= 10000 ? 10000 : 1;
  const stepBase = 10 ** Math.floor(Math.log10(max / unit / 4));
  const step = Math.ceil(max / unit / 4 / stepBase) * stepBase;
  const left = 39, bottom = 138, plotHeight = 112, slot = 25;
  const y = value => bottom - plotHeight * (value / unit) / (4 * step);
  const grid = Array.from({length:5}, (_,i) => {
    const level = bottom - i * plotHeight / 4;
    return `<line x1="${left}" x2="339" y1="${level}" y2="${level}" stroke="currentColor" opacity=".15"/><text x="34" y="${level+3}" text-anchor="end">${fmt(i*step,3)}</text>`;
  }).join('');
  const centers = months.map((m,i) => left + slot * (i+.5));
  const bars = months.map((m,i) => {
    const x = centers[i];
    return `<g><title>${m.month}月 · 光伏 ${energyLabel(m.pv)} · 负载 ${energyLabel(m.load)} · 自用 ${energyLabel(m.self)}</title>
    <rect x="${x-8}" y="${y(m.pv)}" width="7" height="${bottom-y(m.pv)}" fill="var(--sd-pv)"/>
    <rect x="${x+1}" y="${y(m.load)}" width="7" height="${bottom-y(m.load)}" fill="var(--sd-load)"/>
    <text x="${x}" y="154" text-anchor="middle">${m.month}</text></g>`;
  }).join('');
  const points = months.map((m,i) => centers[i]+','+y(m.self)).join(' ');
  const dots = months.map((m,i) => `<circle cx="${centers[i]}" cy="${y(m.self)}" r="2" fill="var(--sd-self)"/>`).join('');
  const rows = months.map(m => `<tr><th scope="row">${m.month}月</th>${[m.pv,m.load,m.self,m.exported,m.imported].map(v=>'<td>'+fmt(v,1)+'</td>').join('')}</tr>`).join('');
  return `<figure class="sd-figure"><figcaption>首年逐月电量</figcaption>
    <div class="sd-chart-key"><span>光伏发电</span><span>厂房负载</span><span>光伏自用</span></div>
    <svg class="sd-months" viewBox="0 0 348 172" role="img" aria-label="1月至12月光伏发电、厂房负载和光伏自用趋势">
    <text x="4" y="13">${unit===10000?'万度':'度'}</text>${grid}${bars}<polyline points="${points}" fill="none" stroke="var(--sd-self)" stroke-width="2.5"/>${dots}<text x="337" y="168">月</text></svg>
    <p class="sd-note">光伏按示例季节权重分月估算，厂房按全年日均用电量分摊。逐月自用量取当月可自用发电量与负载的较小值。图中仅计算光伏方案。</p>
    <details><summary>查看 12 个月明细（度）</summary><div class="sd-data-scroll"><table><thead><tr><th>月份</th><th>发电</th><th>负载</th><th>自用</th><th>上网</th><th>购电</th></tr></thead><tbody>${rows}</tbody></table></div></details></figure>`;
}
function report(r){const p=r.p,rows=a=>'<div class="sd-rows">'+a.map(([k,v])=>'<div><span>'+esc(k)+'</span><strong>'+esc(v)+'</strong></div>').join('')+'</div>',section=(n,title,body)=>'<section class="sd-section"><h2><i>'+n+'</i>'+title+'</h2>'+body+'</section>',metric=(v,label)=>'<div><strong>'+esc(v)+'</strong><span>'+esc(label)+'</span></div>';
return `<article class="sd-report"><header class="sd-cover"><span class="sd-eyebrow">小源 · 简易设计 / SIZING REPORT</span><h1>光储项目定容报告</h1><p>${esc(p.location)} · 工商业厂房</p><span class="sd-badge">初步测算 · 待现场校核</span><div class="sd-hero">${metric(fmt(r.pvKw/1000,2)+' MWp','建议光伏直流装机')}${metric(wan(r.generation)+' 万度','首年发电量估算')}${metric(fmt(r.coverage,1)+'%','年用电覆盖比例')}${metric(pay(r.pvPayback),'仅光伏静态回收期')}</div></header><div class="sd-content"><p class="sd-conclusion">优先评估屋顶光伏。${fmt(p.area)}㎡厂房按 ${p.usable}% 屋顶可用率测算，可布置约 ${fmt(r.pvKw/1000,2)} MWp。白天消纳和储能容量仍需结合实际负荷曲线校核。</p>
${section('01','项目概况',rows([['项目位置',p.location],['厂房屋顶面积',fmt(p.area)+' ㎡'],['年度用电量',wan(p.annualLoad)+' 万度'],['日均用电量',fmt(p.annualLoad/365)+' 度'],['全年平均负荷',fmt(r.loadAverage)+' kW']])+'<p class="sd-note">位置、面积与年用电来自需求；默认将厂房面积视作屋顶投影面积，若为多层建筑总建筑面积，请修改。其余数值均为可调整假设。</p>')}
${section('02','光伏设备配置',equipmentTable(r.equipment)+rows([['可用屋顶',fmt(p.area)+' × '+p.usable+'% = '+fmt(r.usableArea)+' ㎡'],['布置功率密度',p.density+' W/㎡（含布置间距假设）'],['实际直流容量',fmt(r.pvKw,2)+' kWp'],['逆变器参考配置',r.invCount+' 台 × 100 kW = '+fmt(r.invKw)+' kW'],['直流 / 交流容配比',r.invKw?fmt(r.pvKw/r.invKw,2):'—']])+'<p class="sd-note">组件按可用面积取整，逆变器按目标容配比 1.2 配置，通信网关按每 80 台光伏逆变器一组预估。深化设计时需校核组串电压、电流、屋面排布和并网条件，通信组网应计入储能及其他接入设备。</p>')}
${section('03','发电与消纳',energyFlow(r)+monthlyTrend(r.monthly)+`<div class="sd-highlight">${wan(r.generation)}<small> 万度 / 年</small></div>`+rows([['年等效利用小时假设',p.yieldHours+' h'],['计算公式',fmt(r.pvKw,2)+' kWp × '+p.yieldHours+' h'],['自用率假设',p.selfUse+'%（按月受厂房负载约束）'],['预计自用电量',wan(r.selfKwh)+' 万度'],['预计余电上网',wan(r.exportKwh)+' 万度'],['覆盖年用电',fmt(r.coverage,2)+'%']])+`<p class="sd-note">利用小时已按交流侧净发电口径假设，不重复扣损耗；${fmt(r.pvKw*900/10000,1)}–${fmt(r.pvKw*1100/10000,1)} 万度为 900–1100 小时的敏感性区间，并非气象预测。未调用现场气象或屋顶测绘数据。</p>`)}
${section('04','投资与首年收益',rows([['光伏综合造价假设',p.pvCost+' 元/W（系统总价口径）'],['光伏投资估算',wan(r.pvInvestment)+' 万元'],['自用电价值假设',p.retail+' 元/度'],['余电上网价假设',p.exportPrice+' 元/度'],['年自用节省',wan(r.selfKwh*p.retail)+' 万元'],['年上网收入',wan(r.exportKwh*p.exportPrice)+' 万元'],['年毛收益',wan(r.pvGross)+' 万元'],['年运维（投资的 '+p.om+'%）',wan(r.pvOm)+' 万元'],['年净收益',wan(r.pvNet)+' 万元'],['静态投资回收期',pay(r.pvPayback)]])+'<p class="sd-note">上述电价和造价是方案假设，不是上海现行电价或供应商报价。静态回收期 = 初始投资 ÷ 首年净收益；未计融资、税费、组件衰减、屋顶租金、设备更换或补贴，不作为 IRR 或收益承诺。</p>')}
${section('05','储能可选方案',`<span class="sd-badge">对比情景 · 不是最优定容结论</span>`+rows([['单柜选型与数量',p.storageCount+' 台 × '+p.storageKw+' kW / '+p.storageKwh+' kWh'],['合计功率 / 容量',fmt(r.storageKw)+' kW / '+fmt(r.storageKwh)+' kWh'],['运行假设',p.cycles+' 次/日 × '+p.days+' 日/年'],['放电深度 / 往返效率',p.dod+'% / '+p.efficiency+'%'],['峰 / 谷电价假设',p.peak+' / '+p.valley+' 元/度'],['年放电量 / 充电量',wan(r.storageDischarge)+' / '+wan(r.storageCharge)+' 万度'],['储能投资（'+p.storageCost+'元/kWh）',wan(r.storageInvestment)+' 万元'],['年套利毛收益',wan(r.storageGross)+' 万元'],['扣运维后年净收益',wan(r.storageNet)+' 万元'],['储能独立静态回收期',p.storageCount?pay(r.storagePayback):'未配置']])+`<p class="sd-note">套利 = 放电量 × 峰价 − 充电量 × 谷价。仅算谷电充、峰段放，不重复计入光伏节省；未计需量收益、衰减、增容和更换成本。需 15 分钟负荷、变压器余量与实际分时电价才能确认充放电可行性。两方案合计初投 ${wan(r.totalInvestment)} 万元，首年净收益 ${wan(r.totalNet)} 万元，均为未校核情景。</p>`)}
${section('06','方案对比与下一步',`<table><thead><tr><th>方案</th><th>初投 / 万元</th><th>年净收益 / 万元</th></tr></thead><tbody><tr><td>仅光伏 · 优先评估</td><td>${wan(r.pvInvestment)}</td><td>${wan(r.pvNet)}</td></tr><tr><td>光伏 + 储能情景</td><td>${wan(r.totalInvestment)}</td><td>${wan(r.totalNet)}</td></tr></tbody></table><ol><li>确认屋顶投影面积、产权、剩余寿命、承重及遮挡。</li><li>提供 12 个月账单与 15 分钟负荷曲线，校验自用率和峰谷充放电窗口。</li><li>核对变压器容量、并网接入条件与消防要求。</li><li>获取设备及 EPC 报价，完成排布、电气设计和全生命周期财务测算。</li></ol>`)}
<details class="sd-section"><summary>数据口径与计算依据</summary><p>本报告使用明确假设进行可复算的前期估算，不读取或修改现有电站配置。年发电 = 直流容量 × 等效利用小时；年自用不超过年度负载；所有金额为人民币。</p><p><a href="https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/using-pvgis-5/pvgis-5-user-manual_en" target="_blank" rel="noopener">欧盟 JRC PVGIS：额定功率、系统损耗及发电量计算说明</a>（方法参考；本报告未调用 PVGIS 实测或模型数据）。</p></details><footer>小源 · 定容报告 v1 · ${esc(new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai'}))}<br>初步方案，待现场与用电数据校核。</footer></div></article>`;}
const fields=[['location','项目位置','text'],['area','屋顶面积（㎡）'],['annualLoad','年用电量（度）'],['usable','屋顶可用率（%）'],['density','布置密度（W/㎡）'],['yieldHours','年等效利用小时（h）'],['selfUse','光伏自用率（%）'],['retail','自用电价值（元/度）'],['exportPrice','上网电价（元/度）'],['pvCost','光伏综合造价（元/W）'],['storageCount','储能柜数量（台）'],['peak','峰电价（元/度）'],['valley','谷电价（元/度）']];
function btn(text,fn,cls){const b=$('button',cls,text);b.type='button';b.onclick=fn;return b;}
function editor(host,input,onGenerate){host.replaceChildren();const title=$('h3','','确认项目参数'),note=$('p','sd-note','已从需求提取位置、面积和年用电。其余为可修改的测算假设。');host.append(title,note);const form=$('form','sd-form');for(const[k,label,type]of fields){const l=$('label','',label),i=$('input');i.name=k;i.type=type||'number';i.value=input[k];i.required=true;if(i.type==='number'){i.step='any';i.min=k==='storageCount'?'0':'0.001';}l.append(i);form.append(l);}const e=$('p','sd-error');e.setAttribute('role','alert');const submit=$('button','sd-primary','生成定容报告');submit.type='submit';form.append(e,submit);form.onsubmit=ev=>{ev.preventDefault();try{const p={...input};for(const i of form.querySelectorAll('input'))p[i.name]=i.type==='number'?i.valueAsNumber:i.value;onGenerate(M.validate(p));}catch(c){e.textContent=c.message;}};host.append(form);}
function show(p, archivedContent) {
  const assistant = document.getElementById('xiaoyuan');
  if (!assistant) return;
  const previousFocus = document.activeElement;
  const title = '光储项目定容报告';
  const overlay = $('section','sd-overlay');
  overlay.setAttribute('aria-label',title);
  const body = $('div','sd-scroll');
  body.tabIndex = 0;
  if (archivedContent) body.append(archivedContent);
  else body.innerHTML = report(M.calculate(p));

  const reading = $('div','sd-reading');
  const track = $('div','sd-scroll-indicator');
  const thumb = $('span');
  track.setAttribute('aria-hidden','true');
  track.append(thumb);
  reading.append(body,track);
  let fadeTimer;

  body.addEventListener('scroll',()=>{
    const {clientHeight,scrollHeight,scrollTop} = body;
    const scrollRange = scrollHeight - clientHeight;
    if (scrollRange <= 0) return;
    const trackHeight = track.clientHeight;
    const thumbHeight = Math.min(trackHeight,Math.max(24,trackHeight * clientHeight / scrollHeight));
    const progress = Math.min(1,Math.max(0,scrollTop / scrollRange));
    thumb.style.height = thumbHeight + 'px';
    thumb.style.transform = `translateY(${(trackHeight - thumbHeight) * progress}px)`;
    track.classList.add('is-scrolling');
    clearTimeout(fadeTimer);
    fadeTimer = setTimeout(()=>track.classList.remove('is-scrolling'),200);
  },{passive:true});

  function close() {
    clearTimeout(fadeTimer);
    overlay.remove();
    previousFocus?.focus({preventScroll:true});
  }

  overlay.addEventListener('keydown',event=>{
    if (event.key !== 'Escape') return;
    event.stopPropagation();
    close();
  });
  const navigation = $('div','xy-top');
  const back = btn('',close,'bk');
  back.setAttribute('aria-label','返回对话');
  const chevron = assistant.querySelector('.xy-top .bk svg');
  if (chevron) back.append(chevron.cloneNode(true));
  else back.textContent = '‹';
  back.append($('span','sd-back-label','返回对话'));
  navigation.append(back,$('span','ti',title));
  overlay.append(navigation,reading);
  assistant.append(overlay);
  body.focus({preventScroll:true});
}
function generate(p) {
  try {
    const r = M.calculate(p);
    const row = addMsg('ai', `按当前参数测算，屋顶光伏可覆盖厂房年用电量的 ${fmt(r.coverage,1)}%。`);
    const bubble = row.querySelector('.bubble');
    const inventory = $('div','sd-chat-inventory');
    inventory.innerHTML = equipmentTable(r.equipment);
    const card = $('section','sd-chat-card sd-estimate-card');
    const metrics = $('dl','sd-estimate-metrics');
    for (const [label,value] of [
      ['光伏装机',fmt(r.pvKw/1000,2)+' MWp'],
      ['首年发电',wan(r.generation)+' 万度'],
      ['仅光伏静态回本年限',pay(r.pvPayback)]
    ]) {
      const entry = $('div');
      entry.append($('dt','',label),$('dd','',value));
      metrics.append(entry);
    }
    const actions = $('div','sd-actions');
    actions.append(
      btn('查看完整报告',()=>show(r.p),'sd-primary'),
      btn('调整参数重新测算',()=>draft(p))
    );
    card.append(
      $('h3','','光储项目定容报告'),
      $('p','sd-project-brief',p.location+' · '+fmt(p.area)+' ㎡ · 年用电 '+wan(p.annualLoad)+' 万度'),
      metrics, actions
    );
    bubble.append(inventory,card);
    g.ChatHistory?.rememberDesign(row, r.p);
    g.convo?.history?.push({role:'assistant',content:'已生成定容报告：'+JSON.stringify(p)});
  } catch(c) {
    addMsg('ai','无法生成报告：'+c.message);
  }
}
function restoreLegacy(message, source) {
  const text = message.text;
  if (!text.includes('光储项目定容报告') || !text.includes('设备清单') || !text.includes('光伏装机')) return false;
  const [before, summary] = text.split('光储项目定容报告');
  const [intro, inventoryText] = before.split('设备清单');
  if (!summary || !inventoryText) return false;
  const lines = summary.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  const row = addMsg('ai',intro.trim());
  const bubble = row.querySelector('.bubble');
  const inventory = $('div','sd-chat-inventory');
  let table = source?.querySelector('table');
  if (table) table = table.cloneNode(true);
  else {
    table = $('table');
    table.append($('caption','','设备清单'));
    const head = table.createTHead().insertRow();
    for (const label of ['品牌 / 设备','型号 / 规格','数量']) head.append($('th','',label));
    const body = table.createTBody();
    const equipment = inventoryText.replace(/^[\s\S]*?数量\s*/, '').trim();
    const rows = equipment.split(/(?<=[\d,]\s*(?:台|块))\s+(?=\S)/);
    for (const part of rows) {
      const tr = body.insertRow();
      let cells = part.trim().split(/\s*\t\s*/);
      if (cells.length !== 3) {
        const match=part.trim().match(/^([\s\S]*?(?:光伏组件|组串式逆变器|通信网关|组件优化器|储能柜(?:（可选）)?))\s+([\s\S]+?)\s+([\d,]+\s*(?:台|块))$/);
        if (match) cells=match.slice(1);
      }
      if (cells.length === 3) {
        for (const cell of cells) {
          const td = tr.insertCell();
          const [first,...rest] = cell.split(/\n+/);
          td.append(document.createTextNode(first));
          if (rest.length) td.append($('small','',rest.join(' ')));
        }
      } else {
        const td = tr.insertCell();
        td.colSpan = 3;
        td.textContent = part;
      }
    }
  }
  table.className='sd-inventory';
  inventory.append(table);
  const card=$('section','sd-chat-card sd-estimate-card'), metrics=$('dl','sd-estimate-metrics');
  const savedMetrics=source?.querySelector('dl');
  if (savedMetrics) metrics.append(...savedMetrics.cloneNode(true).childNodes);
  else for (const label of ['光伏装机','首年发电','仅光伏静态回本年限']) {
    const index=lines.indexOf(label);
    if (index<0 || !lines[index+1]) continue;
    const item=$('div');
    item.append($('dt','',label),$('dd','',lines[index+1]));
    metrics.append(item);
  }
  const brief=source?.querySelector('section h3 + p')?.textContent || lines[0] || '';
  card.append($('h3','','光储项目定容报告'),$('p','sd-project-brief',brief),metrics);
  const actions=$('div','sd-actions');
  actions.append(btn('查看已保存报告',()=>{
    const content=$('article','sd-content');
    content.append($('h2','','光储项目定容报告'),$('p','',brief),metrics.cloneNode(true),inventory.cloneNode(true));
    show(null,content);
  },'sd-primary'));
  card.append(actions);
  bubble.append(inventory,card);
  return true;
}
function draft(p){const row=addMsg('ai','可以，先确认项目输入和测算假设：'),card=$('div','sd-chat-card');row.querySelector('.bubble').append(card);editor(card,{...M.defaults,...p},n=>{generate(n);card.querySelector('button[type="submit"]').disabled=true;});const chat=document.getElementById('xy-chat');chat.scrollTop=chat.scrollHeight;}
function handle(q){
  if(!/简易设计|定容报告|设计报告|投资分析报告/.test(q))return false;
  const p=M.parse(q);
  if(!p.location||!p.area||!p.annualLoad){openChatSkill('design',p);return true;}
  generate({...M.defaults,...p});return true;
}
function open(){openChatSkill('design');}
g.SimpleDesign=Object.freeze({handle,open,show,report,generate,restoreLegacy});
const root=document.getElementById('design-report-root');if(root){try{const p={...M.defaults};for(const[k,v]of new URLSearchParams(location.search))if(k in p)p[k]=v;root.innerHTML=report(M.calculate(p));document.getElementById('design-print').onclick=()=>print();}catch(c){root.textContent='无法生成报告：'+c.message;}}
})(globalThis);
