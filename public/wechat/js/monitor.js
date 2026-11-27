function closeAppMenu(restoreFocus){
  const menu = document.getElementById('app-more-menu');
  const trigger = document.getElementById('app-menu-trigger');
  if (menu) menu.hidden = true;
  if (trigger) { trigger.setAttribute('aria-expanded', 'false'); if (restoreFocus) trigger.focus(); }
}
function toggleAppMenu(){
  const menu = document.getElementById('app-more-menu');
  if (!menu) return;
  if (!menu.hidden) { closeAppMenu(true); return; }
  menu.hidden = false;
  document.getElementById('app-menu-trigger').setAttribute('aria-expanded', 'true');
  menu.querySelector('[role="menuitem"]').focus();
}
document.addEventListener('click', event => { if (!event.target.closest('#app-menu-trigger, #app-more-menu')) closeAppMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape') { const menu = document.getElementById('app-more-menu'); if (menu && !menu.hidden) closeAppMenu(true); } });

/* ---------- 数据 ---------- */
/* ---------- 账号与统计数据（小源回答的唯一数据来源） ---------- */
const ACCOUNT = { name:'共享电站账户', org:'光储监控', role:'使用者', phone:'--' };
const STAT = {
  power:'0.00 kW', day:'0.00 度', revenue:'0.00 元', total:'0.00 万度',
  coal:'0.00 吨', co2:'0.00 吨', trees:'0 棵', updated:'2026/11/01 13:20'
};
/* 当日电站排名（kWh/kWp），与「统计」页排名一致 */
const RANKS = [];
const BASE_STATIONS = [];
/* 运行时数组：仿真电站（实时）+ 预置电站 */
const stations = [];
const BASE_ALARMS = [];
const alarms = [];              /* 运行时：仿真台推送 + 预置 */
const BASE_DEVICES = [];
/* 运行时数组：仿真设备（每站 4 台）+ 预置设备 */
const devices = [];
const sugs = [
  [
    ['overview', '电站总览', '我名下有哪些电站？'],
    ['solar', '今日发电', '今天一共发了多少电？'],
    ['revenue', '今日收益', '今天各电站的收益怎么样？'],
    ['alarm', '设备告警', '当前有哪些设备告警？'],
  ],
  [
    ['power', '实时功率', '看看现在的功率曲线'],
    ['chart', '历史发电', '过去7天各电站的发电量是多少？'],
    ['chart', '电站对比', '哪个电站今天发电最多？'],
    ['battery', '储能电量', '各电站当前的储能 SOC 是多少？'],
  ],
  [
    ['revenue', '历史收益', '苏州仿真电站上个月收益多少？'],
    ['overview', '电站状态', '哪些电站在线？'],
    ['power', '功率趋势', '看一下光伏和负载的实时功率曲线'],
    ['report', '设备清单', '苏州仿真电站有哪些设备？'],
  ],
];
const welcomeSkills = [
  ['design', '简易设计', '按屋顶面积和年用电量生成定容报告'],
  ['battery', '策略优化', '选择电站和充放电目标'],
  ['health', '健康诊断', '查看指定电站的设备健康状态'],
  ['report', '订阅月报', '选择月报推送日期和时间'],
];
const welcomeIcons = {
  overview: ['blue', 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z'],
  solar: ['amber', 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19'],
  revenue: ['mint', 'M3 7h16a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V7zm0 0 13-4v4m5 4h-5v4h5'],
  alarm: ['amber', 'M12 3 2 20h20L12 3zm0 6v5m0 2.5v.5'],
  power: ['violet', 'M2 13h5l3-8 4 14 3-8h5'],
  chart: ['blue', 'M4 4v16h17M8 15v-4m5 4V7m5 8V4'],
  battery: ['violet', 'M3 6h16v12H3z M22 10v4m-11-6-3 5h5l-2 3'],
  report: ['blue', 'M5 3h10l4 4v14H5z M14 3v5h5M8 12h8m-8 4h6'],
  design: ['blue', 'M3 20 20 3v17H3zm8-4h5v-5'],
  health: ['mint', 'M12 2 4 5v6c0 5 4 8 8 11 4-3 8-6 8-11V5z M8 12l3 3 5-6'],
};
const lvIcon = {
  imp:  '<span class="ic" style="background:rgba(255,159,10,.18)"><svg width="15" height="15" viewBox="0 0 24 24" fill="#ff9f0a"><path d="M12 2.5 22 20H2L12 2.5zM11 9.5v5h2v-5h-2zm0 6.5v2h2v-2h-2z"/></svg></span>',
  hint: '<span class="ic" style="background:rgba(10,132,255,.18)"><svg width="15" height="15" viewBox="0 0 24 24" fill="#0a84ff"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg></span>',
  minor:'<span class="ic" style="background:rgba(255,214,10,.18)"><svg width="15" height="15" viewBox="0 0 24 24" fill="#ffd60a"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg></span>',
};
/* ---------- 渲染 ---------- */
function houseSVG(seed){
  const hue=[205,35,150,265,15][seed%5];
  return `<svg class="house-thumb" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="hsl(${hue},35%,72%)"/>
    <circle cx="78" cy="20" r="11" fill="rgba(255,255,240,.85)"/>
    <rect y="62" width="100" height="38" fill="hsl(${hue},30%,42%)"/>
    <path d="M18 62 50 34l32 28z" fill="#f4f1ea"/>
    <rect x="24" y="52" width="34" height="10" fill="#2b3a55" transform="skewX(-18)" opacity="0"/>
    <path d="M30 52h26l6 5H30z" fill="#25344e"/>
    <path d="M31 51.5h24v-3H31z" fill="#1d2a40"/>
    <rect x="42" y="56" width="11" height="16" fill="#5a4632"/>
    <rect x="58" y="66" width="12" height="12" fill="#ffd98a" opacity=".9"/>
    <path d="M58 66h12v12H58z" fill="none" stroke="#7a6440" stroke-width="1"/>
  </svg>`;
}
let stFilter = 'all';
let chosen = new Set();                       /* 选择电站页勾选结果，空 = 全部 */
let filterState = { type:'all', cap:'all', cfg:'all', d1:'', d2:'', country:'' };
function visibleStations(){
  const inp = document.getElementById('st-search');
  const kw = inp ? inp.value.trim().toLowerCase() : '';
  let list = stations.map((s,i)=>({s,i}));
  if (stFilter !== 'all')          list = list.filter(o => o.s.status === stFilter);
  if (chosen.size > 0)             list = list.filter(o => chosen.has(o.s.name));
  if (kw)                          list = list.filter(o => o.s.name.toLowerCase().includes(kw));
  const F = filterState;
  if (F.type !== 'all')            list = list.filter(o => o.s.type === F.type);
  if (F.cap === '0-10')            list = list.filter(o => o.s.cap <= 10);
  else if (F.cap === '10-50')      list = list.filter(o => o.s.cap > 10 && o.s.cap <= 50);
  else if (F.cap === '50-100')     list = list.filter(o => o.s.cap > 50 && o.s.cap <= 100);
  else if (F.cap === '100-1000')   list = list.filter(o => o.s.cap > 100 && o.s.cap <= 1000);
  else if (F.cap === '>1000')      list = list.filter(o => o.s.cap > 1000);
  if (F.cfg !== 'all')             list = list.filter(o => (o.s.cfg || []).includes(F.cfg));
  if (F.d1)                        list = list.filter(o => o.s.date >= F.d1);
  if (F.d2)                        list = list.filter(o => o.s.date <= F.d2);
  if (F.country)                   list = list.filter(o => (o.s.country || '').toLowerCase().includes(F.country.trim().toLowerCase()));
  return list;
}
function renderStations(f){
  if (f) stFilter = f;
  const list = visibleStations();
  const box = document.getElementById('station-list');
  if (!list.length) { box.innerHTML = '<div class="empty-tip">没有更多数据了</div>'; return; }
  box.innerHTML = list.map(({s,i})=>`
    <div class="sw-row" data-i="${i}">
      <div class="sw-acts"><button type="button" class="sw-del" onclick="event.stopPropagation();askDeleteStation(${i})">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round"><path d="M4 7h16M9.5 7V4.8h5V7M6.6 7l.8 12.2h9.2L17.4 7"/><path d="M10.2 11v4.8M13.8 11v4.8"/></svg>删除</button></div>
    <div class="card station" tabindex="0" role="button">
      <div class="thumb">${houseSVG(i)}</div>
      <div class="body">
        <div class="name">${s.name}${s.live?'<i class="live-dot"></i>':''}</div>
        <div class="addr">${s.addr}</div>
        <div class="stats">
          <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2"><path d="M3 20h18M6 20V9m6 11V4m6 16v-8"/></svg>${s.kwp}</span>
          <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2"><circle cx="12" cy="13" r="5"/><path d="M12 8V3M9.5 4.5h5"/></svg>${s.day}</span>
          ${s.total?`<span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#8e8e93" stroke-width="2"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M7 12h.01" stroke-linecap="round" stroke-width="2.4"/></svg>${s.total}</span>`:''}
        </div>
        ${s.live?`<div class="st-power"><svg width="12" height="12" viewBox="0 0 24 24" fill="#30d158"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>实时 ${(s.power||0).toFixed(2)} kW · SOC ${(s.soc||0).toFixed(0)}%</div>`:''}
      </div>
      <span class="tag ${s.status==='ok'?'ok':(s.status==='fault'?'fault':'off')}">${s.status==='ok'?'正常':(s.status==='fault'?'故障':'断连')}</span>
    </div></div>`).join('');
  bindSwipe();
  cleanupOpenRow();
}

/* ---------- 电站卡片滑动：左滑露删除，右滑进详情 ---------- */
const SW_W = 92;
let swRow = null, swStartX = 0, swStartY = 0, swDX = 0, swLock = null, swMoved = false, swRowOpen = null;

function cleanupOpenRow(){
  if (swRowOpen && (!swRowOpen.isConnected || !swRowOpen.classList.contains('open'))) swRowOpen = null;
}
function swClose(row){
  if (!row) return;
  row.classList.remove('open');
  const c = row.querySelector('.card');
  if (c) c.style.transform = '';
  if (swRowOpen === row) swRowOpen = null;
}
function swOpen(row){
  if (!row) return;
  if (swRowOpen && swRowOpen !== row) swClose(swRowOpen);
  row.classList.add('open');
  const c = row.querySelector('.card');
  if (c) c.style.transform = '';
  swRowOpen = row;
}
function bindSwipe(){
  const box = document.getElementById('station-list');
  if (!box || box._sw) return;
  box._sw = true;
  box.addEventListener('keydown', e => {
    if (!e.target.matches('.station') || !['Enter', ' '].includes(e.key)) return;
    e.preventDefault();
    openPlantDetail(+e.target.closest('.sw-row').dataset.i);
  });

  box.addEventListener('pointerdown', function(e){
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const row = e.target.closest('.sw-row');
    if (!row) return;
    if (e.target.closest('.sw-acts')) return;
    if (swRowOpen && swRowOpen !== row) swClose(swRowOpen);
    swRow = row; swStartX = e.clientX; swStartY = e.clientY;
    swDX = 0; swLock = null; swMoved = false;
    row.classList.add('drag');
  });

  box.addEventListener('pointermove', function(e){
    if (!swRow) return;
    const dx = e.clientX - swStartX, dy = e.clientY - swStartY;
    if (!swLock && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) swLock = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    if (swLock !== 'x') return;
    if (e.cancelable) e.preventDefault();
    const base = swRow.classList.contains('open') ? -SW_W : 0;
    let tx = base + dx;
    if (tx > 0) tx = tx * 0.32;                       /* 右滑阻尼 */
    tx = Math.max(-SW_W - 26, Math.min(0, tx));
    const card = swRow.querySelector('.card');
    if (card) card.style.transform = 'translateX(' + tx.toFixed(1) + 'px)';
    swDX = dx;
    if (Math.abs(dx) > 8) swMoved = true;
  }, { passive: false });

  function finish(e){
    if (!swRow) return;
    const row = swRow;
    const dx = swDX;
    row.classList.remove('drag');
    swRow = null;
    const wasOpen = row.classList.contains('open');
    if (swLock !== 'x' || !swMoved) {
      if (wasOpen) swClose(row);
      else openPlantDetail(+row.dataset.i);
      return;
    }
    if (dx < -44 || (wasOpen && dx < 30 && dx > -30)) { swOpen(row); return; }
    if (dx > 58) { swClose(row); openPlantDetail(+row.dataset.i); return; }
    swClose(row);
  }
  box.addEventListener('pointerup', finish);
  box.addEventListener('pointercancel', function(){
    if (!swRow) return;
    const row = swRow; swRow = null;
    row.classList.remove('drag');
    if (row.classList.contains('open')) swOpen(row); else swClose(row);
  });
  box.addEventListener('click', function(e){
    /* 阻止内层卡片默认点击（滑动已在 pointerup 处理） */
    if (e.target.closest('.sw-del')) return;
    e.preventDefault();
  });
}

/* ---------- 删除确认 ---------- */
let cfCb = null;
function cfAsk(html, cb){
  cfCb = cb;
  const t = document.getElementById('cf-text');
  if (t) t.innerHTML = html;
  const m = document.getElementById('cf-mask');
  if (m) m.classList.add('on');
}
function cfCancel(){
  const m = document.getElementById('cf-mask');
  if (m) m.classList.remove('on');
  cfCb = null;
}
function cfConfirm(){
  const cb = cfCb; cfCb = null;
  const m = document.getElementById('cf-mask');
  if (m) m.classList.remove('on');
  if (cb) cb();
}
const hiddenBase = new Set();
function askDeleteStation(i){
  const s = stations[i];
  if (!s) return;
  cfAsk('删除「<b>' + esc(s.name) + '</b>」？<br><span style="font-size:12px;color:#8e8e93">' +
    (s.live ? '仿真台里的这座电站会一起移除，删除后不可恢复' : '这张卡片会从列表移除，不可恢复') + '</span>', function(){
    doDeleteStation(s);
  });
}
function doDeleteStation(s){
  if (!s) return;
  if (swRowOpen) swClose(swRowOpen);
  if (s.live && s.pid && SIMSTATE && (Date.now() - (SIMSTATE.ts || 0) < 15000)) {
    const k = stations.indexOf(s);
    if (k >= 0) stations.splice(k, 1);
    renderStations();
    if (typeof refreshChips === 'function') refreshChips();
    if (typeof renderRank === 'function') renderRank();
    sendSimCmd({ type: 'delete', plantId: s.pid }, '删除电站');
  } else {
    hiddenBase.add(s.name);
    const k = stations.indexOf(s);
    if (k >= 0) stations.splice(k, 1);
    renderStations();
    if (typeof refreshChips === 'function') refreshChips();
    if (typeof renderRank === 'function') renderRank();
  }
  toast('已删除「' + s.name + '」');
}
/* ---------- 电站详情页（点击首页电站卡弹出，样式对齐 FusionSolar 电站概况） ---------- */
let pdIdx = -1;
/* 每度电折算系数（与统计页同口径）：标准煤 / CO₂ / 等效植树 */
const PD_COAL = 0.000678, PD_CO2 = 0.000806, PD_TREE = 0.0014;
function openPlantDetail(i){
  pdIdx = i;
  pdRender();
  document.getElementById('plant-detail').classList.add('show');
}
function closePlantDetail(){
  const el = document.getElementById('plant-detail');
  if (el) el.classList.remove('show');
  pdIdx = -1;
}
function pdPlantOf(s){ return (s && s.live) ? (PLANTS.find(p => p.id === s.pid) || null) : null; }
function pdSet(k, txt){
  const el = document.querySelector('[data-pd="' + k + '"]');
  if (el) el.textContent = txt;
}
/* 24h 分时电价图：谷 / 平 / 峙三段阶梯（示意），虚线为上网电价参考 */
function pdTariffSVG(p){
  const t = (p && p.tariff) || {};
  const retail = t.retail != null ? +t.retail : 0;
  const fit = t.fit != null ? +t.fit : 0;
  const W = 340, H = 118, L = 26, R = 336, T = 8, B = 96;
  const seg = h => (h < 7 ? 0.7 : h < 19 ? 1 : 1.3);
  const maxV = Math.max(retail * 1.3, fit, 0.1) * 1.18;
  const y = v => B - (B - T) * Math.min(1, v / maxV);
  const x = h => L + (R - L) * h / 24;
  const cols = { 0: '#1f4a35', 1: '#2c7a4f', 2: '#3fae6a' };
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '">';
  s += '<line x1="' + L + '" y1="' + B + '" x2="' + R + '" y2="' + B + '" stroke="#333845" stroke-width="1"/>';
  [0, maxV / 2, maxV].forEach(v => {
    s += '<text x="' + (L - 4) + '" y="' + (y(v) + 3) + '" fill="#5f6675" font-size="8.5" text-anchor="end">' + (+v.toFixed(2)) + '</text>';
  });
  for (let h = 0; h < 24; h++) {
    const v = retail * seg(h);
    const x0 = x(h), x1 = x(h + 1);
    s += '<rect x="' + (x0 + 0.4).toFixed(1) + '" y="' + y(v).toFixed(1) + '" width="' + Math.max(1, x1 - x0 - 0.8).toFixed(1) +
         '" height="' + Math.max(1, B - y(v)).toFixed(1) + '" fill="' + cols[h < 7 ? 0 : (h < 19 ? 1 : 2)] + '" opacity=".92"/>';
  }
  if (fit > 0) {
    s += '<line x1="' + L + '" y1="' + y(fit).toFixed(1) + '" x2="' + R + '" y2="' + y(fit).toFixed(1) + '" stroke="#8e8e93" stroke-width="1" stroke-dasharray="5 4"/>';
  }
  [[0, '00:00'], [8, '08:00'], [16, '16:00'], [24, '24:00']].forEach(a => {
    s += '<text x="' + x(a[0]).toFixed(1) + '" y="' + (B + 14) + '" fill="#6d7380" font-size="9" text-anchor="' + (a[0] === 0 ? 'start' : a[0] === 24 ? 'end' : 'middle') + '">' + a[1] + '</text>';
  });
  return s + '</svg>';
}
function pdNodeSVG(){
  /* 十字能量流连线：光伏上 / 储能左 / 电网右 / 负载下 */
  return '<svg class="wire" viewBox="0 0 355 296" preserveAspectRatio="none">' +
    '<path d="M177.5 59 V237 M64 142 H291 M64 142 177.5 59 M291 142 177.5 59 M64 142 177.5 237 M291 142 177.5 237" stroke="rgba(255,255,255,.16)" stroke-width="1.4" fill="none"/>' +
    '<path d="M177.5 59 V237 M64 142 H291" stroke="rgba(255,255,255,.1)" stroke-width="1" fill="none"/>' +
  '</svg>';
}
/* ---------- 能量流向图：哪股功率从哪流向哪，用流动虚线 + 数值标出来 ---------- */
const PD_N = { load: [84, 104], grid: [271, 104], bat: [84, 242], pv: [271, 242] };
const PD_SEGS = [
  { k: 'pv-load',   a: 'pv',   b: 'load', c: '#30d158' },
  { k: 'pv-bat',    a: 'pv',   b: 'bat',  c: '#30d158' },
  { k: 'pv-grid',   a: 'pv',   b: 'grid', c: '#30d158' },
  { k: 'bat-load',  a: 'bat',  b: 'load', c: '#ff9f0a' },
  { k: 'grid-load', a: 'grid', b: 'load', c: '#bf5af2' }
];
function pdSegState(p){
  const pv = p ? p.pv : 0, load = p ? p.load : 0, bat = p ? p.bat : 0, grid = p ? p.grid : 0;
  const closed = !!(p && p.closed);
  return {
    'pv-load':   !closed && pv > 0.05 && load > 0.05,
    'pv-bat':    !closed && pv > 0.05 && bat < -0.05,
    'pv-grid':   !closed && pv > 0.05 && grid < -0.05,
    'bat-load':  !closed && bat > 0.05 && load > 0.05,
    'grid-load': !closed && grid > 0.05 && load > 0.05
  };
}
function pdFlowSVG(p){
  const st = pdSegState(p);
  let body = '';
  PD_SEGS.forEach(g => {
    const A = PD_N[g.a], B = PD_N[g.b], s = st[g.k];
    body += '<line class="pd-wire-base" x1="' + A[0] + '" y1="' + A[1] + '" x2="' + B[0] + '" y2="' + B[1] + '"/>';
    body += '<line data-flow="' + g.k + '" class="flowline" x1="' + A[0] + '" y1="' + A[1] + '" x2="' + B[0] + '" y2="' + B[1] +
      '" stroke="' + g.c + '" stroke-width="2.2" stroke-linecap="round" opacity="' + (s ? '.92' : '0') + '"/>';
  });
  return '<svg class="wire" viewBox="0 0 355 264" preserveAspectRatio="none" aria-hidden="true">' + body + '</svg>';
}
function pdFlowUpdate(p){
  const st = pdSegState(p);
  PD_SEGS.forEach(g => {
    const s = st[g.k];
    const l = document.querySelector('[data-flow="' + g.k + '"]');
    if (l) l.setAttribute('opacity', s ? '.92' : '0');
  });
}
/* ---------- 天气 / 辐照：按电站所在地的纬度、日期与当地时刻推算（演示数据） ---------- */
function pdWeatherOf(p, s){
  let tz = (p && p.tz) || (s && s.tz) || COUNTRY_TZ[(s && s.country) || ''] || 'Asia/Shanghai';
  let hh, mm, doy;
  if (p && p.local && p.local.minOfDay != null) {
    hh = Math.floor(p.local.minOfDay / 60); mm = p.local.minOfDay % 60; doy = p.local.doy || 1;
  } else {
    const o = localOf(tz, nowUtc());
    hh = o.hh; mm = o.mm;
    doy = Math.round((Date.UTC(o.y, o.mo - 1, o.dd) - Date.UTC(o.y, 0, 1)) / 864e5) + 1;
  }
  const lat = (p && p.geo && p.geo.lat != null) ? +p.geo.lat : ((s && s.geo && s.geo.lat != null) ? +s.geo.lat : 31.2);
  const decl = 23.45 * Math.sin(2 * Math.PI * (284 + doy) / 365);
  const latR = lat * Math.PI / 180, dR = decl * Math.PI / 180;
  const hour = hh + mm / 60;
  const ha = (hour - 12) * 15 * Math.PI / 180;
  const sinEl = Math.sin(latR) * Math.sin(dR) + Math.cos(latR) * Math.cos(dR) * Math.cos(ha);
  const elev = Math.asin(Math.max(-1, Math.min(1, sinEl))) * 180 / Math.PI;
  const cloud = (p && p.cloud != null) ? Math.max(0, Math.min(1, +p.cloud)) : 0.3;
  const ghi = elev > 0 ? Math.round(1020 * Math.pow(Math.sin(elev * Math.PI / 180), 1.12) * (1 - 0.75 * cloud)) : 0;
  const yearT = 28.5 - Math.abs(lat) * 0.34;
  const amp = 3.4 + Math.abs(lat) * 0.23;
  const season = -Math.cos(2 * Math.PI * ((doy - (lat >= 0 ? 15 : 197)) / 365)) * amp;
  const diur = 4.6 * Math.sin(2 * Math.PI * (hour - 15) / 24);
  const temp = yearT + season + diur - cloud * 1.6;
  let cond, ico;
  if (elev <= 0) { cond = cloud < 0.5 ? T('晴', 'Clear') : T('多云', 'Cloudy'); ico = cloud < 0.5 ? '🌙' : '☁'; }
  else if (cloud < 0.28) { cond = T('晴', 'Sunny'); ico = '☀'; }
  else if (cloud < 0.58) { cond = T('多云', 'Partly cloudy'); ico = '⛅'; }
  else if (cloud < 0.82) { cond = T('阴', 'Overcast'); ico = '☁'; }
  else { cond = T('小雨', 'Light rain'); ico = '🌧'; }
  return { temp: temp, ghi: ghi, cond: cond, ico: ico, elev: elev, hh: hh, mm: mm };
}
const PD_ART = {
  load: '<path fill="#536372" d="m8 35 56-28 52 19v31L62 79 8 58Z"/><path fill="#a8b6c4" d="M8 35 64 7l52 19-54 27Z"/><path fill="#728291" d="M62 53 116 26v31L62 79Z"/><path fill="#d7e2e9" d="m70 60 20-9v17l-20 8Zm24-12 16-8v18l-16 7Z"/><path stroke="#c6a986" stroke-width="3" d="m15 44 38 14"/>',
  grid: '<g fill="none" stroke="#617789" stroke-width="2" stroke-linejoin="round"><path d="m22 76 22-66 20 66M32 46h22L30 60h28L25 76h37L35 35h16L39 22h9M65 78 83 23l19 55M74 50h18L70 65h26L65 78h37L78 37h10"/><path d="M27 37 44 23l16 14H27Zm41 13 15-12 15 12H68Z"/></g>',
  bat: '<path fill="#8295a7" d="M13 34 65 12l43 19v32L57 81 13 61Z"/><path fill="#dbe6ef" d="m13 34 52-22 43 19-51 22Z"/><path fill="#aebfcc" d="m57 53 51-22v32L57 81Z"/><path stroke="#677f91" stroke-width="2" d="m20 42 29 12m-29-7 29 12m-29-7 29 12"/><path fill="#159666" d="m87 43-13 17 9-2-3 13 16-20-10 3Z"/>',
  pv: '<path fill="#7e96aa" d="m10 55 37-30 39-6-1 7-38 36-37 7Zm30 14 41-29 35-4-1 7-37 35-39 5Z"/><path fill="#385775" d="m6 55 43-34 38-5-40 37Zm32 16 43-34 38-5-39 37Z"/><path fill="none" stroke="#7996af" d="m16 47 40-5m-30-3 40-6m-30-2 40-6M18 54l42-34M31 54l43-36M48 63l42-5m-32-3 42-6m-32-2 42-7M51 70l43-35M64 70l43-36"/>'
};
function pdNumber(value, digits = 2){
  return Number.isFinite(value) ? value.toFixed(digits) : '—';
}
function pdFlowNode(key, label, value, extra = ''){
  const [x, y] = PD_N[key];
  return '<div class="pd-node" style="left:' + (x / 355 * 100) + '%;top:' + (y / 264 * 100) + '%">' +
    '<div><b data-pd="' + key + '">' + pdNumber(value) + '</b> <small>kW</small></div><div class="lb">' + label + extra + '</div>' +
    '<svg viewBox="0 0 124 86" aria-hidden="true">' + PD_ART[key] + '</svg></div>';
}
const PD_METRIC_ART = {
  day: '<path d="m13 2-8 12h6l-1 8 9-12h-6l1-8Z" fill="currentColor" stroke="none"/>',
  rev: '<circle cx="12" cy="12" r="9"/><path d="m8.5 7.5 3.5 5 3.5-5M9 13h6m-6 3h6m-3-3v5"/>',
  charge: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M10 3h4m-2 7v6m-3-3h6"/>',
  discharge: '<rect x="6" y="5" width="12" height="16" rx="2"/><path d="M10 3h4m-5 10h6"/>',
  rated: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M6 12h2c1-4 3-4 4 0s3 4 4 0h2"/>',
  total: '<path d="M4 4v16h16M8 16v-3m5 3V9m5 7V5"/>'
};
function pdMetric(key, label, value, unit){
  return '<div class="pd-metric"><span class="pd-metric-icon pd-metric-' + key + '" aria-hidden="true">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    PD_METRIC_ART[key] + '</svg></span><div><div class="v"><span data-pd="' +
    key + '">' + value + '</span> <small>' + unit + '</small></div><div class="l">' + label + '</div></div></div>';
}
const PD_CHART_KEY = 'xy-plant-chart:';
function pdSelectedChart(pid){
  if (pid == null) return '';
  try {
    const selected = localStorage.getItem(PD_CHART_KEY + pid);
    if (selected !== null) return selected;
    if (localStorage.getItem('xy-plant-pv-line:' + pid) === '1') return 'pv';
    return localStorage.getItem('xy-plant-sankey:' + pid) === '1' ? 'sankey' : '';
  } catch { return ''; }
}
function pdSankeyData(p){
  if (!p || ![p.pv, p.load, p.bat, p.grid].every(Number.isFinite)) {
    return '<p class="pd-sankey-empty">暂无功率数据，等待仿真台更新。</p>';
  }
  const inputs = [
    ['光伏发电', p.pv, '#248b65'],
    ['电网购电', p.grid, '#427bd9'],
    ['储能放电', p.bat, '#9b68d8']
  ].filter(([,value]) => value > 0);
  const outputs = [
    ['负载用电', p.load, '#388bc0'],
    ['储能充电', -p.bat, '#9b68d8'],
    ['余电上网', -p.grid, '#427bd9'],
    ['限发', p.curtail, '#ca8533']
  ].filter(([,value]) => value > 0);
  if (!inputs.length && !outputs.length) {
    return '<p class="pd-sankey-empty">当前没有功率流动。</p>';
  }
  const sum = flows => flows.reduce((total, [,value]) => total + value, 0);
  const scale = 64 / Math.max(sum(inputs), sum(outputs));
  function column(flows, input){
    const gap = 9;
    let nodeY = (112 - sum(flows) * scale - Math.max(0, flows.length - 1) * gap) / 2;
    let busY = (112 - sum(flows) * scale) / 2;
    // Keep labels apart even when a flow is too small to occupy a full line.
    const labelStep = 112 / Math.max(1, flows.length);
    return flows.map(([name,value,color], index) => {
      const width = value * scale;
      const from = input ? 77 : 167, to = input ? 163 : 253;
      const left = input ? nodeY : busY, right = input ? busY : nodeY;
      const mid = (from + to) / 2;
      const path = 'M' + from + ' ' + left + ' C' + mid + ' ' + left + ' ' + mid + ' ' + right + ' ' + to + ' ' + right +
        ' L' + to + ' ' + (right + width) + ' C' + mid + ' ' + (right + width) + ' ' + mid + ' ' + (left + width) + ' ' + from + ' ' + (left + width) + ' Z';
      const x = input ? 0 : 330, anchor = input ? 'start' : 'end';
      const y = (index + 0.5) * labelStep;
      const label = value.toFixed(2) + ' kW';
      const group = '<g><title>' + name + ' ' + label + '</title><path d="' + path + '" fill="' + color + '" fill-opacity=".64"/>' +
        '<rect x="' + (input ? 73 : 253) + '" y="' + nodeY + '" width="4" height="' + width + '" rx="1" fill="' + color + '"/>' +
        '<text x="' + x + '" y="' + (y - 2) + '" text-anchor="' + anchor + '">' + name +
        '<tspan x="' + x + '" dy="12" class="pd-sankey-value">' + label + '</tspan></text></g>';
      nodeY += width + gap;
      busY += width;
      return group;
    }).join('');
  }
  return '<svg viewBox="0 0 330 128" role="img" aria-label="当前能量流向及功率">' +
    '<rect x="163" y="24" width="4" height="64" rx="2" fill="currentColor" opacity=".55"/>' +
    column(inputs, true) + column(outputs, false) +
    '<text x="165" y="109" text-anchor="middle" class="pd-sankey-value">电站母线</text></svg>';
}
const pdPvHistory = new Map();
function pdPvLineData(p){
  const history = globalThis.SolarHistory;
  const datasets = history?.datasets || [];
  const months = datasets.filter(record => record.plantId === p?.id);
  if (!months.length) return '<p class="pd-sankey-empty">正在读取历史仿真数据，暂无可显示的记录。</p>';
  let cached = pdPvHistory.get(p.id);
  if (cached?.version !== history.generatedAt) {
    cached = { version:history.generatedAt, points:null };
    pdPvHistory.set(p.id, cached);
    Promise.all(months.map(record => WorkspaceClient.request('history/' +
      encodeURIComponent(record.plantId) + '/' + record.month, {signal:AbortSignal.timeout(10000)})))
      .then(records => {
        const days = new Map();
        for (const {hourly} of records) {
          for (const hour of hourly) {
            if (!Number.isFinite(hour.pvKwAvg) || !Number.isFinite(hour.minutes) || hour.minutes <= 0) continue;
            const utc = Date.parse(hour.date + 'T00:00:00Z');
            if (!Number.isFinite(utc)) continue;
            const day = days.get(utc) || {kwMinutes:0, minutes:0};
            day.kwMinutes += hour.pvKwAvg * hour.minutes;
            day.minutes += hour.minutes;
            days.set(utc, day);
          }
        }
        const ordered = [...days].sort(([a], [b]) => a - b);
        const cutoff = ordered.at(-1)?.[0] - 89 * 86400000;
        cached.points = ordered.filter(([utc]) => utc >= cutoff).map(([utc, day]) => [utc, day.kwMinutes / day.minutes]);
      })
      .catch(() => { cached.error = true; })
      .finally(refreshPlantDetail);
  }
  if (cached.error) return '<p class="pd-sankey-empty">历史仿真数据读取失败，请刷新后重试。</p>';
  if (!cached.points) return '<p class="pd-sankey-empty">正在读取最近 90 天的光功率数据…</p>';
  const points = cached.points;
  if (points.length < 2) return '<p class="pd-sankey-empty">历史采样不足，暂无法绘制折线。</p>';

  const end = points.at(-1)[0], start = end - 89 * 86400000;
  const peak = Math.max(1, ...points.map(([,pv]) => pv));
  const step = 10 ** Math.floor(Math.log10(peak));
  const max = Math.ceil(peak / step) * step;
  const x = utc => 36 + 282 * (utc - start) / (end - start);
  const y = pv => 110 - 94 * pv / max;
  const axes = [0, max / 2, max].map(value =>
    '<line x1="36" x2="318" y1="' + y(value) + '" y2="' + y(value) + '" stroke="currentColor" opacity=".25"/>' +
    '<text class="pd-sankey-value" x="32" y="' + (y(value) + 3) + '" text-anchor="end">' + value + '</text>'
  ).join('');
  const date = utc => new Date(utc).toISOString().slice(0,10);
  const labels = [start, start + 30 * 86400000, start + 60 * 86400000, end].map((utc, index) =>
    '<text class="pd-sankey-value" x="' + x(utc) + '" y="129" text-anchor="' + ['start','middle','middle','end'][index] + '">' + date(utc).slice(5) + '</text>'
  ).join('');
  const line = points.map(([utc,pv], index) => {
    const continuous = index > 0 && utc - points[index - 1][0] === 86400000;
    return (continuous ? 'L' : 'M') + x(utc).toFixed(2) + ',' + y(pv).toFixed(2);
  }).join(' ');
  const [lastUtc,lastPv] = points.at(-1);
  return '<svg viewBox="0 0 330 138" role="img" aria-label="最近90天日均光伏功率">' + axes + labels +
    '<path d="' + line + '" fill="none" stroke="#248b65" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<circle cx="' + x(lastUtc) + '" cy="' + y(lastPv) + '" r="3" fill="#248b65"/></svg><p class="pd-sankey-caption">' + date(start) + ' 至 ' + date(end) + ' · ' + points.length + ' 天有数据</p>';
}
const PD_CHARTS = {
  operations: {title:'运营分析卡片',description:'已生成收益、发电量与近7天趋势，可点选日期、切换指标和图表类型。'},
  sankey: { title:'能量流桑基图', caption:'功率', description:'图表显示光伏、电网、储能和负载之间的功率流向。', graph:pdSankeyData },
  pv: { title:'光功率折线图', caption:'最近 90 天 · 日均光伏功率 · kW · 历史仿真', description:'图表显示最近 90 天的日均光伏功率，单位为 kW。', graph:pdPvLineData }
};
function pdChartCards(station){
  const id = pdSelectedChart(station.pid);
  const chart = PD_CHARTS[id];
  if (!chart) return '';
  return '<section class="pd-sec pd-sankey" id="pd-' + id + '" data-plant-chart="' + id + '"><header><div class="t">' + chart.title + '</div>' +
    '<button type="button" onclick="removePlantChart(this)">移除</button></header>' +
    '<p class="pd-sankey-caption"></p><div class="pd-sankey-body"></div></section>';
}
function refreshPlantCharts(p){
  for (const card of document.querySelectorAll('#plant-detail [data-plant-chart]')) {
    const chart = PD_CHARTS[card.dataset.plantChart];
    if(card.dataset.plantChart==='operations'){
      const host=card.querySelector('.pd-sankey-body');
      host.setAttribute('data-operations-ui','');
      if(globalThis.OperationsUI)OperationsUI.render(host,p);
      continue;
    }
    const stale = p && SIMSTATE && Date.now() - SIMSTATE.ts > 15000;
    const caption = card.dataset.plantChart === 'pv' ? chart.caption : chart.caption + ' · kW · ' + (stale ? '最后快照' : '仿真数据');
    const body = card.querySelector('.pd-sankey-body');
    const graph = chart.graph(p);
    card.querySelector('.pd-sankey-caption').textContent = caption;
    if (body.dataset.graph !== graph) {
      body.innerHTML = graph;
      body.dataset.graph = graph;
    }
  }
}
function removePlantChart(button){
  const station = stations[pdIdx];
  const card = button.closest('[data-plant-chart]');
  if (!station || !card) return;
  const chart = PD_CHARTS[card.dataset.plantChart];
  try { localStorage.setItem(PD_CHART_KEY + station.pid, ''); }
  catch { toast('无法更新图表设置'); return; }
  card.remove();
  toast('已移除' + chart.title);
}
function showPlantChart(pid, id){
  const index = stations.findIndex(station => station.pid === pid);
  if (index === -1) { toast('当前电站列表里找不到该电站'); return; }
  if (pdSelectedChart(pid) !== id) { toast('图表已移除，可在对话中重新添加'); return; }
  closeXY();
  go('home');
  openPlantDetail(index);
  document.getElementById('pd-' + id)?.scrollIntoView({block:'center'});
}
function handlePlantChart(q, started){
  if (!/添加|增加|加个|加一个|加一张|新增|生成|做一个/.test(q)) return false;
  const id = /运营分析|运营报告卡片/.test(q) ? 'operations' : /桑基图/.test(q) ? 'sankey' : /(?:光功率|光伏(?:发电)?功率).{0,8}(?:折线图|曲线图|曲线)/.test(q) ? 'pv' : '';
  if (!id) return false;
  const chart = PD_CHARTS[id];
  if (/不要|别加|取消|移除|删除/.test(q)) return false;
  const available = stations.filter(station => station.pid != null);
  const named = available.filter(station => q.includes(station.name));
  const matches = named.length ? named : available.filter(station => {
    const alias = station.name.replace(/仿真电站$|光储电站$|电站$/,'');
    return alias.length >= 2 && q.includes(alias);
  });
  if (matches.length !== 1) {
    const names = (matches.length ? matches : available).map(station => station.name);
    const message = names.length ? '请指定一个电站。可选：' + names.join('、') + '。' : '当前还没有可用的电站，请等仿真台发布电站数据后再试。';
    showAnswerTime(addMsg('ai', message), started);
    return true;
  }
  const station = matches[0];
  const previous = pdSelectedChart(station.pid);
  try { localStorage.setItem(PD_CHART_KEY + station.pid, id); }
  catch { addMsg('ai', '当前浏览器无法保存图表设置，请检查浏览器存储权限。'); return true; }
  if (stations[pdIdx]?.pid === station.pid) pdRender();
  const reply = addMsg('ai', '「' + station.name + '」' + (previous === id ? '已有' : previous ? '已切换为' : '已添加') + chart.title + '。' + chart.description + '设置保存在当前浏览器。');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'xy-plant-chart-link';
  button.textContent = '去电站查看 ›';
  button.onclick = () => showPlantChart(station.pid, id);
  reply.querySelector('.bubble').append(button);
  showAnswerTime(reply, started);
  return true;
}
const PD_BILL_KEY = 'xy-bill-retail:';
let pendingBillTariff = null;
function readBillTariff(pid){
  try { return JSON.parse(localStorage.getItem(PD_BILL_KEY + pid)); }
  catch { return null; }
}
function billTariffLabel(bill){
  return bill.retail.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') + ' ' + bill.currency + '/kWh';
}
function openBillTariff(pid){
  const index = stations.findIndex(station => station.pid === pid);
  if (index < 0) { toast('当前电站列表里找不到该电站'); return; }
  closeXY();
  go('home');
  openPlantDetail(index);
  document.getElementById('pd-tariff')?.scrollIntoView({block:'center'});
}
function offerBillTariff(question,bill,started,source){
  pendingBillTariff = null;
  const stationsNamed = stations.filter(station => station.pid != null && question.includes(station.name));
  const hasStationName = /电站/.test(question);
  const station = stationsNamed.length === 1 ? stationsNamed[0] : !hasStationName
    ? stations[pdIdx] || stations.find(station => station.name === '苏州仿真电站')
    : null;
  const lines = ['**' + source + '**' + (bill.period ? ' · ' + bill.period : ''), ...bill.items.map(item => '- ' + item)];
  if (!Number.isFinite(bill.retail) || !bill.currency) {
    lines.push('未能确认可写入的单一含税购电单价和币种，请补充清晰明细。');
  } else if (!station || station.pid == null) {
    lines.push('请在发送账单时附上目标电站的完整名称。');
  } else {
    pendingBillTariff = {pid:station.pid, name:station.name, retail:bill.retail, currency:bill.currency, period:bill.period};
    lines.push('建议将「' + station.name + '」的演示购电电价更新为 **' + billTariffLabel(bill) + '**（含税按量单价，固定费用单独计）。账单币种原样展示，配置保存在当前浏览器。是否更新？回复「是」或「否」。');
  }
  showAnswerTime(addMsg('ai',lines.join('\n\n')),started);
}
function confirmBillTariff(question,started){
  if (!pendingBillTariff) return false;
  const yes = /^(是|是的|确认|确认更新|同意更新|更新|好|可以)[。！!\s]*$/.test(question);
  const no = /^(否|不|不用|不更新|不要更新|取消|取消更新)[。！!\s]*$/.test(question);
  if (!yes && !no) { pendingBillTariff = null; return false; }
  const draft = pendingBillTariff;
  pendingBillTariff = null;
  if (no) { showAnswerTime(addMsg('ai','已取消本次账单电价更新。'),started); return true; }
  const station = stations.find(station => station.pid === draft.pid && station.name === draft.name);
  if (!station) { addMsg('ai','目标电站已不可用，请重新上传账单。'); return true; }
  try { localStorage.setItem(PD_BILL_KEY + station.pid,JSON.stringify(draft)); }
  catch { addMsg('ai','当前浏览器无法保存演示电价。'); return true; }
  if (stations[pdIdx]?.pid === station.pid) pdRender();
  const row = addMsg('ai','已将「' + station.name + '」的演示购电电价更新为 **' + billTariffLabel(draft) + '**。');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'xy-plant-chart-link';
  button.textContent = '查看电站电价 ›';
  button.onclick = () => openBillTariff(station.pid);
  row.querySelector('.bubble').append(button);
  showAnswerTime(row,started);
  return true;
}

function pdRender(){
  const s = stations[pdIdx];
  const el = document.getElementById('plant-detail');
  if (!s || !el) return;
  el.dataset.plantId=s.pid||'';
  const p = pdPlantOf(s);
  const billTariff = readBillTariff(s.pid);
  const t = (p && p.tariff) || {};
  const sym = t.sym || '¥';
  const fit = t.fit != null ? +t.fit : 0;
  const retail = t.retail != null ? +t.retail : 0;
  /* 告警条：该站最重要的那条告警 */
  const al = alarms.find(a => a.st === s.name && a.lv === 'imp') || alarms.find(a => a.st === s.name);
  const lab = s.status === 'fault' ? '断连' : (al ? (al.lv === 'imp' ? '重要' : '提示') : '');
  const dayPv = p ? p.dayPv : 0;
  const monthPv = Number.isFinite(p?.energyTotals?.monthPvKwh) ? p.energyTotals.monthPvKwh.toFixed(2) : '—';
  const yearPv = Number.isFinite(p?.energyTotals?.yearPvKwh) ? p.energyTotals.yearPvKwh.toFixed(2) : '—';
  const kwhTotal = p ? (p.totalBase + p.dayPv) : 0;
  const rev = p ? (p.dayRev || 0) : 0;
  const socDecor = '<svg viewBox="0 0 100 44" preserveAspectRatio="xMidYMax slice"><path d="M0 44 V30 h22 v-6 h10 l6 6 h20 l8 8 h34" fill="none" stroke="#5a4632" stroke-width="7"/><path d="M52 22 l24 10" stroke="#8a6a45" stroke-width="3"/><circle cx="30" cy="20" r="4" fill="#8a6a45"/></svg>';
  const wx = pdWeatherOf(p, s);
  const isClosed = !!(p && p.closed);
  const co2Decor = '<svg viewBox="0 0 100 44" preserveAspectRatio="xMidYMax slice"><rect x="18" y="16" width="12" height="28" fill="#3c4450"/><rect x="46" y="10" width="14" height="34" fill="#4a5563"/><ellipse cx="52" cy="8" rx="16" ry="7" fill="#5d6875" opacity=".85"/><ellipse cx="70" cy="14" rx="12" ry="5" fill="#5d6875" opacity=".6"/></svg>';
  const treeDecor = '<svg viewBox="0 0 100 44" preserveAspectRatio="xMidYMax slice"><path d="M18 44 V30 M10 34 18 20 26 34 Z M34 44 V26 M26 32 34 16 42 32 Z M52 44 V30 M44 36 52 22 60 36 Z" fill="#2e5c46" stroke="#2e5c46" stroke-width="3"/></svg>';
  el.innerHTML =
    '<div class="pd-top">' +
      '<span class="pd-back" onclick="closePlantDetail()"><svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg></span>' +
      '<span class="nm">' + esc(s.name) + (isClosed ? '<span class="pd-off-badge">已关闭</span>' : '') + '</span>' +
      '<svg onclick="toast(\'更多操作\')" width="18" height="18" viewBox="0 0 18 18" fill="currentColor" style="cursor:pointer"><circle cx="4" cy="4" r="1.8"/><circle cx="14" cy="4" r="1.8"/><circle cx="4" cy="9" r="1.8"/><circle cx="14" cy="9" r="1.8"/><circle cx="4" cy="14" r="1.8"/><circle cx="14" cy="14" r="1.8"/></svg>' +
    '</div>' +
    (al ? '<div class="pd-alarm" onclick="go(\'ops\')"><span class="lab">' + lab + '</span><span class="tx">' + esc(al.title) + '</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,123,123,.75)" stroke-width="2.2" stroke-linecap="round"><path d="m9 5 7 7-7 7"/></svg></div>' : '') +
    '<div class="pd-weather">' +
      '<span class="wt"><span data-pd="wx-ico">' + wx.ico + '</span><b data-pd="wx-t">' + wx.temp.toFixed(1) + '℃</b>' +
        '<span data-pd="wx-c">' + wx.cond + '</span></span>' +
      '<span class="irr" data-pd="wx-g">' + (wx.ghi > 0 ? T('辐照 ', 'GHI ') + wx.ghi + ' W/m²' : T('夜间', 'Night · no irradiance')) + '</span>' +
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6d7380" stroke-width="1.8" style="margin-left:2px"><circle cx="12" cy="12" r="9"/><path d="M12 10.5V17M12 7.2v.2" stroke-linecap="round"/></svg>' +
      '<span class="rt" onclick="toast(\'实时数据每 1.5 秒刷新\')"><svg width="10" height="10" viewBox="0 0 24 24" fill="#30d158"><circle cx="12" cy="12" r="6"/></svg>实时</span></div>' +
    '<div class="pd-state' + (isClosed || s.status === 'fault' ? ' offline' : '') + '"><span data-pd="status">' + (isClosed || s.status === 'fault' ? '断连' : '正常') + '</span></div>' +
    '<div class="pd-flow" id="pd-energy-flow">' + pdFlowSVG(p) +
      '<div class="pd-call" onclick="toast(\'呼叫运维人员\')"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 3.2c.7-.7 1.9-.6 2.5.2l1.7 2.4c.5.7.4 1.6-.2 2.2l-1 1c.5 1.2 2.2 3 3.4 3.5l1-1c.6-.6 1.5-.7 2.2-.2l2.4 1.7c.8.6.9 1.8.2 2.5l-1.1 1.1c-.7.7-1.7 1-2.6.7-5-1.6-9-5.6-10.6-10.6-.3-.9 0-1.9.7-2.6z"/></svg></div>' +
      pdFlowNode('load', '负载', p?.load) +
      pdFlowNode('grid', '电网', Math.abs(p?.grid)) +
      pdFlowNode('bat', '储能', Math.abs(p?.bat), Number.isFinite(p?.soc) ? ' <span class="pd-soc" data-pd="soc">' + Math.round(p.soc) + '%</span>' : '') +
      pdFlowNode('pv', '光伏', p?.pv) +
    '</div>' +
    '<details class="pd-sec pd-current" open><summary class="t">当前数据</summary><div class="pd-current-grid">' +
      pdMetric('day', '今日发电', pdNumber(dayPv), '度') +
      pdMetric('rev', '今日收益', esc(sym) + pdNumber(rev), '') +
      pdMetric('charge', '今日充电', pdNumber(p?.dayChg), '度') +
      pdMetric('discharge', '今日放电', pdNumber(p?.dayDis), '度') +
      pdMetric('rated', '逆变器额定功率', pdNumber(p?.invKw), 'kW') +
      pdMetric('total', '累计发电量', pdNumber(kwhTotal / 10000), '万度') +
    '</div><div class="pd-period"><div>本月发电 <b data-pd="mon">' + monthPv + '</b> 度</div><div>年内发电 <b data-pd="year">' + yearPv + '</b> 度</div></div>' +
    '<div class="pd-note" data-pd="data-note">'+(p?.intentScenario?'冬季遮挡场景 · 发电量与收益已同步到小源解释':'电量按已仿真时段累计')+'</div>' +
    '</details>' +
    pdChartCards(s) +
    (globalThis.ProductionStrategy?.stationCard(s.pid) || '') +
    '<div class="pd-sec">' +
      '<div class="t">社会贡献</div>' +
      '<div class="pd-soc3">' +
        '<div><div class="v"><span data-pd="coal">' + (kwhTotal * PD_COAL).toFixed(2) + '</span> <small>吨</small></div><div class="l">节约标准煤</div>' + socDecor + '</div>' +
        '<div><div class="v"><span data-pd="co2">' + (kwhTotal * PD_CO2).toFixed(2) + '</span> <small>吨</small></div><div class="l">CO₂减排量</div>' + co2Decor + '</div>' +
        '<div><div class="v"><span data-pd="tree">' + Math.round(kwhTotal * PD_TREE) + '</span> <small>棵</small></div><div class="l">等效植树量</div>' + treeDecor + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="pd-sec" id="pd-tariff">' +
      (billTariff
        ? '<div class="t">购电电价</div><div class="pd-price-big">' + esc(billTariffLabel(billTariff)) + '</div>' +
          '<div class="pd-price-sub">账单导入 · 演示购电电价 · 含税按量单价</div>' +
          '<div class="pd-note">' + esc(billTariff.period || '') + ' · 原仿真购电 ' + retail.toFixed(3) + ' ' + esc(t.cur || sym) + '/kWh</div>'
        :
      '<div class="t">购电电价</div>' +
      '<div class="pd-price-big"><span data-pd="retail">' + retail.toFixed(3) + '</span> <small>' + esc(sym) + '/度</small></div>' +
      '<div class="pd-price-sub">当前购电' + (p ? ' · ' + esc(p.country || '') : '') + '</div>' +
      '<div class="pd-ftref">' + fit.toFixed(2) + ' ' + esc(sym) + '/度（上网电价）</div>' +
      '<div class="pd-chart">' + pdTariffSVG(p) + '</div>' +
      '<div class="pd-note">分时电价按谷 / 平 / 峰示意（0.7× / 1× / 1.3×）· 虚线为上网电价</div>') +
    '</div>' +
    '<div class="pd-sec pd-ops">' +
      '<button class="' + (isClosed ? 'on-btn' : 'off-btn') + '" onclick="togglePlantPower()">' +
        (isClosed ? T('启动电站', 'Start plant') : T('关闭电站', 'Shut down plant')) + '</button>' +
      '<div class="o-note">' + (isClosed
        ? T('电站已关闭：不发电、不储能，首页卡片状态显示「断连」', 'Plant is off — no generation, card shows Disconnected')
        : T('关闭后电站停止发电与调度，首页卡片状态会变成「断连」', 'After shutdown the plant stops and its card turns Disconnected')) + '</div>' +
    '</div>' +
    '<div class="pd-tab">' +
      '<div class="on"><span class="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#3a7afe" stroke-width="1.9"><path d="M3 11.2 12 3.5l9 7.7"/><path d="M5.3 9.8V20h13.4V9.8"/></svg></span>电站概况</div>' +
      '<div onclick="switchHome(\'stat\');closePlantDetail()"><span class="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="8.5"/><path d="M12 12V5.5M12 12l4.5 4.5"/></svg></span>统计数据</div>' +
      '<div onclick="document.getElementById(\'pd-energy-flow\').scrollIntoView({block:\'center\'})"><span class="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 4v16M12 12h8"/></svg></span>电站视图</div>' +
      '<div onclick="go(\'dev\')"><span class="ic"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="4" y="4.5" width="16" height="6.5" rx="2"/><rect x="4" y="13.5" width="16" height="6.5" rx="2"/></svg></span>设备</div>' +
    '</div>';
  refreshPlantCharts(p);
}
/* 详情页开着时跟随快照刷新数值 */
function refreshPlantDetail(){
  if (pdIdx < 0) return;
  const el = document.getElementById('plant-detail');
  if (!el || !el.classList.contains('show')) return;
  const s = stations[pdIdx];
  if (!s) return;
  const p = pdPlantOf(s);
  refreshPlantCharts(p);
  const t = (p && p.tariff) || {};
  const sym = t.sym || '¥';
  /* 天气 / 辐照 / 能量流 / 关站按钮：跟着快照一起刷新 */
  try {
    const wx = pdWeatherOf(p, s);
    pdSet('wx-ico', wx.ico);
    pdSet('wx-t', wx.temp.toFixed(1) + '℃');
    pdSet('wx-c', wx.cond);
    pdSet('wx-g', wx.ghi > 0 ? T('辐照 ', 'GHI ') + wx.ghi + ' W/m²' : T('夜间', 'Night · no irradiance'));
    pdFlowUpdate(p);
    pdSyncPower(p);
  } catch (e) {}
  if (p) {
    pdSet('pv', p.pv.toFixed(2));
    pdSet('load', p.load.toFixed(2));
    pdSet('bat', Math.abs(p.bat).toFixed(2));
    pdSet('grid', Math.abs(p.grid).toFixed(2));
    const disconnected = p.closed || s.status === 'fault';
    pdSet('status', disconnected ? '断连' : '正常');
    el.querySelector('.pd-state').classList.toggle('offline', disconnected);
    pdSet('soc', Number.isFinite(p.soc) ? Math.round(p.soc) + '%' : '');
    pdSet('charge', pdNumber(p.dayChg));
    pdSet('discharge', pdNumber(p.dayDis));
    pdSet('rated', pdNumber(p.invKw));
    pdSet('day', p.dayPv.toFixed(2));
    pdSet('rev', sym + (p.dayRev || 0).toFixed(2));
    pdSet('data-note',p.intentScenario?'冬季遮挡场景 · 发电量与收益已同步到小源解释':'电量按已仿真时段累计');
    pdSet('mon', Number.isFinite(p.energyTotals?.monthPvKwh) ? p.energyTotals.monthPvKwh.toFixed(2) : '—');
    pdSet('year', Number.isFinite(p.energyTotals?.yearPvKwh) ? p.energyTotals.yearPvKwh.toFixed(2) : '—');
    const kwh = p.totalBase + p.dayPv;
    pdSet('total', (kwh / 10000).toFixed(2));
    pdSet('coal', (kwh * PD_COAL).toFixed(2));
    pdSet('co2', (kwh * PD_CO2).toFixed(2));
    pdSet('tree', String(Math.round(kwh * PD_TREE)));
    pdSet('retail', (t.retail != null ? +t.retail : 0).toFixed(3));
  }
}
/* 关站 / 启动：按钮与顶部状态跟随电站开关状态 */
function pdSyncPower(p){
  const closed = !!(p && p.closed);
  const btn = document.querySelector('#plant-detail .pd-ops button');
  if (btn) {
    btn.className = closed ? 'on-btn' : 'off-btn';
    btn.textContent = closed ? T('启动电站', 'Start plant') : T('关闭电站', 'Shut down plant');
  }
  const note = document.querySelector('#plant-detail .pd-ops .o-note');
  if (note) note.textContent = closed
    ? T('电站已关闭：不发电、不储能，首页卡片状态显示「断连」', 'Plant is off — no generation; its card shows Disconnected')
    : T('关闭后电站停止发电与调度，首页卡片状态会变成「断连」', 'After shutdown the plant stops and its card turns Disconnected');
  const s = stations[pdIdx];
  const nm = document.querySelector('#plant-detail .pd-top .nm');
  if (nm && s) nm.innerHTML = esc(s.name) + (closed ? '<span class="pd-off-badge">已关闭</span>' : '');
}
function togglePlantPower(){
  const s = stations[pdIdx];
  if (!s) return;
  const p = pdPlantOf(s);
  if (!p || !s.pid) { toast(T('这座电站未连接仿真台，无法操作', 'This plant is not connected to the simulator')); return; }
  const turnOn = !!p.closed;
  const go = function(){
    sendSimCmd({ type: 'power', plantId: s.pid, on: turnOn }, turnOn ? '启动电站' : '关闭电站');
    toast(turnOn ? T('正在启动电站…', 'Starting the plant…') : T('正在关闭电站…', 'Shutting down…'));
    p.closed = !turnOn;
    s.closed = !turnOn;
    s.status = turnOn ? (p.gridOut ? 'fault' : 'ok') : 'off';
    pdSyncPower(p);
    pdFlowUpdate(p);
    syncStationTags();
    setTimeout(function(){ if (pdIdx >= 0) refreshPlantDetail(); }, 1800);
  };
  if (turnOn) { go(); return; }
  cfAsk('关闭「<b>' + esc(s.name) + '</b>」？<br><span style="font-size:12px;color:#8e8e93">' +
    '关闭后停止发电与调度，首页卡片状态会变成「断连」，随时可以再启动</span>', go);
}
function renderAlarms(){
  const inp = document.getElementById('op-search');
  const kw = inp ? inp.value.trim().toLowerCase() : '';
  const list = alarms.filter(a => !kw || (a.title + ' ' + a.dev + ' ' + a.st).toLowerCase().includes(kw));
  const box = document.getElementById('alarm-list');
  if (!list.length) { box.innerHTML = '<div class="empty-tip">没有更多数据了</div>'; return; }
  box.innerHTML = list.map(a=>`
    <div class="card">
      <div class="alarm-head">${lvIcon[a.lv]}<span class="ti">${a.title}</span></div>
      <div class="kv"><span class="k">消息状态</span><span class="v">--</span></div>
      <div class="kv"><span class="k">设备名称</span><span class="v">${a.dev}</span></div>
      <div class="kv"><span class="k">电站名称</span><span class="v">${a.st}</span></div>
      <div class="kv"><span class="k">产生时间</span><span class="v">${a.t}</span></div>
    </div>`).join('');
}
let devSort = 'name';
function renderDevices(){
  const inp = document.getElementById('dev-search');
  const kw = inp ? inp.value.trim().toLowerCase() : '';
  const key = devSort === 'sn' ? 'sn' : 'name';
  const list = devices
    .filter(d => !kw || String(d[key]).toLowerCase().includes(kw))
    .slice()
    .sort((a,b) => String(a[key]).localeCompare(String(b[key]), 'zh'));
  const box = document.getElementById('dev-list');
  if (!list.length) { box.innerHTML = '<div class="dev-empty">没有匹配的设备</div>'; return; }
  box.innerHTML = list.map(d=>`
    <div class="card dev-card">
      <div class="head"><span class="nm">${d.name}</span><span class="tag ${d.status==='ok'?'ok':'off'}">${d.status==='ok'?'在线':'离线'}</span></div>
      ${d.live?`<div class="kv"><span class="k">实时数据</span><span class="v" data-dv="${d.sn}">${d.liveVal||'--'}</span></div>`:''}
      <div class="kv"><span class="k">电站名称</span><span class="v">${d.st}</span></div>
      <div class="kv"><span class="k">SN 号</span><span class="v">${d.sn}</span></div>
      <div class="kv"><span class="k">设备类型</span><span class="v">${d.type}</span></div>
      <div class="kv"><span class="k">质保有效期</span><span class="v">-/-/-</span></div>
      ${d.live&&['ESS','逆变器'].includes(d.type)?`<div class="link-row"><button type="button" class="xy-plant-chart-link" onclick="DeviceParameterDemo.open('${esc(d.pid)}','${d.type==='ESS'?'storage':'inverter'}')">参数设置 ›</button></div>`:''}
      ${d.sub?`<div class="link-row"><a onclick="toast('查看下挂设备')">下挂设备</a><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#3a7afe" stroke-width="2"><path d="m9 5 7 7-7 7"/></svg></div>`:''}
    </div>`).join('');
}
/* ---------- 首页 电站/统计 切换 ---------- */
function switchHome(m){
  const isStat = m === 'stat';
  document.getElementById('home-station').style.display = isStat ? 'none' : '';
  document.getElementById('home-stat').style.display = isStat ? '' : 'none';
  document.getElementById('seg-st').className = isStat ? 'seg dim' : 'seg';
  document.getElementById('seg-stat').className = isStat ? 'seg' : 'seg dim';
  if (isStat) {
    renderBars(statMode);
    const lc = document.getElementById('live-chart');
    if (lc && typeof simChartSVG === 'function') lc.innerHTML = simChartSVG();
  }
}

/* ---------- 统计柱状图 ---------- */
const STAT_DATA = {
  day:  { label:'2026/11/01', yMax:600, yStep:100, step:2,
          labels:['00','02','04','06','08','10','12','14','16','18','20','22'],
          vals:[60,52,0,0,0,0,0,0,480,55,38,18,0,0,0,0,0,0,0,0,0,0,0,0] },
  month:{ label:'2026/11', yMax:1500, yStep:500, step:5,
          labels:['01','05','10','15','20','25','30'],
          vals:[420,680,0,0,540,900,760,0,0,620,1100,980,0,0,760,1250,880,0,0,640,1000,0,0,720,560,0,0,480,300,165] },
  year: { label:'2026', yMax:20000, yStep:5000, step:1,
          labels:['01','02','03','04','05','06','07','08','09','10','11','12'],
          vals:[12000,9800,15200,11000,16800,15400,17500,16850,0,0,0,1654] },
  life: { label:'全部', yMax:60000, yStep:15000, step:1,
          labels:['2019','2020','2021','2022','2023','2024','2025','2026'],
          vals:[8000,14000,22000,30000,36000,15000,0,14300] }
};
let statMode = 'day';
let statHistoryMonth = '', statHistoryYear = '';
function historyStatData(mode){
  if (mode === 'day') return;
  const rows = globalThis.SolarHistory?.datasets || [];
  const months = [...new Set(rows.map(d => d.month))].sort();
  if (!statHistoryMonth && months.length) statHistoryMonth = months[months.length - 1];
  if (!statHistoryYear && months.length) statHistoryYear = months[months.length - 1].slice(0, 4);
  const d = STAT_DATA[mode];
  if (mode === 'month') {
    const month = statHistoryMonth || new Date().toISOString().slice(0, 7), [y, m] = month.split('-').map(Number);
    d.vals = new Array(new Date(Date.UTC(y, m, 0)).getUTCDate()).fill(0);
    for (const record of rows.filter(r => r.month === month)) for (const day of record.daily || []) d.vals[Number(day.date.slice(8)) - 1] += day.totals.dayPv;
    d.step = 5; d.labels = d.vals.filter((_, i) => i % 5 === 0).map((_, i) => String(i * 5 + 1).padStart(2, '0'));
    d.label = month.replace('-', '/') + ' · 历史仿真';
    d.hasHistory = rows.some(r => r.month === month);
  } else if (mode === 'year') {
    const year = statHistoryYear || String(new Date().getFullYear()); d.vals = new Array(12).fill(0);
    for (const record of rows.filter(r => r.month.startsWith(year + '-'))) d.vals[Number(record.month.slice(5)) - 1] += record.totals.dayPv;
    d.step = 1; d.labels = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')); d.label = year + ' · 已补跑月份';
    d.hasHistory = rows.some(r => r.month.startsWith(year + '-'));
  } else {
    d.labels = [...new Set(rows.map(r => r.month.slice(0, 4)))].sort();
    d.vals = d.labels.map(year => rows.filter(r => r.month.startsWith(year + '-')).reduce((sum, r) => sum + r.totals.dayPv, 0));
    if (!d.vals.length) { d.vals = [0]; d.labels = ['—']; }
    d.step = 1; d.label = '已补跑历史仿真';
    d.hasHistory = rows.length > 0;
  }
  const max = Math.max(1, ...d.vals), unit = Math.pow(10, Math.floor(Math.log10(max / 4)));
  d.yStep = Math.ceil(max / 4 / unit) * unit; d.yMax = Math.ceil(max / d.yStep) * d.yStep;
}
window.addEventListener('solar-history-ready', () => { if (statMode !== 'day') setStatMode(statMode); refreshPlantDetail(); });
function setStatMode(m){
  statMode = m;
  document.querySelectorAll('#stat-seg span').forEach(el => el.classList.toggle('on', el.dataset.m === m));
  renderBars(m);
  document.getElementById('stat-date').innerHTML = STAT_DATA[m].label +
    ' <svg width="11" height="11" viewBox="0 0 24 24" fill="#c8c8d0"><path d="M7 10l5 6 5-6H7z"/></svg>';
}
function statShift(dir){
  if (statMode === 'month' && statHistoryMonth) {
    const [y, m] = statHistoryMonth.split('-').map(Number); statHistoryMonth = new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 7); setStatMode('month');
  } else if (statMode === 'year' && statHistoryYear) { statHistoryYear = String(Number(statHistoryYear) + dir); setStatMode('year'); }
  else toast(statMode === 'day' ? '当日使用实时仿真数据；历史月份请切换到“月”' : '当前展示已补跑历史');
}
function renderBars(mode){
  historyStatData(mode);
  const d = STAT_DATA[mode];
  if (mode !== 'day' && !d.hasHistory) { document.getElementById('stat-bars').innerHTML = '<div class="empty-tip">该时段尚未补跑历史数据</div>'; return; }
  const axisFactor = d.yMax >= 1000000 ? 1000000 : d.yMax >= 10000 ? 1000 : 1;
  const axisUnit = axisFactor === 1000000 ? 'GWh' : axisFactor === 1000 ? 'MWh' : 'kWh';
  const W=340, H=170, L=32, R=W-10, T=12, B=142;
  const iw = R-L, ih = B-T, n = d.vals.length, gap = iw/n, bw = Math.min(gap*0.5, 14);
  let s = '<svg viewBox="0 0 '+W+' '+H+'">';
  for (let g = 0; g <= d.yMax; g += d.yStep){
    const y = (B - ih*g/d.yMax).toFixed(1);
    s += '<line x1="'+L+'" y1="'+y+'" x2="'+R+'" y2="'+y+'" stroke="#2c2c2e" stroke-width="1" stroke-dasharray="3 4"/>';
    s += '<text x="'+(L-6)+'" y="'+(+y+3.5)+'" fill="#6c6c70" font-size="10" text-anchor="end">'+(g/axisFactor).toLocaleString('zh-CN',{maximumFractionDigits:1})+'</text>';
  }
  s += '<text x="'+(L-6)+'" y="'+(T-3)+'" fill="#8e8e93" font-size="10" text-anchor="end">'+axisUnit+'</text>';
  s += '<line x1="'+L+'" y1="'+B+'" x2="'+R+'" y2="'+B+'" stroke="#3a3a3e" stroke-width="1"/>';
  d.vals.forEach((v,i)=>{
    if (!v) return;
    const x = L + gap*i + (gap-bw)/2, h = ih*v/d.yMax;
    s += '<rect x="'+x.toFixed(1)+'" y="'+(B-h).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="2.5" fill="#30d158"/>';
  });
  d.labels.forEach((lb,i)=>{
    const x = L + gap*(i*d.step) + gap/2;
    s += '<text x="'+x.toFixed(1)+'" y="160" fill="#6c6c70" font-size="10" text-anchor="middle">'+lb+'</text>';
  });
  document.getElementById('stat-bars').innerHTML = s + '</svg>' + (mode === 'day' ? '' : '<div style="font-size:11px;color:var(--muted);line-height:1.6">两座电站合计 · 仅已补跑时段 · 模型仿真，非真实历史数据</div>');
}

/* ---------- 当日电站排名 ---------- */
const MEDAL_COLORS = [['#f6c344','#7a4c00'],['#c9cfd9','#3a3f47'],['#e2906a','#6b2f12']];
function renderRank(){
  const rows = (typeof rankList === 'function') ? rankList() : [];
  document.getElementById('rank-list').innerHTML = rows.map((r, i)=>{
    const name = r.name;
    const medal = i < 3
      ? '<svg width="20" height="24" viewBox="0 0 22 26"><path d="M3 2h16v22l-8-5.5L3 24z" fill="'+MEDAL_COLORS[i][0]+'"/><text x="11" y="16" font-size="12" font-weight="700" text-anchor="middle" fill="'+MEDAL_COLORS[i][1]+'">'+(i+1)+'</text></svg>'
      : (i+1);
    return '<div class="rank-row" onclick="toast(\'查看电站：'+name+'\')">'+
      '<span class="rank-medal">'+medal+'</span>'+
      '<span class="rank-thumb">'+houseSVG(r.idx >= 0 ? r.idx : i)+'</span>'+
      '<span class="rank-name">'+name+'</span>'+
      '<span class="rank-val">'+(r.v || 0).toFixed(2)+' <i>kWh/kWp</i></span>'+
    '</div>';
  }).join('');
}

/* ---------- 选择电站 ---------- */
let pickSet = new Set();
function openPicker(){
  pickSet = new Set(chosen);
  const s = document.getElementById('pk-search'); if (s) s.value = '';
  renderPickList();
  document.getElementById('picker').classList.add('open');
}
function closePicker(){ document.getElementById('picker').classList.remove('open'); }
function renderPickList(){
  const inp = document.getElementById('pk-search');
  const kw = inp ? inp.value.trim().toLowerCase() : '';
  const list = stations.filter(s => !kw || s.name.toLowerCase().includes(kw));
  const allOn = pickSet.size === stations.length && stations.length > 0;
  const check = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3"><path d="m5 12.5 4.5 4.5L19 6.5"/></svg>';
  const box = document.getElementById('pk-list');
  box.innerHTML =
    '<div class="pk-org" onclick="toggleOrg()">'+
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="#c8c8d0"><path d="M7 10l5 6 5-6H7z"/></svg>'+
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8c8d0" stroke-width="1.7"><rect x="4" y="4" width="12" height="16" rx="2"/><path d="M16 8h4v12a2 2 0 0 1-2 2h-8" opacity=".6"/></svg>'+
      '<span style="flex:1">testComp8</span>'+
      '<span class="cbox '+(allOn?'on':'')+'">'+check+'</span>'+
    '</div>' +
    (list.length ? list.map(s =>
      '<div class="pk-row" onclick="togglePick(\'' + s.name + '\')">'+
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8c8d0" stroke-width="1.7"><path d="M13 3 5.5 13.5H11L9.5 21 18 10.5h-5.5z"/></svg>'+
        '<span class="pnm">' + s.name + '</span>'+
        '<span class="cbox '+(pickSet.has(s.name)?'on':'')+'">'+check+'</span>'+
      '</div>').join('') : '<div class="empty-tip">没有更多数据了</div>');
}
function toggleOrg(){
  if (pickSet.size === stations.length) pickSet.clear();
  else stations.forEach(s => pickSet.add(s.name));
  renderPickList();
}
function togglePick(name){
  if (pickSet.has(name)) pickSet.delete(name); else pickSet.add(name);
  renderPickList();
}
function confirmPick(){
  chosen = new Set(pickSet);
  closePicker();
  renderStations();
  toast(chosen.size ? '已按所选 ' + chosen.size + ' 个电站过滤' : '已显示全部电站');
}

/* ---------- 筛选抽屉 ---------- */
function openFilter(){
  document.getElementById('fmask').classList.add('on');
  document.getElementById('fsheet').classList.add('on');
}
function closeFilter(){
  document.getElementById('fmask').classList.remove('on');
  document.getElementById('fsheet').classList.remove('on');
}
function pickF(el){
  if (el.classList.contains('on')) return;
  el.parentElement.querySelectorAll('.fchip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
}
function groupVal(k){
  const el = document.querySelector('.f-chips[data-k="'+k+'"] .fchip.on');
  return el ? el.dataset.v : 'all';
}
function resetFilter(){
  document.querySelectorAll('.f-chips').forEach(g=>{
    g.querySelectorAll('.fchip').forEach((c,i)=>c.classList.toggle('on', i === 0));
  });
  ['f-d1','f-d2','f-country'].forEach(id=>{
    const el = document.getElementById(id); if (el) el.value = '';
  });
  filterState = { type:'all', cap:'all', cfg:'all', d1:'', d2:'', country:'' };
  renderStations();
  document.getElementById('st-filter-btn').style.color = '';
  toast('已重置筛选');
}
function confirmFilter(){
  filterState = {
    type: groupVal('type'),
    cap:  groupVal('cap'),
    cfg:  groupVal('cfg'),
    d1: (document.getElementById('f-d1').value || ''),
    d2: (document.getElementById('f-d2').value || ''),
    country: (document.getElementById('f-country').value || '').trim()
  };
  closeFilter();
  renderStations();
  const n = ['type','cap','cfg'].filter(k => filterState[k] !== 'all').length
          + (filterState.d1?1:0) + (filterState.d2?1:0) + (filterState.country?1:0);
  document.getElementById('st-filter-btn').style.color = n ? '#3a7afe' : '';
  toast(n ? '已应用筛选（' + n + ' 项条件）' : '未设置筛选条件');
}

/* 名称 / SN 号 排序下拉 */
function toggleSortMenu(e){
  if (e) e.stopPropagation();
  document.getElementById('sort-menu').classList.toggle('on');
}
function closeSortMenu(){ document.getElementById('sort-menu').classList.remove('on'); }
function setSort(key, e){
  if (e) e.stopPropagation();
  devSort = key;
  document.querySelectorAll('.sort-item').forEach(el => el.classList.toggle('on', el.dataset.sort === key));
  const btn = document.getElementById('dev-sort-btn');
  if (btn && btn.firstChild && btn.firstChild.nodeType === 3) {
    btn.firstChild.nodeValue = (key === 'sn' ? 'SN 号 ' : '名称 ');
  }
  const inp = document.getElementById('dev-search');
  if (inp) { inp.placeholder = key === 'sn' ? '请输入设备SN号' : '请输入设备名称'; inp.value = ''; }
  closeSortMenu();
  renderDevices();
  toast('已按' + (key === 'sn' ? 'SN 号' : '名称') + '排序');
}
document.addEventListener('click', e => {
  const menu = document.getElementById('sort-menu');
  if (!menu || !menu.classList.contains('on')) return;
  if (!menu.contains(e.target) && !e.target.closest('#dev-sort-btn')) closeSortMenu();
});
let sugIdx = 0;
let welcomeSection = 'questions';
function renderSugs(){
  const questions = welcomeSection === 'questions';
  document.getElementById('xy-questions-tab').setAttribute('aria-pressed', String(questions));
  document.getElementById('xy-skills-tab').setAttribute('aria-pressed', String(!questions));
  document.getElementById('xy-refresh').hidden = !questions;

  const cards = questions ? sugs[sugIdx] : welcomeSkills;
  const buttons = cards.map(([icon, title, caption, query = caption]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'xy-sug';
    const symbol = document.createElement('span');
    symbol.className = 'xy-sug-icon';
    const [tone, path] = welcomeIcons[icon];
    symbol.setAttribute('data-tone', tone);
    symbol.innerHTML = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="' + path + '"/></svg>';
    symbol.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span');
    copy.className = 'xy-sug-copy';
    const name = document.createElement('strong');
    name.textContent = title;
    const hint = document.createElement('span');
    hint.textContent = caption;
    copy.append(name, hint);
    button.append(symbol, copy);
    button.addEventListener('click', () => questions ? askWelcome(query) : openChatSkill(icon));
    return button;
  });
  document.getElementById('xy-sugs').replaceChildren(...buttons);
}
function selectWelcome(section){
  welcomeSection = section;
  renderSugs();
}
function refreshSugs(){
  sugIdx = (sugIdx + 1) % sugs.length;
  renderSugs();
}
function canAskWelcome(){
  if (generating) { toast('请等待当前回答完成后再提问'); return false; }
  if (pendingImgs.length || globalThis.ProductionStrategy?.hasFile() || globalThis.MultimodalDemo?.isPreparing()) {
    toast('请先发送或移除附件，再使用快捷提问');
    return false;
  }
  const input = document.getElementById('xy-input');
  if (input.value.trim()) {
    input.focus();
    toast('输入框中还有草稿，请先发送或清空');
    return false;
  }
  return true;
}
function askWelcome(query){
  if (canAskWelcome()) askAI(query);
}
function openChatSkill(key, initial){
  if (canAskWelcome()) ChatSkillSheet.open(key, initial);
}

function appendWelcomeShortcuts(heading){
  for (const [key, title] of welcomeSkills) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'om-compact-label xy-welcome-skill';
    button.textContent = title;
    button.addEventListener('click', () => openChatSkill(key));
    heading.append(button);
  }
}

/* ---------- 小源对话 ---------- */
const AI_REPLIES = [
  { k:['你能帮我','能做什么','会什么','功能','帮我做什么'], a:
`我主要帮你处理这些事：
• 电站：发电量、收益、PR、运行状态
• 设备：在线状态、SN、版本、质保信息
• 运维：告警定位、处理建议、工单进度
• 参数：装机、容配比、储能、电价等都能在对话里直接改，说「参数」打开完整面板
• 日常：报表解读、参数说明、操作指引

直接问我就行，比如"查询昨日发电量"。` },
  { k:['发电量','发电','昨日','昨天','度数'], a:
`当前电站「123」的发电数据（演示值）：
• 昨日发电量：0.00 度
• 装机容量：0.000 kWp
• 等效利用小时：0.00 h
• 数据更新时间：2026/10/31 23:59

该电站处于「断连」状态，采集器已 3 天未上报，发电量无法统计。建议先检查通信模块供电与 4G 信号，恢复连接后我再帮你拉取完整曲线。` },
  { k:['更新','版本','新功能','最近更新'], a:
`近期更新（v6.2.0）：
1. 新增储能系统健康度自动检测
2. 告警支持按紧急 / 重要 / 次要 / 提示四色分级
3. 电站列表支持断连、故障快速筛选
4. 小源支持自然语言查询发电与告警
需要我展开某一项的具体用法吗？` },
  { k:['告警','报警','异常','故障'], a:
`当前共 18 条未处理告警：
• 紧急 0 / 重要 15 / 次要 1 / 提示 2
• 最新一条：设备网络连接异常（SA4H-NS2441362298，2026/10/19 10:39:23）

从分布看，绝大多数是「重要」级别的通信类告警，集中在电站 123 的储能设备上。建议优先排查该站点的网关链路。` },
  { k:['离线','断连','连不上','掉线'], a:
`共 10 个电站处于断连，设备侧有 4 台离线：
• ESS-liluxin_test_3 / ESS-thingjs liko_2 / ESS-thingjs liko_3
• INV-invertertestjp

排查顺序建议：① 采集器指示灯状态 → ② 现场网络（4G/WiFi/有线）→ ③ 设备 SN 是否被重复绑定 → ④ 重启采集器后等待 5 分钟自动重连。` },
  { k:['储能','电池','健康','soc'], a:
`储能系统概况：
• 在线 ESS：3 台，当前均为离线
• 电池健康检测：1 条超时告警（102326852971）
• 版本一致性：存在版本不一致告警，建议统一升级到最新固件

需要我把这 3 台 ESS 的版本明细列出来吗？` },
  { k:['电站','站点','几个电站'], a:
`账号 testComp8 下共 13 个电站：
• 正常 3 个（容量费、无业主电站升级、演示电站-华东）
• 断连 10 个
• 故障 0 个

其中只有「演示电站-华东」有有效装机（12.600 kWp），其余多为测试站点。要切到某个电站看明细吗？` },
  { k:['收益','收入','电价','赚'], a:
`收益估算（演示电站-华东，按 0.42 元/度）：
• 昨日收益：约 16.18 元
• 本月累计：约 486.5 元
• 度电成本回收进度：12.4%

测试电站装机为 0，暂无收益数据。` },
  { k:['效率','pr','弃光','损耗'], a:
`系统效率指标：
• 系统 PR：81.6%（行业参考 80%–85%）
• 逆变器加权效率：97.9%
• 今日暂无弃光记录

PR 低于 78% 时建议检查组件积灰与组串失配。` },
  { k:['天气','辐照','日照'], a:
`电站 123 所在地（西安雁塔区）今日：
• 天气：多云转晴，气温 12–21℃
• 峰值辐照：约 640 W/m²
• 预计发电较晴天下降 8%–12%

不过该站当前断连，实际数据无法回传。` }
];
const FALLBACK = [
`我理解你想了解「{q}」。目前仿真环境里我能回答电站、设备、告警、储能、收益这几类问题，你可以换个说法，或者点首页的推荐问题试试。`,
`这个方向我暂时没有对应数据。要不先看看这几项：昨日发电量、储能健康状态、当前告警分布？`,
`收到。当前电站「123」处于断连状态，很多实时指标拿不到——我可以先帮你梳理离线设备的排查路径，需要吗？`
];
let fbIdx = 0;
function replyFor(q){
  const s = q.toLowerCase();
  const hit = AI_REPLIES.find(r => r.k.some(k => s.includes(k.toLowerCase())));
  if (hit) return hit.a;
  return FALLBACK[fbIdx++ % FALLBACK.length].replace('{q}', q);
}
function addMsg(role, text, pending){
  const chat = document.getElementById('xy-chat');
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  el.innerHTML = '<div class="bubble"></div>';
  const b = el.querySelector('.bubble');
  if (pending) { b.classList.add('typing'); b.innerHTML = '<i></i><i></i><i></i>'; }
  else if (text) { if (role === 'ai') renderChatMarkdown(b, text); else b.textContent = text; }
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}
function addMsgHTML(role, html){
  const chat = document.getElementById('xy-chat');
  const el = document.createElement('div');
  el.className = 'msg ' + role;
  el.innerHTML = '<div class="bubble"></div>';
  el.querySelector('.bubble').innerHTML = html;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}
function setBubbleText(el, text){
  const chat = document.getElementById('xy-chat');
  const follow = isNearChatEnd(chat);
  const b = el.querySelector('.bubble');
  if (b.classList.contains('typing')) { b.classList.remove('typing'); b.innerHTML = ''; }
  if (el.classList.contains('ai')) renderChatMarkdown(b, text);
  else b.textContent = text;
  if (follow) chat.scrollTop = chat.scrollHeight;
}
function isNearChatEnd(chat){
  return chat.scrollHeight - chat.clientHeight - chat.scrollTop <= 40;
}
function showAnswerTime(row, started){
  if (!row?.isConnected || !row.classList.contains('ai')) return;
  const seconds = (performance.now() - started) / 1000;
  const duration = seconds < 1 ? (seconds < 0.1 ? '不足0.1秒' : seconds.toFixed(1) + '秒') : Math.round(seconds) + '秒';
  const status = document.createElement('details');
  status.className = 'xy-answer-status';
  status.innerHTML = '<summary><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/></svg><span>回答完成（用时' + duration + '）</span></summary>' +
    '<div class="xy-answer-detail">从收到提问到回答完成的总时长</div>';
  const chat = row.parentElement;
  const follow = isNearChatEnd(chat);
  row.classList.add('xy-timed-answer');
  const existing = row.querySelector(':scope > .xy-answer-status');
  if (existing) existing.replaceWith(status);
  else row.prepend(status);
  if (follow) chat.scrollTop = chat.scrollHeight;
}
function timeLocalAnswer(answer, started){
  const chat = document.getElementById('xy-chat');
  const previous = chat.lastElementChild;
  const handled = answer();
  if (chat.lastElementChild !== previous) showAnswerTime(chat.lastElementChild, started);
  return handled;
}
function showTyping(){
  const chat = document.getElementById('xy-chat');
  const el = document.createElement('div');
  el.className = 'msg ai'; el.id = 'typing-row';
  el.innerHTML = '<div class="bubble typing"><i></i><i></i><i></i></div>';
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

/* ---------- 小源球（玻璃质感 SVG，色块旋转） ---------- */
function xyBallSVG(uid){
  const i = function(n){ return n + '-' + uid; };
  return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    + '<defs>'
    +   '<radialGradient id="' + i('core') + '" cx="38%" cy="30%" r="80%">'
    +     '<stop offset="0%" stop-color="#93bdff"/><stop offset="34%" stop-color="#3b63e6"/>'
    +     '<stop offset="68%" stop-color="#141f57"/><stop offset="100%" stop-color="#070b1e"/>'
    +   '</radialGradient>'
    +   '<linearGradient id="' + i('purple') + '" x1="0" y1="0" x2="1" y2="1">'
    +     '<stop offset="0%" stop-color="#a878ff"/><stop offset="100%" stop-color="#5a2ed8"/>'
    +   '</linearGradient>'
    +   '<linearGradient id="' + i('teal') + '" x1="0" y1="0" x2="1" y2="1">'
    +     '<stop offset="0%" stop-color="#46eed0"/><stop offset="100%" stop-color="#0b9e85"/>'
    +   '</linearGradient>'
    +   '<linearGradient id="' + i('orange') + '" x1="0" y1="0" x2="0" y2="1">'
    +     '<stop offset="0%" stop-color="#ffc356"/><stop offset="100%" stop-color="#ef7d1c"/>'
    +   '</linearGradient>'
    +   '<radialGradient id="' + i('gloss') + '" cx="50%" cy="50%" r="50%">'
    +     '<stop offset="0%" stop-color="rgba(255,255,255,.95)"/><stop offset="60%" stop-color="rgba(255,255,255,.35)"/><stop offset="100%" stop-color="rgba(255,255,255,0)"/>'
    +   '</radialGradient>'
    +   '<filter id="' + i('soft') + '" x="-40%" y="-40%" width="180%" height="180%">'
    +     '<feGaussianBlur stdDeviation="3.2"/>'
    +   '</filter>'
    +   '<filter id="' + i('softer') + '" x="-40%" y="-40%" width="180%" height="180%">'
    +     '<feGaussianBlur stdDeviation="1.6"/>'
    +   '</filter>'
    +   '<clipPath id="' + i('clip') + '"><circle cx="50" cy="50" r="34"/></clipPath>'
    + '</defs>'
    + '<circle cx="50" cy="50" r="49" fill="rgba(255,255,255,.05)"/>'
    + '<g clip-path="url(#' + i('clip') + ')">'
    +   '<circle cx="50" cy="50" r="34" fill="url(#' + i('core') + ')"/>'
    +   '<g class="xy-spin">'
    +     '<ellipse cx="63" cy="29" rx="19" ry="13" fill="url(#' + i('purple') + ')" filter="url(#' + i('soft') + ')" opacity=".95"/>'
    +     '<path d="M31 59 a 24 24 0 0 0 17 16" stroke="url(#' + i('teal') + ')" stroke-width="7.5" stroke-linecap="round" fill="none" filter="url(#' + i('softer') + ')"/>'
    +     '<ellipse cx="72" cy="60" rx="10" ry="14" fill="url(#' + i('orange') + ')" filter="url(#' + i('soft') + ')" opacity=".92"/>'
    +     '<ellipse cx="66" cy="72" rx="7" ry="5" fill="#ffd76b" filter="url(#' + i('softer') + ')" opacity=".9"/>'
    +   '</g>'
    + '</g>'
    + '<ellipse cx="37" cy="27" rx="17" ry="9.5" fill="url(#' + i('gloss') + ')" opacity=".75" transform="rotate(-26 37 27)"/>'
    + '<circle cx="70" cy="20" r="3.2" fill="rgba(255,255,255,.65)" filter="url(#' + i('softer') + ')"/>'
    + '<path d="M17 63 a 37 37 0 0 0 26 25" stroke="rgba(255,255,255,.28)" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".55"/>'
    + '<circle cx="50" cy="50" r="48.6" fill="none" stroke="rgba(255,255,255,.30)" stroke-width="1.5"/>'
    + '</svg>';
}
(function(){
  document.querySelectorAll('[data-xyart]').forEach(function(el, idx){
    el.innerHTML = xyBallSVG(idx);
  });
})();

/* ---------- 小源提问范围 ---------- */
function openScope(){
  renderScopeList();
  document.getElementById('sc-mask').classList.add('on');
  document.getElementById('scope-sheet').classList.add('on');
}
function closeScope(){
  document.getElementById('sc-mask').classList.remove('on');
  document.getElementById('scope-sheet').classList.remove('on');
}
function renderScopeList(){
  const check = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a7afe" stroke-width="2.6"><path d="m5 12.5 4.5 4.5L19 6.5"/></svg>';
  const rows = ['<div class="scope-row' + (xyScope === 'all' ? ' on' : '') + '" onclick="pickScope(\'all\')">' +
    '<span class="sn">全部电站（' + stations.length + '）</span>' +
    '<span class="tick">' + (xyScope === 'all' ? check : '') + '</span></div>'];
  stations.forEach(function(st){
    rows.push('<div class="scope-row' + (xyScope === st.name ? ' on' : '') + '" onclick="pickScope(\'' + st.name + '\')">' +
      '<span class="sn">' + st.name + '</span>' +
      '<span class="ss ' + (st.status === 'ok' ? 'ok' : 'off') + '">' + (st.status === 'ok' ? '正常' : '断连') + '</span>' +
      '<span class="tick">' + (xyScope === st.name ? check : '') + '</span></div>');
  });
  document.getElementById('scope-list').innerHTML = rows.join('');
}
function pickScope(name){
  xyScope = name;
  closeScope();
  updateScopeChip();
  toast(name === 'all' ? '小源将回答整个账号（' + stations.length + ' 个电站）' : '小源提问范围已限定为「' + name + '」');
}
function updateScopeChip(){
  const el = document.getElementById('xy-scope-name');
  if (el) el.textContent = xyScope === 'all' ? '全部电站' : xyScope;
}

/* ---------- 小源：账号数据上下文 ---------- */
let xyScope = 'all';                       /* 'all' 或电站名：小源提问范围 */
const LV_NAME = { crit:'紧急', imp:'重要', minor:'次要', hint:'提示' };
const TAB_NAME = { home:'首页', ops:'运维', dev:'设备', svc:'服务', me:'我的' };

function fmtStation(s, i){
  return (i + 1) + '. ' + s.name +
    '｜' + (s.status === 'ok' ? '正常' : (s.status === 'fault' ? '故障' : '断连')) +
    '｜' + s.type +
    '｜装机 ' + s.cap + ' kWp' +
    '｜当日发电 ' + s.day +
    '｜累计发电 ' + (s.total || '未统计') +
    '｜并网 ' + s.date +
    '｜当地时间 ' + stationLocalText(s) +
    '｜' + s.country +
    '｜' + s.addr +
    '｜配置 ' + ((s.cfg && s.cfg.length) ? s.cfg.join('/') : '无');
}

function dataContext(){
  const okN = stations.filter(x => x.status === 'ok').length;
  const offN = stations.filter(x => x.status === 'off').length;
  const faultN = stations.filter(x => x.status === 'fault').length;
  const capSum = stations.reduce((a, x) => a + (x.cap || 0), 0);
  const c = { crit:0, imp:0, minor:0, hint:0 };
  alarms.forEach(a => { if (c[a.lv] != null) c[a.lv]++; });

  const L = [];
  L.push('【账号】' + ACCOUNT.name + '（' + ACCOUNT.role + '，企业 ' + ACCOUNT.org + '，绑定手机 ' + ACCOUNT.phone + '）');
  L.push('【资产概览】共 ' + stations.length + ' 个电站：正常 ' + okN + ' / 故障 ' + faultN + ' / 断连 ' + offN +
         '；总装机 ' + capSum.toFixed(1) + ' kWp（约 ' + (capSum / 1000).toFixed(2) + ' MWp）');
  L.push('【当前时间】（' + (SIMSTATE ? '仿真台实时时钟' : '本机时间') + '）北京时间 ' + localOf('Asia/Shanghai', nowUtc()).dateText + '（UTC+08:00）；' +
         '各电站当地时间：' + stations.map(s => s.name + ' ' + stationLocalText(s)).join('；') +
         '。凡涉及"几点 / 日期 / 今天哪天 / 时区 / 时差"的问题，一律以上面这组时间为准，不得使用你自身的日期或猜测。');
  L.push('【电站清单】格式：序号.名称｜状态｜类型｜装机｜当日发电｜累计发电｜并网日期｜当地时间｜国家｜地址｜配置');
  L.push(stations.map(fmtStation).join('\n'));
  L.push('【告警】未处理 ' + alarms.length + ' 条：紧急 ' + c.crit + ' / 重要 ' + c.imp + ' / 次要 ' + c.minor + ' / 提示 ' + c.hint + '。明细（新→旧）：');
  L.push(alarms.map((a, i) => (i + 1) + '. ' + a.title + '｜' + (LV_NAME[a.lv] || a.lv) + '｜设备 ' + a.dev + '｜电站 ' + a.st + '｜' + a.t).join('\n'));
  L.push('【设备】共 ' + devices.length + ' 台：' +
         devices.map(d => d.name + '（' + d.type + '，SN ' + d.sn + '，所属 ' + d.st + '，' + (d.status === 'ok' ? '在线' : '离线') + (d.sub ? '，含下挂设备' : '') + '）').join('；'));
  L.push('【统计指标】当前功率 ' + STAT.power + '；当日发电量 ' + STAT.day + '；当日收益 ' + STAT.revenue +
         '；累计发电量 ' + STAT.total + '；社会贡献：节约标准煤 ' + STAT.coal + '、CO₂减排 ' + STAT.co2 + '、等效植树 ' + STAT.trees +
         '；数据更新 ' + STAT.updated);
  L.push('【当日电站排名】' + RANKS.map((r, i) => (i + 1) + '. ' + r.name + ' ' + r.v + ' kWh/kWp').join('；'));
  if (typeof PLANTS !== 'undefined' && PLANTS.length) {
    L.push('【仿真电站·实时数据】共 ' + PLANTS.length + ' 座（各站按所在国家当地实时时间运行）：\n' +
      PLANTS.map(p =>
        '· ' + p.name + '（' + p.country + ' ' + p.city + '，当地时间 ' + (p.local ? p.local.dateText + ' ' + (p.local.tzLabel || '') : '') + '）：' +
        (p.type === 'res' ? '户用' : '工商业') + '电站，商业模式「' + (p.mode === 'self' ? '全自发自用' : '自发自用余电上网') + '」，' +
        '电价：上网 ' + p.tariff.sym + p.tariff.fit + ' / 买电 ' + p.tariff.sym + p.tariff.retail + ' 每 kWh（' + p.tariff.cur + '）；' +
        '光伏装机 ' + p.cfg.pvKwp + ' kWp（逆变器 ' + p.invKw + ' kW，容配比 ' + p.ratio + '）/ 储能 ' + p.cfg.batKwh + ' kWh（' + p.batKw + ' kW × ' + p.batHours + ' h）/ 负载峰值 ' + p.cfg.loadPeak + ' kW；' +
        '逆变器温度 ' + (Number.isFinite(p.invTemp) ? p.invTemp.toFixed(1) + ' ℃' : '暂无数据') + (p.inverterThermal?.mode === 'rising' ? '（渐升温演练，模拟数据）' : '（模拟数据）') + '；实时 光伏 ' + p.pv.toFixed(1) + ' kW、负载 ' + p.load.toFixed(1) + ' kW、储能' + (p.bat >= 0 ? '放电 ' : '充电 ') +
        Math.abs(p.bat).toFixed(1) + ' kW（SOC ' + p.soc.toFixed(0) + '%）、电网' + (p.grid >= 0 ? '取电 ' : '上网 ') +
        Math.abs(p.grid).toFixed(1) + ' kW；今日发电 ' + p.dayPv.toFixed(1) + ' kWh、用电 ' + p.dayLoad.toFixed(1) +
        ' kWh、电网取电 ' + p.dayImp.toFixed(1) + ' kWh、上网 ' + p.dayExp.toFixed(1) + ' kWh、今日收益 ' + p.tariff.sym + (p.dayRev || 0).toFixed(2) +
        '；储能 SOC 工作区间 ' + (p.socMin != null ? p.socMin : 10) + '%–' + (p.socMax != null ? p.socMax : 98) + '%' +
        (p.start ? '；运行开始 ' + p.start.mo + ' 月 ' + p.start.dd + ' 日 ' + String(p.start.hh).padStart(2, '0') + ':00（当地时间）' : '') +
        (p.loadFromFile ? '（负载使用上传的实测曲线）' : '') +
        (p.gridOut ? '；并网点停电，正在离网运行' : '')
      ).join('\n'));
  }
  if (globalThis.SolarHistory?.datasets?.length) {
    L.push('【历史时段模型仿真】以下为按设备配置、模型天气和5分钟积分生成的历史回算，非真实历史电表或气象数据；按真实日历截至补跑截止时间，不受当前加速时钟影响。窗口首月和本月可能不覆盖整月，今天仅累计至截止时间，必须以每条的覆盖日期为准。功率单位kW，发电量单位kWh，不可混淆。');
    for (const d of SolarHistory.datasets) L.push(`${d.plantName}｜${d.month}｜覆盖 ${d.daily?.[0]?.date || ''} 至 ${d.daily?.at(-1)?.date || ''}，${d.days}天${d.completeMonth ? '（整月）' : '（部分月份）'}｜发电量 ${d.totals.dayPv.toFixed(2)} kWh｜用电量 ${d.totals.dayLoad.toFixed(2)} kWh｜电网取电 ${d.totals.dayImp.toFixed(2)} kWh｜余电上网 ${d.totals.dayExp.toFixed(2)} kWh｜储能充电 ${d.totals.dayChg.toFixed(2)} kWh / 放电 ${d.totals.dayDis.toFixed(2)} kWh｜收益 ${d.totals.dayRev.toFixed(2)}（当地货币）。`);
  }
  return L.join('\n');
}

/* 当前 App 页面 / 筛选状态：让"这些电站"这类指代有落点 */
function viewContext(){
  const parts = [];
  let tab = TAB_NAME[curTab] || '首页';
  if (curTab === 'home') {
    const st = document.getElementById('home-stat');
    tab += (st && st.style.display !== 'none') ? '（统计视图）' : '（电站列表）';
  }
  parts.push('当前页：' + tab);

  const cond = [];
  if (stFilter === 'ok') cond.push('状态=仅正常');
  else if (stFilter === 'off') cond.push('状态=仅断连');
  else if (stFilter === 'fault') cond.push('状态=仅故障');
  if (chosen.size) cond.push('已选电站=' + Array.from(chosen).join('/'));
  const si = document.getElementById('st-search');
  if (si && si.value.trim()) cond.push('搜索词=' + si.value.trim());
  const F = filterState;
  if (F.type !== 'all') cond.push('类型=' + F.type);
  if (F.cap !== 'all') cond.push('容量区间=' + F.cap + ' kWp');
  if (F.cfg !== 'all') cond.push('配置=' + F.cfg);
  if (F.d1 || F.d2) cond.push('并网时间=' + (F.d1 || '不限') + '~' + (F.d2 || '不限'));
  if (F.country) cond.push('国家地区=' + F.country);
  parts.push('当前筛选：' + (cond.length ? cond.join('；') : '无（显示全部）'));

  const vis = visibleStations().map(o => o.s.name);
  parts.push('列表当前可见 ' + vis.length + ' 个电站：' + (vis.length ? vis.join('/') : '无'));
  if (curTab === 'ops') {
    const oi = document.getElementById('op-search');
    if (oi && oi.value.trim()) parts.push('运维页搜索词=' + oi.value.trim());
  }
  parts.push('小源提问范围：' + (xyScope === 'all' ? '全部电站' : xyScope));
  return parts.join('\n');
}

/* 问题里命中的电站（用于精准投喂完整字段） */
function matchStations(q){
  const text = String(q || '').toLowerCase();
  const hits = [];
  stations.forEach(st => {
    const n = st.name.toLowerCase();
    if (/^\d+$/.test(n) && n.length < 4) return;      /* 纯数字短名容易误命中 */
    if (n.length >= 2 && text.indexOf(n) >= 0) hits.push(st);
  });
  if (!hits.length) {
    stations.forEach(st => {
      const core = st.name.replace(/(电站|主站|站)$/g, '').toLowerCase();
      if (core.length >= 3 && text.indexOf(core) >= 0 && hits.indexOf(st) < 0) hits.push(st);
    });
  }
  if (!hits.length && /(^|[^\d])123\s*(电站|站)/.test(q)) {
    const t = stations.find(x => x.name === '123');
    if (t) hits.push(t);
  }
  return hits.slice(0, 4);
}

const ANSWER_RULES = [
  '回答要求：',
  '1. 可回答本账号的任何数据查询：电站清单与明细、装机容量、发电量、收益、告警、设备、排名、社会贡献，以及 App 各页面功能怎么用；无关话题一句话礼貌拉回光储场景。',
  '2. 所有数字必须来自上面的数据，不得推测或编造。数据里没给合计的（例如各电站当日发电量清单），就说明"未提供合计"，不要自己加总。',
  '3. 用户说「这些电站」「当前列表」「我筛选出来的」时，以【App 当前状态】里"列表当前可见"的电站为准；只问某电站时优先用【用户问题指向的电站】的字段。',
  '4. 列清单要列全，不要用"等"省略；数量多时可用「、」分隔成一行。',
  '5. 提到电站时用「」包住并带上状态，例如「容量费」（正常）。',
  '6. 首句直接回答问题，可加粗最关键的数值及单位。简单问题用一小段；需要说明多项时用 Markdown 列表或表格，避免重复结论。',
  '7. 不编造设备型号、告警编号、补贴政策或收益承诺。',
  '8. 时间、日期、时区类问题必须用【当前时间】与电站字段里的「当地时间」，并按该站所在国家标注时区（如 UTC+08:00）；用户问与北京时间差多少，就按时区偏移算差值。严禁使用你自身的系统日期、训练数据里的日期或任何猜测。',
  '9. 用户想调整储能 SOC 区间时，直接告诉他可以在对话里的「储能 SOC 工作区间」标签框中拖动保存，并复述当前区间；不要声称自己无法修改。'
].join('\n');

function buildSystem(q){
  const seg = [];
  seg.push('你是「华为小源」，FusionSolar 光储监控 App 内的智能助手，服务对象是当前账号的电站业主与运维人员。');
  seg.push('以下是当前登录账号的实时数据，是你回答的唯一事实依据：\n' + dataContext());
  seg.push('【App 当前状态】\n' + viewContext());

  const hit = matchStations(q);
  if (hit.length) {
    seg.push('【用户问题指向的电站·完整字段】\n' + hit.map(st => '· ' + fmtStation(st, stations.indexOf(st))).join('\n'));
  } else if (xyScope !== 'all') {
    const t = stations.find(x => x.name === xyScope);
    if (t) seg.push('【本次提问范围】用户已把小源的范围限定在「' + t.name + '」，问题未指名其他电站时优先针对它：\n· ' + fmtStation(t, stations.indexOf(t)));
  }
  seg.push(answerRules(curLang));
  return seg.join('\n\n');
}

/* ---------- 语言：用户用什么语言问，就用什么语言答 ---------- */
const LANG_NAME = {
  zh: { zh: '简体中文', code: 'zh-CN' },
  en: { zh: 'English（英语）', code: 'en-US' },
  ja: { zh: '日本語（日语）', code: 'ja-JP' },
  ko: { zh: '한국어（韩语）', code: 'ko-KR' },
  ru: { zh: 'Русский（俄语）', code: 'ru-RU' },
  es: { zh: 'Español（西班牙语）', code: 'es-ES' },
  ar: { zh: 'العربية（阿拉伯语）', code: 'ar-SA' },
  de: { zh: 'Deutsch（德语）', code: 'de-DE' },
  fr: { zh: 'Français（法语）', code: 'fr-FR' },
  pt: { zh: 'Português（葡萄牙语）', code: 'pt-PT' }
};
function detectLang(t){
  const s = String(t || '');
  if (/[\u3040-\u30ff]/.test(s)) return 'ja';
  if (/[\uac00-\ud7af]/.test(s)) return 'ko';
  if (/[\u4e00-\u9fff]/.test(s)) return 'zh';
  if (/[\u0400-\u04ff]/.test(s)) return 'ru';
  if (/[\u0600-\u06ff]/.test(s)) return 'ar';
  if (/[a-zA-Z]/.test(s)) {
    if (/\b(der|die|das|und|nicht|wie|ist|kann)\b/i.test(s)) return 'de';
    if (/\b(quel|quelle|les|pour|combien|est-ce)\b/i.test(s)) return 'fr';
    if (/\b(qual|quanto|está|não|você)\b/i.test(s)) return 'pt';
    return 'en';
  }
  return curLang || 'zh';
}
let curLang = 'zh';
/* 小工具：确定性文案的中英文切换（其他语言统一用英文兜底） */
function T(zh, en){ return curLang === 'zh' ? zh : en; }
function langLabel(l){ return (LANG_NAME[l] || LANG_NAME.zh).zh; }

function answerRules(lang){
  const arr = ANSWER_RULES.split('\n');
  arr.push('10. 【强制】用户本次提问使用的语言是' + langLabel(lang) +
    '，你的回答必须完整使用该语言，不得翻译成其他语言；电站名称、设备型号、数字与单位保持原样。');
  return arr.join('\n');
}

function buildMessages(q, imgs){
  const hist = convo.history.slice(-8).map(m => ({ role: m.role, content: m.content }));
  let content = q;
  if (imgs && imgs.length) {
    content = [{ type: 'text', text: q || '请看看这张图片。' }]
      .concat(imgs.map(u => ({ type: 'image_url', image_url: { url: u } })));
  }
  /* 图片问答使用紧凑上下文，减少无关信息和输入开销。 */
  const sys = (imgs && imgs.length) ? buildSystemCompact(q) : buildSystem(q);
  return [{ role: 'system', content: sys }, ...hist, { role: 'user', content: content }];
}

/* 紧凑版系统提示：只保留账号摘要 + 电站清单（简）+ 状态 + 回答规则，控制在 1500 字符内 */
function buildSystemCompact(q){
  const seg = [];
  seg.push('你是「华为小源」，FusionSolar 光储监控 App 内的智能助手，服务对象是当前账号的电站业主与运维人员。用户随消息附带了图片，请直接看图并回答。');
  const dc = dataContext().split('\n');
  seg.push('【账号实时数据摘要】\n' + dc.slice(0, 3).join('\n'));
  seg.push('【电站清单（简）】' + stations.map(s => s.name + '(' + (s.status === 'ok' ? '正常' : s.status === 'fault' ? '故障' : '断连') + ')').join('、'));
  seg.push('【App 当前状态】\n' + viewContext());
  seg.push(answerRules(curLang));
  return seg.join('\n\n');
}

function setGenerating(on){
  generating = on;
  const btn = document.getElementById('xy-send');
  if (!btn) return;
  btn.innerHTML = on
    ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2.5"/></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>';
  updateSendTint();
  btn.title = on ? '停止生成' : '发送';
  btn.setAttribute('aria-label', btn.title);
}
async function askLLM(q, imgs){
  const started = performance.now();
  const hasImg = !!(imgs && imgs.length);
  if (!hasImg && q.trim()==='转到人工客服') { globalThis.HumanSupportDemo?.handle(q,imgs); return; }
  if (!hasImg && globalThis.AfterSales?.handle(q)) return;
  if (!hasImg && globalThis.SimpleDesign?.handle(q)) return;
  if (!hasImg && globalThis.CustomSkills?.handle(q)) return;
  if (!hasImg && timeLocalAnswer(() => globalThis.TaskFollowDemo?.handle(q), started)) return;
  if (!hasImg && timeLocalAnswer(() => globalThis.DeviceParameterDemo?.handle(q), started)) return;
  if (!hasImg && confirmBillTariff(q, started)) return;
  if (!hasImg && /排产计划/.test(q) && /光储策略|充放电策略/.test(q)) {
    showAnswerTime(addMsg('ai','请点「＋」→「上传文件（Excel）」，选择排产计划后再发送这句话。收到文件后我会测算每日充放电策略。'), started);
    return;
  }
  if (hasImg) pendingBillTariff = null;
  if (!hasImg && handlePlantChart(q, started)) return;
  if(globalThis.HumanSupportDemo?.handle(q,imgs)) return;
  if(!hasImg && globalThis.HealthDemo?.handle(q)) return;
  if(globalThis.MultimodalDemo?.handle(q,imgs)) return;
  if(!hasImg && timeLocalAnswer(() => globalThis.StrategyDemo?.handle(q), started)) return;
  if(!hasImg && timeLocalAnswer(() => globalThis.SubscriptionDemo?.handle(q), started)) return;
  const changeIntent=/(改成|改为|设为|设置为|设定|调到|调整|修改|更改|保存|停机|关机|开机|启动电站|恢复运行|参数面板|设置面板|打开参数)/i.test(q);
  const liveChart=/(实时|当前).*(功率|出力).*(曲线|趋势图|图表)/.test(q)&&!/(历史|昨天|前天|上周|上月|温度|收益|\d{4}-\d{2})/.test(q);
  if(!hasImg && !changeIntent && !liveChart) return askModel(q,imgs);
  /* SOC 区间：直接在对话里给可操作的标签框，改完写回仿真台 */
  if (!hasImg && isSocQuestion(q)) {
    const typing = showTyping();
    setTimeout(function(){
      if (!typing.isConnected) return;
      typing.remove();
      const st = socTargetPlant(q);
      const en = curLang !== 'zh';
      const ans = st
        ? (en
            ? st.name + ' battery: current SOC ' + Math.round(st.soc) + '%, working window ' +
              (st.socMin != null ? st.socMin : 10) + '% – ' + (st.socMax != null ? st.socMax : 98) +
              '%.\nDrag the sliders below to change it — the simulator applies the new window right after you save:'
            : '「' + st.name + '」储能当前 SOC ' + Math.round(st.soc) + '%，工作区间 ' +
              (st.socMin != null ? st.socMin : 10) + '% – ' + (st.socMax != null ? st.socMax : 98) + '%。\n可以直接在下面拖动修改，保存后仿真台立即按新区间调度：')
        : (en
            ? 'No plant is connected to the simulator, so the SOC window cannot be changed. Open simulator.html in the same browser and try again.'
            : '当前没有连上仿真台的电站，无法修改 SOC 区间。请在同一个浏览器里打开 simulator.html 后再试。');
      timeLocalAnswer(() => {
        if (st) showSocCard(q, ans);
        else addMsg('ai', ans);
      }, started);
    }, 380);
    return;
  }
  /* 参数面板：所有可设置参数都能在对话里直接改（自然语言或拖动面板） */
  if (!hasImg && isParamQuestion(q)) {
    const typing = showTyping();
    setTimeout(function(){
      if (!typing.isConnected) return;
      typing.remove();
      timeLocalAnswer(() => handleParamAsk(q), started);
    }, 360);
    return;
  }
  /* 功率曲线：直接在对话里给一张会实时刷新的曲线卡 */
  if (!hasImg && isPowerCurveQuestion(q) && PLANTS.length) {
    const typing = showTyping();
    setTimeout(function(){
      if (!typing.isConnected) return;
      typing.remove();
      timeLocalAnswer(() => showPowerCurveCard(q), started);
    }, 360);
    return;
  }
  /* 时间/日期类问题：直接用仿真台时钟算，不走模型，保证和页面显示一致 */
  if (!hasImg && isTimeQuestion(q)) {
    const typing = showTyping();
    const ans = timeAnswer(q);
    setTimeout(function(){
      if (!typing.isConnected) return;
      typing.remove();
      showAnswerTime(addMsg('ai', ans), started);
      convo.history.push({ role: 'user', content: q }, { role: 'assistant', content: ans });
    }, 360);
    return;
  }
  return askModel(q, imgs);
}
function sendRetry(q, imgs){
  document.getElementById('xy-chat').classList.add('on');
  askLLM(q, imgs);
}
function sendMsg(){
  if(globalThis.MultimodalDemo?.isPreparing()){toast('正在读取照片或视频，请稍候再发送');return;}
  if (generating) { if (abortCtl) abortCtl.abort(); return; }
  const inp = document.getElementById('xy-input');
  const q = inp.value.trim();
  const production = globalThis.ProductionStrategy;
  const hasPlan = production?.hasFile();
  if (hasPlan && pendingImgs.length) { toast('请将排产 Excel 与照片或视频分开发送'); return; }
  if (!q && !pendingImgs.length && !hasPlan) { toast(T('请先输入问题', 'Please type a question first')); inp.focus(); return; }
  const imgs = pendingImgs.slice();
  inp.value = '';
  pendingImgs = []; renderAttach();
  inp.style.height = 'auto';
  document.getElementById('xy-intro').classList.add('hide');
  document.getElementById('xy-chat').classList.add('on');
  curLang = detectLang(q || '');
  if (!hasPlan && !imgs.length && q) globalThis.OwnerMemory?.record(q);
  if (hasPlan) { production.send(q); return; }
  if (imgs.length) {
    if(globalThis.MultimodalDemo?.renderUserMedia)MultimodalDemo.renderUserMedia(imgs,q);
    else addMsgHTML('user', '<div class="bubble-imgs">' + imgs.map(u => '<img src="' + u + '">').join('') + '</div>' + (q ? esc(q) : ''));
  } else {
    addMsg('user', q);
  }
  lastAsk = q || '（图片）';
  askLLM(q, imgs);
}
function askAI(q){
  document.getElementById('xy-input').value = q;
  sendMsg();
}
function newChat(){
  resetChat();
  toast('已开始新对话');
}
function resetChat(){
  globalThis.ChatHistory?.save();
  globalThis.AfterSales?.reset();
  globalThis.ProductionStrategy?.clear();
  pendingBillTariff = null;
  if (abortCtl) { abortCtl.abort(); }
  globalThis.MultimodalDemo?.clearMedia();
  globalThis.HumanSupportDemo?.reset();
  convoId = newConvoId();
  abortCtl = null;
  setGenerating(false);
  convo.history = [];
  lastAsk = '';
  document.getElementById('xy-chat').innerHTML = '';
  document.getElementById('xy-chat').classList.remove('on');
  document.getElementById('xy-intro').classList.remove('hide');
  document.getElementById('xy-intro').scrollTop = 0;
  globalThis.OwnerMemory?.newSession();
  selectWelcome('questions');
}
/* ---------- 交互 ---------- */
let curTab = 'home';
function go(p){
  curTab = p;
  document.querySelectorAll('.page').forEach(el=>el.classList.remove('active'));
  document.getElementById('page-'+p).classList.add('active');
  document.querySelectorAll('.tab').forEach(t=>{
    const on = t.dataset.p===p;
    t.classList.toggle('active',on);
    t.querySelector('svg').style.color = on ? '#3a7afe' : '#8e8e93';
  });
}
/* ---------- 悬浮小源球：全页面常驻 + 手机框内拖拽 ---------- */
(function(){
  const ball = document.getElementById('xy-ball');
  const screenEl = document.querySelector('.screen');
  if (!ball || !screenEl) return;
  const SIZE = 56, PAD = 6, TOP_LIMIT = 58, BOTTOM_RESERVE = 92;
  let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;

  function scaleFactor(){
    const r = screenEl.getBoundingClientRect();
    return (r.width / screenEl.offsetWidth) || 1;
  }
  function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }

  ball.addEventListener('pointerdown', ev => {
    if (ev.button != null && ev.button !== 0) return;
    dragging = true; moved = false;
    sx = ev.clientX; sy = ev.clientY;
    ox = ball.offsetLeft;
    oy = ball.offsetTop;
    try { ball.setPointerCapture(ev.pointerId); } catch(e){}
  });

  ball.addEventListener('pointermove', ev => {
    if (!dragging) return;
    const k = scaleFactor();
    const dx = (ev.clientX - sx) / k;
    const dy = (ev.clientY - sy) / k;
    if (!moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
    moved = true;
    const r = screenEl.getBoundingClientRect();
    const w = r.width / k, h = r.height / k;
    ball.style.left = clamp(ox + dx, PAD, w - SIZE - PAD) + 'px';
    ball.style.top  = clamp(oy + dy, TOP_LIMIT, h - SIZE - BOTTOM_RESERVE) + 'px';
  });

  function finish(ev){
    if (!dragging) return;
    dragging = false;
    try { ball.releasePointerCapture(ev.pointerId); } catch(e){}
    if (!moved && !globalThis.SolarReminders?.openContext()) openXY();
  }
  ball.addEventListener('pointerup', finish);
  ball.addEventListener('pointercancel', ev => {
    dragging = false;
    try { ball.releasePointerCapture(ev.pointerId); } catch(e){}
  });
  window.addEventListener('resize', () => {
    requestAnimationFrame(() => {
      if (ball.style.left) ball.style.left = clamp(parseFloat(ball.style.left), PAD, screenEl.clientWidth - SIZE - PAD) + 'px';
      if (ball.style.top) ball.style.top = clamp(parseFloat(ball.style.top), TOP_LIMIT, screenEl.clientHeight - SIZE - BOTTOM_RESERVE) + 'px';
    });
  });
})();
document.querySelectorAll('.chip').forEach(c=>{
  c.addEventListener('click',()=>{
    document.querySelectorAll('.chip').forEach(x=>x.classList.remove('on'));
    c.classList.add('on');
    renderStations(c.dataset.f);
  });
});
function openXY({scrollToEnd=true}={}){
  document.getElementById('xiaoyuan').classList.add('open');
  globalThis.OwnerMemory?.render();
  const chat = document.getElementById('xy-chat');
  if(scrollToEnd)setTimeout(()=>{ chat.scrollTop = chat.scrollHeight; }, 30);
  if (window.matchMedia('(pointer: fine)').matches) {
    setTimeout(()=>{ if (document.getElementById('xiaoyuan').classList.contains('open')) document.getElementById('xy-input').focus(); }, 120);
  }
}
function closeXY(){
  globalThis.XiaoyuanMenu?.close();
  globalThis.CustomSkills?.close();
  globalThis.OwnerMemory?.close();
  document.getElementById('xiaoyuan').classList.remove('open');
  document.getElementById('xy-input').blur();
  globalThis.DeviceParameterDemo?.refresh();
}
/* 回车发送 */
document.getElementById('xy-input').addEventListener('keydown', e=>{
  if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); sendMsg(); }
});
/* 输入框有内容时发送按钮高亮 */
const sendBtn = document.getElementById('xy-send');
document.getElementById('xy-input').addEventListener('input', e=>{
  updateSendTint();
});
sendBtn.style.opacity = '.55';

/* ================= 小源输入增强：语音识别 + 图片 ================= */
let pendingImgs = [];
const MAX_IMG = 6;

function renderAttach(){
  const box = document.getElementById('xy-attach');
  if (!box) return;
  if(globalThis.MultimodalDemo?.renderAttachments){MultimodalDemo.renderAttachments(box,pendingImgs);globalThis.ProductionStrategy?.renderAttachment(box);updateSendTint();return;}
  box.innerHTML = pendingImgs.map((u, i) =>
    '<div class="xy-thumb"><img src="' + u + '"><i onclick="removeImg(' + i + ')">×</i></div>').join('');
  updateSendTint();
}
function removeImg(i){ pendingImgs.splice(i, 1); renderAttach(); }
function updateSendTint(){
  const b = document.getElementById('xy-send');
  if (!b) return;
  const inp = document.getElementById('xy-input');
  const has = (inp && inp.value.trim().length > 0) || pendingImgs.length > 0 || globalThis.ProductionStrategy?.hasFile();
  b.style.opacity = generating || has ? '1' : '.55';
  b.style.color = '';
}

function pickImage(){ const m = document.getElementById('pick-mask'); if (m) m.classList.add('on'); }
function closePick(){ const m = document.getElementById('pick-mask'); if (m) m.classList.remove('on'); }
function pickFrom(where){
  closePick();
  const el = document.getElementById(where === 'production' ? 'file-production' : where === 'cam' ? 'file-cam' : 'file-gal');
  if (!el) return;
  el.value = '';
  el.click();
}
function onPickFile(ev){
  if(globalThis.MultimodalDemo){void MultimodalDemo.pickFiles(ev.target.files);return;}
  const f = ev.target.files && ev.target.files[0];
  if (!f) return;
  if (pendingImgs.length >= MAX_IMG) { toast(T('一次最多发 3 张图片', 'Up to 3 images at a time')); return; }
  readImageFile(f, function(url){
    pendingImgs.push(url);
    renderAttach();
    const iw = document.getElementById('xy-iw');
    if (iw && iw.classList.contains('voice')) toggleVoice();
  });
}
function readImageFile(file, cb){
  if (!/^image\//.test(file.type || '')) { toast(T('请选择图片文件', 'Please choose an image file')); return; }
  const fr = new FileReader();
  fr.onload = function(){
    const img = new Image();
    img.onload = function(){
      const MAXD = 1100;
      let w = img.naturalWidth || 1, h = img.naturalHeight || 1;
      const k = Math.min(1, MAXD / Math.max(w, h));
      w = Math.max(1, Math.round(w * k)); h = Math.max(1, Math.round(h * k));
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      let out = c.toDataURL('image/jpeg', 0.85);
      if (out.length > 900000) out = c.toDataURL('image/jpeg', 0.62);
      cb(out);
    };
    img.onerror = function(){ toast(T('图片读取失败', 'Failed to read the image')); };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}

/* ---- 语音：点麦克风进入语音状态 → 按住说话 → 松开转文字 ---- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;
let voiceMode = false, recog = null, recActive = false, recFinal = '', recInterim = '', recErr = '';

function toggleVoice(){
  if (!SR) {
    toast(T('当前浏览器不支持语音识别（建议 Chrome / Edge），可以直接打字提问',
            'Speech recognition is not supported in this browser — please type instead'));
    return;
  }
  voiceMode = !voiceMode;
  const iw = document.getElementById('xy-iw');
  if (iw) iw.classList.toggle('voice', voiceMode);
  const mic = document.getElementById('xy-mic');
  if (mic) { mic.style.color = voiceMode ? '#5b8dff' : ''; mic.setAttribute('aria-pressed', String(voiceMode)); }
  const inp = document.getElementById('xy-input');
  if (voiceMode) { if (inp) inp.blur(); toast(T('按住下方按钮说话，松开自动转文字', 'Hold the button below and speak')); }
  else { if (inp) inp.focus(); }
}

function recStart(){
  if (!SR || recActive) return;
  recErr = ''; recFinal = ''; recInterim = '';
  const inp = document.getElementById('xy-input');
  const lg = (LANG_NAME[detectLang(inp && inp.value ? inp.value : '') || 'zh'] || LANG_NAME.zh).code;
  try { recog = new SR(); } catch (e) { toast('语音识别初始化失败'); return; }
  recog.lang = lg;
  recog.continuous = true;
  recog.interimResults = true;
  recog.maxAlternatives = 1;
  recog.onresult = function(e){
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) recFinal += r[0].transcript;
      else interim += r[0].transcript;
    }
    recInterim = interim;
    const el = document.getElementById('xy-rec-txt');
    if (el) el.textContent = (recFinal + interim).slice(-80);
    const t = document.getElementById('xy-rec-t');
    if (t) t.textContent = T('正在聆听…松开结束', 'Listening… release to finish');
  };
  recog.onerror = function(e){ recErr = (e && e.error) || 'error'; };
  recog.onend = function(){ if (recActive) recEnd(true); };
  recActive = true;
  try { recog.start(); } catch (e) {
    recActive = false;
    toast(T('语音识别启动失败，请再按一次', 'Could not start recognition, please hold again'));
    return;
  }
  const hold = document.getElementById('xy-hold');
  const rec = document.getElementById('xy-rec');
  const rtxt = document.getElementById('xy-rec-txt');
  const rt = document.getElementById('xy-rec-t');
  const ht = document.getElementById('xy-hold-t');
  if (hold) hold.classList.add('rec');
  if (rec) rec.classList.add('on');
  if (rtxt) rtxt.textContent = '';
  if (rt) rt.textContent = T('正在聆听…松开结束', 'Listening… release to finish');
  if (ht) ht.textContent = T('松开发送', 'Release to finish');
  const wave = document.getElementById('xy-wave');
  if (wave && !wave.childNodes.length) {
    let h = '';
    for (let i = 0; i < 13; i++) h += '<i style="animation-delay:' + (i * 0.07).toFixed(2) + 's"></i>';
    wave.innerHTML = h;
  }
}

function recEnd(fromEngine){
  if (!recActive && !fromEngine) return;
  recActive = false;
  if (recog) { try { recog.stop(); } catch (e) {} }
  const hold = document.getElementById('xy-hold');
  const rec = document.getElementById('xy-rec');
  const ht = document.getElementById('xy-hold-t');
  if (hold) hold.classList.remove('rec');
  if (rec) rec.classList.remove('on');
  if (ht) ht.textContent = T('按住说话', 'Hold to talk');
  const txt = (recFinal + ' ' + recInterim).replace(/\s+/g, ' ').trim();
  recFinal = ''; recInterim = '';
  if (txt) {
    const inp = document.getElementById('xy-input');
    if (inp) {
      inp.value = (inp.value ? inp.value.replace(/\s*$/, '') + ' ' : '') + txt;
      updateSendTint();
    }
    toast(T('已转成文字，确认后点发送', 'Transcribed — tap send when ready'));
  } else if (recErr) {
    const map = {
      'not-allowed': T('没有麦克风权限：请在浏览器地址栏允许使用麦克风', 'Microphone permission denied'),
      'service-not-allowed': T('浏览器禁止了语音服务，请检查权限设置', 'Speech service blocked by the browser'),
      'network': T('语音识别服务连不上（可能被网络限制），可以改用打字', 'Speech service unreachable — please type instead'),
      'no-speech': T('没有听到声音，请靠近麦克风再说一次', 'No speech detected, please try again'),
      'audio-capture': T('没有找到麦克风设备', 'No microphone found')
    };
    toast(map[recErr] || T('语音识别失败：', 'Recognition failed: ') + recErr);
  } else {
    toast(T('没有听清，请按住再试一次', 'Did not catch that, please hold and try again'));
  }
  recErr = '';
}

(function bindInputEnhance(){
  const hold = document.getElementById('xy-hold');
  const cam = document.getElementById('file-cam');
  const gal = document.getElementById('file-gal');
  if (hold) {
    hold.addEventListener('pointerdown', function(e){ e.preventDefault(); recStart(); });
    hold.addEventListener('pointerup', function(e){ e.preventDefault(); recEnd(); });
    hold.addEventListener('pointercancel', function(){ recEnd(); });
    hold.addEventListener('pointerleave', function(){ if (recActive) recEnd(); });
  }
  if (cam) cam.addEventListener('change', onPickFile);
  if (gal) gal.addEventListener('change', onPickFile);
  const pm = document.getElementById('pick-mask');
  if (pm) pm.addEventListener('click', function(e){ if (e.target === pm) closePick(); });
})();

let toastTimer;
function toast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>t.classList.remove('show'),1600);
}
/* ================= 仿真台数据同步层（simulator.html → 本页） ================= */
const SIM_KEY = 'fs_sim_state_v3';
let SIMSTATE = null;        /* 最近一次仿真台快照 */
let SIMAGG = null;          /* 聚合实时曲线 / 逐时电量 */
const TIME = { t: 0, day: 1, speed: 60, running: true };
const PLANTS = [];          /* 全部仿真电站 */


function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}


function simClock(){ return SIMSTATE ? SIMSTATE.time.clock : new Date().toTimeString().slice(0, 5); }
function simDateText(){ return SIMSTATE ? SIMSTATE.time.dateText : ''; }

/* ---------- 时区换算：每座电站按所在国家的当地时间显示（与小源口径完全一致） ---------- */
const COUNTRY_TZ = {
  '中国':'Asia/Shanghai', '中国香港':'Asia/Hong_Kong', '中国澳门':'Asia/Macau', '中国台湾':'Asia/Taipei',
  '德国':'Europe/Berlin', '日本':'Asia/Tokyo', '韩国':'Asia/Seoul', '波兰':'Europe/Warsaw',
  '西班牙':'Europe/Madrid', '葡萄牙':'Europe/Lisbon', '意大利':'Europe/Rome', '法国':'Europe/Paris',
  '荷兰':'Europe/Amsterdam', '英国':'Europe/London', '爱尔兰':'Europe/Dublin', '比利时':'Europe/Brussels',
  '奥地利':'Europe/Vienna', '瑞士':'Europe/Zurich', '瑞典':'Europe/Stockholm', '挪威':'Europe/Oslo',
  '丹麦':'Europe/Copenhagen', '芬兰':'Europe/Helsinki', '希腊':'Europe/Athens', '土耳其':'Europe/Istanbul',
  '俄罗斯':'Europe/Moscow', '乌克兰':'Europe/Kiev', '匈牙利':'Europe/Budapest', '捷克':'Europe/Prague',
  '罗马尼亚':'Europe/Bucharest', '阿拉伯联合酋长国':'Asia/Dubai', '沙特阿拉伯':'Asia/Riyadh',
  '卡塔尔':'Asia/Qatar', '以色列':'Asia/Jerusalem', '印度':'Asia/Kolkata', '巴基斯坦':'Asia/Karachi',
  '新加坡':'Asia/Singapore', '泰国':'Asia/Bangkok', '越南':'Asia/Ho_Chi_Minh', '马来西亚':'Asia/Kuala_Lumpur',
  '印度尼西亚':'Asia/Jakarta', '菲律宾':'Asia/Manila', '澳大利亚':'Australia/Sydney', '新西兰':'Pacific/Auckland',
  '美国':'America/New_York', '加拿大':'America/Toronto', '墨西哥':'America/Mexico_City', '巴西':'America/Sao_Paulo',
  '智利':'America/Santiago', '阿根廷':'America/Argentina/Buenos_Aires', '南非':'Africa/Johannesburg',
  '埃及':'Africa/Cairo', '尼日利亚':'Africa/Lagos', '肯尼亚':'Africa/Nairobi', '摩洛哥':'Africa/Casablanca'
};

function tzOffMin(tz, utcMs){
  try {
    const dtf = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour12: false,
      year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' });
    const p = {};
    dtf.formatToParts(new Date(utcMs)).forEach(x => { p[x.type] = x.value; });
    const hh = p.hour === '24' ? 0 : +p.hour;
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, hh, +p.minute, +p.second);
    return Math.round((asUTC - utcMs) / 60000);
  } catch (e) { return 480; }
}
function p2n(n){ return (n < 10 ? '0' : '') + n; }
function localOf(tz, utcMs){
  const off = tzOffMin(tz, utcMs);
  const d = new Date(utcMs + off * 60000);
  const y = d.getUTCFullYear(), mo = d.getUTCMonth() + 1, dd = d.getUTCDate(), hh = d.getUTCHours(), mm = d.getUTCMinutes();
  return {
    y, mo, dd, hh, mm, off,
    clock: p2n(hh) + ':' + p2n(mm),
    date: y + '/' + p2n(mo) + '/' + p2n(dd),
    dateText: y + '/' + p2n(mo) + '/' + p2n(dd) + ' ' + p2n(hh) + ':' + p2n(mm),
    tzLabel: 'UTC' + (off >= 0 ? '+' : '−') + p2n(Math.floor(Math.abs(off) / 60)) + ':' + p2n(Math.abs(off) % 60)
  };
}
/* 当前时刻：优先用仿真台时钟（与页面显示同源），没有快照时退回本机时间 */
function nowUtc(){ return (SIMSTATE && SIMSTATE.time && SIMSTATE.time.utc) ? SIMSTATE.time.utc : Date.now(); }
function stationTz(s){
  if (!s) return 'Asia/Shanghai';
  const p = (s.live && s.pid) ? PLANTS.find(x => x.id === s.pid) : null;
  return (p && p.tz) || s.tz || COUNTRY_TZ[s.country] || 'Asia/Shanghai';
}
function stationLocal(s){ return localOf(stationTz(s), nowUtc()); }
function stationLocalText(s){
  const lt = stationLocal(s);
  return lt.dateText + '（' + lt.tzLabel + '）';
}
function isTimeQuestion(q){
  const s = String(q || '');
  const askTime = /(几点|什么时间|什么时候|当前时间|当地时间|现在时间|时间是|时差|时区|utc|gmt|几号|几月几号|星期几|what time|local time|current time|time ?zone|clock)/i.test(s);
  const other = /(发电|电量|收益|功率|告警|设备|装机|负载|充放电|soc|效率|排名|报表|power|generation|energy|yield|revenue|alarm|device)/i.test(s);
  return askTime && !other;
}
/* 时间类问题走确定性计算：保证小源说的时间和页面显示永远一致 */
function timeAnswer(q){
  const utcMs = nowUtc();
  const bj = localOf('Asia/Shanghai', utcMs);
  const en = curLang !== 'zh';
  const names = matchStations(q).map(st => st.name);
  let targets = names.length ? stations.filter(s => names.indexOf(s.name) >= 0) : [];
  if (!targets.length && xyScope !== 'all') targets = stations.filter(s => s.name === xyScope);
  const diffOf = dh => dh === 0
    ? (en ? 'same time as Beijing' : '与北京时间无时差')
    : (en ? (dh > 0 ? 'ahead of Beijing by ' : 'behind Beijing by ') + (Math.abs(dh) % 1 ? Math.abs(dh).toFixed(1) : Math.abs(dh)) + ' h'
          : '比北京时间' + (dh > 0 ? '快 ' : '慢 ') + (Math.abs(dh) % 1 ? Math.abs(dh).toFixed(1) : Math.abs(dh)) + ' 小时');

  const lines = [];
  if (targets.length) {
    targets.slice(0, 4).forEach(s => {
      const lt = stationLocal(s);
      const dh = (lt.off - bj.off) / 60;
      lines.push((en ? s.name + ': local time ' : '「' + s.name + '」当地时间 ') + lt.dateText +
        '（' + lt.tzLabel + '，' + s.country + ' ' + (s.addr || '').replace(s.country + ' ', '') + '）');
      lines.push('• ' + diffOf(dh) + (en ? '; Beijing time ' : '；北京时间 ') + bj.dateText);
    });
  } else {
    lines.push((en ? 'Current Beijing time ' : '当前北京时间 ') + bj.dateText + '（UTC+08:00）');
    const sims = stations.filter(s => s.live).slice(0, 6);
    if (sims.length) {
      lines.push((en ? '• Simulated plants, local time: ' : '• 仿真电站当地时间：') +
        sims.map(s => (en ? s.name + ' ' : '「' + s.name + '」') + stationLocalText(s)).join('；'));
      const other = sims.filter(s => stationLocal(s).off !== bj.off);
      if (other.length) lines.push((en ? '• Time difference: ' : '• 时差：') + other.map(s => {
        const dh = (stationLocal(s).off - bj.off) / 60;
        return (en ? s.name + ' ' : '「' + s.name + '」') + diffOf(dh);
      }).join('；'));
    }
  }
  lines.push('• ' + (en ? 'Time source: ' : '时间基准：') + (SIMSTATE
    ? (en ? 'the simulator clock (aligned with your computer; each plant follows its own country time zone)' : '光储仿真台实时时钟（与电脑时间一致，各电站按所在国家当地时间运行）')
    : (en ? 'local device time (not connected to the simulator)' : '本机时间（当前未连接仿真台，仅作参考）')));
  return lines.join('\n');
}

/* ================= 小源内联控制：储能 SOC 区间（直接写回仿真台） ================= */
const SIM_CMD_KEY = 'fs_sim_cmd_v1';
const SIM_ACK_KEY = 'fs_sim_ack_v1';
let simCmdSeq = 0;
let pendingCmd = null;

function isSocQuestion(q){
  const s = String(q || '');
  if (/soc/i.test(s)) return true;
  if (/battery|ess/i.test(s) && /(range|window|limit|floor|ceiling|min|max|reserve)/i.test(s)) return true;
  if (!/储能|电池|充电|放电/i.test(s)) return false;
  return /(下限|上限|区间|范围|保留|充到|放到|深度)/.test(s);
}
/* 找到要改的电站：问题里点名的 > 小源限定范围 > 第一座仿真电站 */
function socTargetPlant(q){
  const names = matchStations(q).map(s => s.name);
  let st = names.length ? stations.find(s => s.name === names[0]) : null;
  if (!st && xyScope !== 'all') st = stations.find(s => s.name === xyScope);
  if (!st) st = stations.filter(s => s.live)[0] || null;
  return st;
}
function socCardHTML(st){
  const min = st && st.socMin != null ? Math.round(st.socMin) : 10;
  const max = st && st.socMax != null ? Math.round(st.socMax) : 98;
  const soc = st && st.soc != null ? Math.round(st.soc) : null;
  const pid = st && st.live ? st.pid : '';
  return '<div class="soc-card" data-pid="' + esc(pid) + '" data-name="' + esc(st ? st.name : '') + '">' +
    '<div class="soc-h"><b>' + T('储能 SOC 工作区间', 'Battery SOC window') + '</b><span>' + (st ? esc(st.name) : T('未连接仿真台', 'not connected')) + '</span></div>' +
    '<div class="soc-line"><span>' + T('放电下限', 'Discharge floor') + '</span><input type="range" min="0" max="85" step="1" value="' + min + '" class="soc-min"><b class="soc-min-v">' + min + '%</b></div>' +
    '<div class="soc-line"><span>' + T('充电上限', 'Charge ceiling') + '</span><input type="range" min="15" max="100" step="1" value="' + max + '" class="soc-max"><b class="soc-max-v">' + max + '%</b></div>' +
    '<div class="soc-presets"><span data-min="10" data-max="98">10–98%</span><span data-min="20" data-max="90">20–90%</span>' +
      '<span data-min="5" data-max="100">5–100%</span><span data-min="30" data-max="80">30–80%</span></div>' +
    '<button class="soc-ok" onclick="applySocCard(this)">' + T('保存到仿真台', 'Save to simulator') + '</button>' +
    '<div class="soc-note">' + (soc != null ? T('当前 SOC ', 'Current SOC ') + soc + '% · ' : '') +
      (st ? T('改完点保存，仿真台立即按新区间调度', 'Tap save and the simulator applies it immediately') : T('仿真台未连接，打开 simulator.html 后再试', 'Simulator not connected — open simulator.html first')) + '</div>' +
  '</div>';
}
function showSocCard(q, intro){
  const st = socTargetPlant(q);
  const head = intro || ('可以直接在这里改，拖动滑条即可（下限越高保留电量越多，上限越低循环越保守）：');
  const row = addMsgHTML('ai', '<div class="soc-intro">' + head + '</div>' + socCardHTML(st));
  bindSocCard(row);
  return row;
}
function bindSocCard(row){
  const card = row.querySelector('.soc-card');
  if (!card) return;
  const min = card.querySelector('.soc-min'), max = card.querySelector('.soc-max');
  const minv = card.querySelector('.soc-min-v'), maxv = card.querySelector('.soc-max-v');
  function sync(by){
    let a = +min.value, b = +max.value;
    if (b - a < 5) {
      if (by === 'min') { a = b - 5; min.value = Math.max(0, a); a = +min.value; }
      else { b = a + 5; max.value = Math.min(100, b); b = +max.value; }
    }
    minv.textContent = a + '%';
    maxv.textContent = b + '%';
  }
  min.addEventListener('input', () => sync('min'));
  max.addEventListener('input', () => sync('max'));
  card.querySelectorAll('.soc-presets span').forEach(el => {
    el.addEventListener('click', () => {
      min.value = el.dataset.min; max.value = el.dataset.max; sync();
    });
  });
}
function applySocCard(btn){
  const card = btn.closest('.soc-card');
  if (!card) return;
  const a = +card.querySelector('.soc-min').value;
  const b = +card.querySelector('.soc-max').value;
  const pid = card.dataset.pid || '';
  const name = card.dataset.name || '';
  if (!pid) { toast('未连接仿真台，无法修改'); return; }
  if (b - a < 5) { toast('上限需比下限至少高 5%'); return; }
  sendSimCmd({ type: 'soc', plantId: pid, min: a, max: b }, 'SOC 区间 ' + a + '%–' + b + '%');
  btn.textContent = '已下发，等待仿真台生效…';
  setTimeout(() => { btn.textContent = '保存到仿真台'; }, 2600);
  addMsg('ai', '已把「' + name + '」的储能 SOC 工作区间改为 ' + a + '% – ' + b + '%，仿真台会立即按新区间调度，首页与设备页的 SOC 也会同步刷新。');
}
function sendSimCmd(payload, label){
  const id = globalThis.crypto?.randomUUID?.() || Date.now() + '-' + (++simCmdSeq);
  const cmd = Object.assign({ id: id, ts: Date.now() }, payload);
  AppBridge.command(cmd).then(() => { pendingCmd = { id: id, at: Date.now(), label: label || '参数修改' }; }).catch(error => toast(error.message));
  return id;
}
async function checkSimAck(){
  if (!pendingCmd) return;
  const current = pendingCmd;
  try {
    const command = await AppBridge.acknowledgment(current.id);
    if (pendingCmd !== current) return;
    if (command && command.status !== 'pending') { toast((command.ok ? '✓ ' : '⚠ ') + command.msg); pendingCmd = null; }
    else if (Date.now() - current.at > 35000) { toast('⚠ 指令未执行，请确认管理端正在运行'); pendingCmd = null; }
  } catch(error) { if(Date.now() - current.at > 35000) { toast(error.message); pendingCmd = null; } }
}

/* ================= 小源内联参数面板：所有可设置参数可视化修改 ================= */
const PM_TYPES = [['ci','工商业'],['res','户用']];
const PM_MODES = [['surplus','余电上网'],['self','自发自用']];
const PM_BAT   = [['auto','自动'],['charge','强制充电'],['discharge','强制放电'],['idle','待机']];
const PM_SPEEDS = [1, 60, 600, 3600];
/* 可选地区（与仿真台 GEO 表对应，切换后时区 / 币种 / 默认电价一起变） */
const PM_COUNTRIES = [
  ['中国','¥'],['中国香港','HK$'],['日本','¥'],['韩国','₩'],['新加坡','S$'],['泰国','฿'],['越南','₫'],
  ['印度','₹'],['沙特阿拉伯','﷼'],['阿拉伯联合酋长国','د.إ'],['土耳其','₺'],
  ['德国','€'],['西班牙','€'],['法国','€'],['意大利','€'],['荷兰','€'],['波兰','zł'],['英国','£'],
  ['美国','$'],['巴西','R$'],['澳大利亚','A$'],['南非','R']
];
const PM_TABS = [['gen','概览','GENERAL'],['pv','光伏','PV'],['bat','储能','BATTERY'],['tar','电价','TARIFF'],['op','运行','OPS']];

/* 目标电站：问题里点名的 > 小源限定范围 > 第一座在线的 */
function pmPlant(q){
  const names = matchStations(q).map(s => s.name);
  let st = names.length ? stations.find(s => s.name === names[0]) : null;
  if (!st && xyScope !== 'all') st = stations.find(s => s.name === xyScope);
  if (!st) st = stations.filter(s => s.live && !s.closed)[0] || stations[0] || null;
  return st;
}
function pmObj(st){ return st && st.pid ? (PLANTS.find(p => p.id === st.pid) || null) : null; }

function pmRowR(k, label, val, min, max, step, unit){
  return '<div class="pm-row"><span>' + label + '</span>' +
    '<input class="pm-rng" type="range" data-k="' + k + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
    '<b data-v="' + k + '">' + val + (unit || '') + '</b></div>';
}
function pmRowN(k, label, val, step, unit){
  return '<div class="pm-row"><span>' + label + '</span>' +
    '<input class="pm-inp" type="number" data-k="' + k + '" step="' + step + '" value="' + val + '">' +
    '<b data-u="' + k + '">' + (unit || '') + '</b></div>';
}
function pmRowT(k, label, val){
  return '<div class="pm-row"><span>' + label + '</span>' +
    '<input class="pm-inp" type="text" data-k="' + k + '" maxlength="24" value="' + esc(val) + '"><b></b></div>';
}
function pmRowS(k, label, opts, cur){
  return '<div class="pm-row"><span>' + label + '</span><div class="pm-seg" data-k="' + k + '">' +
    opts.map(o => '<span data-v="' + o[0] + '" class="' + (String(o[0]) === String(cur) ? 'on' : '') + '">' + o[1] + '</span>').join('') +
    '</div></div>';
}
function pmRowSel(k, label, opts, cur){
  return '<div class="pm-row"><span>' + label + '</span>' +
    '<select class="pm-sel" data-k="' + k + '">' +
    opts.map(o => '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') +
    '</select><b></b></div>';
}
function pmRowD(label, val, id){
  return '<div class="pm-row"><span>' + label + '</span><b class="pm-d" data-d="' + id + '">' + val + '</b><b></b></div>';
}
function pmRowStart(s){
  s = s || {};
  return '<div class="pm-row"><span>' + T('起始时间', 'Start') + '</span><div class="pm-date">' +
    '<input class="pm-inp pm-sm" type="number" data-k="startMo" min="1" max="12" value="' + (s.mo || 1) + '"><i>' + T('月', 'M') + '</i>' +
    '<input class="pm-inp pm-sm" type="number" data-k="startDd" min="1" max="31" value="' + (s.dd || 1) + '"><i>' + T('日', 'D') + '</i>' +
    '<input class="pm-inp pm-sm" type="number" data-k="startHh" min="0" max="23" value="' + (s.hh || 0) + '"><i>' + T('时', 'H') + '</i>' +
    '</div></div>';
}
function pmCardHTML(st){
  const p = pmObj(st);
  if (!p) {
    return '<div class="pm-card"><div class="pm-h"><b>' + T('电站参数', 'Plant parameters') + '</b><span>' + T('未连接仿真台', 'not connected') + '</span></div>' +
      '<div class="pm-note">' + T('这些参数要由仿真台执行：请在同一浏览器里打开 simulator.html（仿真电站），连上之后这里就能直接改。',
        'Parameters are applied by the simulator — open simulator.html in the same browser first.') + '</div></div>';
  }
  const sym = (p.tariff && p.tariff.sym) || '¥';
  const n = (v, d, dg) => { const x = (v != null && isFinite(+v)) ? +v : d; return dg == null ? x : +x.toFixed(dg); };
  const cfg = p.cfg || {};
  const pv = n(cfg.pvKwp, 0, 1);
  const ratio = n(p.ratio, 1.2, 2);
  const invKw = n(cfg.invKw || p.invKw, pv / (ratio || 1), 1);
  const batKw = n(p.batKw, 0, 1);
  const batH = n(p.batHours, 2, 1);
  const retail = n(p.tariff && p.tariff.retail, 0, 2);
  const fit = n(p.tariff && p.tariff.fit, 0, 2);
  const socNow = Math.round(n(p.soc, 50, 0));
  const socMin = Math.round(n(p.socMin, 10, 0));
  const socMax = Math.round(n(p.socMax, 98, 0));
  const ls = Math.round(n(p.loadScale, 1, 2) * 100);
  const cloud = Math.round(n(p.cloud, 0.25, 2) * 100);
  const pr = Math.round(n(cfg.pr, 0.86, 3) * 100);
  const eff = Math.round(n(cfg.eff, 0.96, 2) * 100);
  const loadPeak = Math.round(n(cfg.loadPeak, invKw * 0.7, 0));
  const gridKw = Math.round(n(cfg.gridKw, invKw * 1.6, 0));
  const sp = (SIMSTATE && SIMSTATE.time && SIMSTATE.time.speed) || 3600;
  const pick = stations.filter(s => s.pid).map(s =>
    '<option value="' + esc(s.pid) + '"' + (p.id === s.pid ? ' selected' : '') + '>' + esc(s.name) + '</option>').join('');
  const countries = PM_COUNTRIES.map(o => [o[0], o[0] + ' ' + o[1]]);
  return '<div class="pm-card" data-pid="' + esc(p.id) + '" data-name="' + esc(p.name) + '">' +
    '<div class="pm-h"><b>' + T('电站参数 · 可直接改', 'Plant parameters') + '</b>' +
      '<select class="pm-sel pm-pick" onchange="pmSwitch(this)" title="' + T('切换要修改的电站', 'Switch plant') + '">' + pick + '</select></div>' +
    '<div class="pm-tabs">' + PM_TABS.map((t, i) =>
      '<span data-t="' + t[0] + '" class="' + (i === 0 ? 'on' : '') + '">' + T(t[1], t[2]) + '</span>').join('') + '</div>' +

    /* —— 概览 —— */
    '<div class="pm-pane on" data-p="gen">' +
      pmRowT('name', T('名称', 'Name'), p.name) +
      pmRowS('type', T('类型', 'Type'), PM_TYPES.map(o => [o[0], T(o[1], o[0] === 'ci' ? 'C&I' : 'Residential')]), p.type) +
      pmRowS('mode', T('并网模式', 'Grid mode'), PM_MODES.map(o => [o[0], T(o[1], o[0] === 'self' ? 'Self-use' : 'Surplus')]), p.mode) +
      pmRowSel('country', T('国家/地区', 'Country'), countries, p.country) +
      pmRowT('city', T('城市', 'City'), p.city) +
      pmRowS('runState', T('运行状态', 'State'), [['on', T('运行中', 'Running')], ['off', T('已停机', 'Stopped')]], p.closed ? 'off' : 'on') +
    '</div>' +

    /* —— 光伏 —— */
    '<div class="pm-pane" data-p="pv">' +
      pmRowN('pvKwp', T('装机容量', 'DC capacity'), pv, 1, 'kWp') +
      pmRowN('ratio', T('容配比', 'DC/AC'), ratio, 0.01, '') +
      pmRowN('invKw', T('逆变器', 'Inverter'), invKw, 1, 'kW') +
      pmRowR('pr', T('系统效率', 'PR'), pr, 50, 120, 1, '%') +
      pmRowD(T('年发电量', 'Annual yield'), Math.round(pv * 1150).toLocaleString() + ' kWh', 'yearKwh') +
    '</div>' +

    /* —— 储能 —— */
    '<div class="pm-pane" data-p="bat">' +
      pmRowN('batKw', T('功率', 'Power'), batKw, 1, 'kW') +
      pmRowN('batHours', T('时长', 'Hours'), batH, 0.5, 'h') +
      pmRowD(T('容量', 'Energy'), Math.round(batKw * batH) + ' kWh', 'batKwh') +
      pmRowR('socNow', T('当前 SOC', 'SOC now'), socNow, 0, 100, 1, '%') +
      pmRowR('socMin', T('SOC 下限', 'SOC floor'), socMin, 0, 90, 1, '%') +
      pmRowR('socMax', T('SOC 上限', 'SOC ceiling'), socMax, 5, 100, 1, '%') +
      pmRowR('eff', T('充放电效率', 'Round-trip'), eff, 80, 100, 1, '%') +
      pmRowS('batMode', T('策略', 'Strategy'), PM_BAT.map(o => [o[0], T(o[1], o[0])]), p.batMode || 'auto') +
    '</div>' +

    /* —— 电价 —— */
    '<div class="pm-pane" data-p="tar">' +
      pmRowN('retail', T('买电电价', 'Retail price'), retail, 0.01, sym + '/kWh') +
      pmRowN('fit', T('上网电价', 'Feed-in tariff'), fit, 0.01, sym + '/kWh') +
      pmRowD(T('结算币种', 'Currency'), (p.tariff && p.tariff.cur ? p.tariff.cur + ' · ' : '') + sym, 'cur') +
      pmRowD(T('满充满放收益差', 'Full-cycle spread'), sym + (Math.max(0, retail - fit) * (batKw * batH) * 0.9).toFixed(1), 'spread') +
    '</div>' +

    /* —— 运行 —— */
    '<div class="pm-pane" data-p="op">' +
      pmRowR('loadScale', T('负载倍率', 'Load scale'), ls, 50, 200, 5, '%') +
      pmRowN('loadPeak', T('负载峰值', 'Peak load'), loadPeak, 1, 'kW') +
      pmRowN('gridKw', T('并网容量', 'Grid capacity'), gridKw, 1, 'kW') +
      pmRowR('cloud', T('云量', 'Cloud cover'), cloud, 0, 100, 5, '%') +
      pmRowS('gridOut', T('并网点', 'Grid'), [['false', T('正常并网', 'On-grid')], ['true', T('离网', 'Off-grid')]], String(!!p.gridOut)) +
      pmRowS('speed', T('仿真倍速', 'Speed'), PM_SPEEDS.map(v => [String(v), v === 1 ? T('实时', '1×') : (v + '×')]), String(sp)) +
      pmRowStart(p.start) +
    '</div>' +

    '<button class="pm-ok" onclick="applyParamCard(this)">' + T('保存到仿真台', 'Save to simulator') + '</button>' +
    '<div class="pm-note">' + T('保存后仿真台按新参数重算当天曲线，首页、详情页、设备页同步刷新。',
      'Saved values are applied immediately and the app refreshes.') + '</div>' +
    '</div>';
}
/* 卡片里切换电站：原地重绘同一张卡 */
function pmSwitch(sel){
  const card = sel.closest('.pm-card');
  if (!card) return;
  const st = stations.find(s => s.pid === sel.value);
  if (!st) return;
  card.insertAdjacentHTML('afterend', pmCardHTML(st));
  const nc = card.nextElementSibling;
  card.remove();
  bindParamCard(nc);
}

/* ---------- 单参数聚焦调节卡（与 SOC 卡同款交互：大数值 + 滑条 + 快捷档 + 保存） ---------- */
const PM_EDIT = {
  pvKwp:    { zh:'装机容量', en:'Capacity', kind:'range', min:1, max:2000, step:1, unit:'kWp', presets:[100,300,500,1000], from:v=>v },
  ratio:    { zh:'容配比', en:'DC/AC ratio', kind:'range', min:1.05, max:3, step:0.05, unit:'', presets:[1.1,1.2,1.3,1.5], from:v=>v },
  invKw:    { zh:'逆变器功率', en:'Inverter', kind:'range', min:1, max:2000, step:1, unit:'kW', presets:[100,250,500,1000], from:v=>v },
  pr:       { zh:'系统效率 PR', en:'PR', kind:'range', min:50, max:120, step:1, unit:'%', presets:[75,80,82,86,90], from:v=>v/100, toDisp:v=>v*100 },
  batKw:    { zh:'储能功率', en:'Battery power', kind:'range', min:1, max:2000, step:1, unit:'kW', presets:[50,100,200,500], from:v=>v },
  batHours: { zh:'储能时长', en:'Duration', kind:'range', min:0.5, max:12, step:0.5, unit:'h', presets:[1,2,3,4], from:v=>v },
  socNow:   { zh:'当前 SOC', en:'SOC now', kind:'range', min:0, max:100, step:1, unit:'%', presets:[20,50,60,80,95], from:v=>v },
  socMin:   { zh:'SOC 下限', en:'SOC floor', kind:'range', min:0, max:90, step:1, unit:'%', presets:[5,10,20,30], from:v=>v },
  socMax:   { zh:'SOC 上限', en:'SOC ceiling', kind:'range', min:5, max:100, step:1, unit:'%', presets:[80,90,95,100], from:v=>v },
  eff:      { zh:'充放电效率', en:'Round-trip eff.', kind:'range', min:80, max:100, step:1, unit:'%', presets:[90,94,95,96], from:v=>v/100, toDisp:v=>v*100 },
  retail:   { zh:'买电电价', en:'Retail price', kind:'range', min:0, max:5, step:0.01, unit:'', dyn:'retail', from:v=>v },
  fit:      { zh:'上网电价', en:'Feed-in tariff', kind:'range', min:0, max:5, step:0.01, unit:'', dyn:'fit', from:v=>v },
  loadScale:{ zh:'负载倍率', en:'Load scale', kind:'range', min:50, max:200, step:5, unit:'%', presets:[80,100,120,150], from:v=>v/100, toDisp:v=>v*100 },
  cloud:    { zh:'云量', en:'Cloud cover', kind:'range', min:0, max:100, step:5, unit:'%', presets:[0,25,50,75,100], from:v=>v/100, toDisp:v=>v*100 },
  loadPeak: { zh:'负载峰值', en:'Peak load', kind:'range', min:1, max:5000, step:1, unit:'kW', dyn:'loadPeak', from:v=>v },
  gridKw:   { zh:'并网容量', en:'Grid capacity', kind:'range', min:1, max:9000, step:1, unit:'kW', dyn:'gridKw', from:v=>v },
  name:     { zh:'电站名称', en:'Plant name', kind:'text', from:v=>v },
  city:     { zh:'城市', en:'City', kind:'text', from:v=>v },
  country:  { zh:'国家/地区', en:'Country', kind:'country', from:v=>v },
  type:     { zh:'电站类型', en:'Type', kind:'seg', opts:[['ci','工商业'],['res','户用']], from:v=>v },
  mode:     { zh:'并网模式', en:'Grid mode', kind:'seg', opts:[['surplus','余电上网'],['self','自发自用']], from:v=>v },
  batMode:  { zh:'储能策略', en:'Strategy', kind:'seg', opts:PM_BAT, from:v=>v },
  gridOut:  { zh:'并网点', en:'Grid point', kind:'seg', opts:[['false','正常并网'],['true','离网']], from:v=>v==='true' },
  runState: { zh:'运行状态', en:'State', kind:'seg', opts:[['on','运行中'],['off','已停机']], power:true },
  speed:    { zh:'仿真倍速', en:'Speed', kind:'seg', opts:PM_SPEEDS.map(v => [String(v), v === 1 ? '实时' : v + '×']), speed:true }
};
function pmCurVal(p, key){
  const cfg = p.cfg || {};
  switch (key) {
    case 'pvKwp': return cfg.pvKwp;
    case 'ratio': return p.ratio;
    case 'invKw': return cfg.invKw || p.invKw;
    case 'pr': return Math.round((cfg.pr || 0.86) * 100);
    case 'eff': return Math.round((cfg.eff || 0.96) * 100);
    case 'batKw': return p.batKw;
    case 'batHours': return p.batHours;
    case 'socNow': return Math.round(p.soc);
    case 'socMin': return Math.round(p.socMin);
    case 'socMax': return Math.round(p.socMax);
    case 'retail': return p.tariff.retail;
    case 'fit': return p.tariff.fit;
    case 'loadScale': return Math.round(p.loadScale * 100);
    case 'cloud': return Math.round(p.cloud * 100);
    case 'loadPeak': return cfg.loadPeak;
    case 'gridKw': return cfg.gridKw;
    case 'name': return p.name;
    case 'city': return p.city;
    case 'country': return p.country;
    case 'type': return p.type;
    case 'mode': return p.mode;
    case 'batMode': return p.batMode || 'auto';
    case 'gridOut': return String(!!p.gridOut);
    case 'runState': return p.closed ? 'off' : 'on';
    case 'speed': return String((SIMSTATE && SIMSTATE.time && SIMSTATE.time.speed) || 3600);
  }
  return null;
}
function pmEditCardHTML(st, key, preset){
  const p = pmObj(st);
  const meta = PM_EDIT[key];
  if (!p || !meta) return '';
  const sym = (p.tariff && p.tariff.sym) || '¥';
  let cur = pmCurVal(p, key);
  let val = cur;
  if (preset != null && meta.kind === 'range') {
    const pv = (meta.toDisp ? meta.toDisp(+preset) : +preset);
    if (isFinite(pv)) val = Math.max(meta.min, Math.min(meta.max, pv));
  } else if (preset != null) {
    val = preset;
  }
  /* 电价 / 负载峰值 / 并网容量：滑条范围与快捷档按当前电站动态生成 */
  if (meta.dyn) {
    if (meta.dyn === 'retail' || meta.dyn === 'fit') {
      const base = Math.max(0.1, cur || 0);
      meta.max = Math.max(1, +(base * 3).toFixed(2));
      meta.presets = [+(base * 0.5).toFixed(2), +base.toFixed(2), +(base * 1.5).toFixed(2)];
    } else if (meta.dyn === 'loadPeak') {
      const inv = p.invKw || 100;
      meta.max = Math.round(inv * 2.5);
      meta.presets = [Math.round(inv * 0.4), Math.round(inv * 0.7), Math.round(inv)];
    } else if (meta.dyn === 'gridKw') {
      const inv = p.invKw || 100;
      meta.max = Math.round(inv * 4);
      meta.presets = [Math.round(inv), Math.round(inv * 1.6), Math.round(inv * 2.4)];
    }
  }
  let body = '';
  if (meta.kind === 'range') {
    const fmt = v => (meta.step < 1 ? (+v).toFixed(meta.step < 0.1 ? 2 : 1) : Math.round(v));
    const unit = (key === 'retail' || key === 'fit') ? sym + '/kWh' : meta.unit;
    body = '<div class="pm-big"><b class="pm-e-v">' + fmt(val) + '</b><i>' + unit + '</i></div>' +
      '<input type="range" class="pm-e-rng" min="' + meta.min + '" max="' + meta.max + '" step="' + meta.step + '" value="' + val + '">' +
      '<div class="soc-presets pm-e-presets">' + (meta.presets || []).map(x =>
        '<span data-x="' + x + '">' + fmt(x) + (unit && unit.indexOf('%') >= 0 ? '%' : '') + '</span>').join('') + '</div>';
  } else if (meta.kind === 'seg') {
    body = '<div class="pm-seg pm-e-seg" style="margin:4px 0 9px">' + meta.opts.map(o =>
      '<span data-v="' + o[0] + '" class="' + (String(cur) === String(o[0]) ? 'on' : '') + '">' + T(o[1], o[1]) + '</span>').join('') + '</div>';
  } else if (meta.kind === 'text') {
    body = '<input class="pm-inp pm-e-txt" style="margin:2px 0 9px" maxlength="24" value="' + esc(cur || '') + '">';
  } else if (meta.kind === 'country') {
    body = '<select class="pm-sel pm-e-sel" style="margin:2px 0 9px">' +
      PM_COUNTRIES.map(o => '<option value="' + esc(o[0]) + '"' + (cur === o[0] ? ' selected' : '') + '>' + esc(o[0] + ' ' + o[1]) + '</option>').join('') + '</select>';
  }
  return '<div class="soc-card pm-e" data-key="' + key + '" data-pid="' + esc(p.id) + '" data-name="' + esc(p.name) + '">' +
    '<div class="soc-h"><b>' + T(meta.zh, meta.en) + '</b><span>' + esc(p.name) + '</span></div>' +
    body +
    '<button class="soc-ok" onclick="applyPmEdit(this)">' + T('保存到仿真台', 'Save to simulator') + '</button>' +
    '<div class="soc-note">' + T('拖动滑条或点快捷档，点保存后仿真台立即生效，首页 / 详情页同步刷新。',
      'Drag the slider or tap a preset, then save — the simulator applies it immediately.') + '</div>' +
    '</div>';
}
function showPmEditCard(st, key, preset, intro){
  const meta = PM_EDIT[key] || {};
  const html = pmEditCardHTML(st, key, preset);
  if (!html) { showParamCard(st && st.name); return; }
  const head = intro || (preset != null && PM_EDIT[key].kind === 'range'
    ? T('已按你说的把 ' + meta.zh + ' 预填为下方数值，可再拖动微调，确认后点保存：', 'Prefilled below — fine-tune and save:')
    : T('直接拖动调节，确认后点保存：', 'Adjust below and save:'));
  const row = addMsgHTML('ai', '<div class="soc-intro">' + head + '</div>' + html);
  bindPmEditCard(row);
  return row;
}
function bindPmEditCard(row){
  const card = (row && row.classList && row.classList.contains('pm-e')) ? row : (row ? row.querySelector('.pm-e') : null);
  if (!card) return;
  const meta = PM_EDIT[card.dataset.key] || {};
  const rng = card.querySelector('.pm-e-rng');
  const big = card.querySelector('.pm-e-v');
  if (rng && big) {
    const fmt = v => (meta.step < 1 ? (+v).toFixed(meta.step < 0.1 ? 2 : 1) : Math.round(v));
    rng.addEventListener('input', () => { big.textContent = fmt(rng.value); });
    card.querySelectorAll('.pm-e-presets span').forEach(el => {
      el.addEventListener('click', () => { rng.value = el.dataset.x; big.textContent = fmt(rng.value); });
    });
  }
  card.querySelectorAll('.pm-e-seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const s = e.target.closest('span[data-v]');
      if (!s) return;
      seg.querySelectorAll('span').forEach(x => x.classList.remove('on'));
      s.classList.add('on');
    });
  });
}
function applyPmEdit(btn){
  const card = btn.closest('.pm-e');
  if (!card) return;
  const key = card.dataset.key;
  const pid = card.dataset.pid;
  const name = card.dataset.name;
  const meta = PM_EDIT[key];
  if (!meta || !pid) { toast(T('未连接仿真台，无法修改', 'Simulator not connected')); return; }
  const st = stations.find(s => s.pid === pid);
  const p = pmObj(st);
  let val = null, cmd = null;
  if (meta.kind === 'range') {
    const el = card.querySelector('.pm-e-rng');
    if (!el) return;
    val = +el.value;
    cmd = { type: 'config', plantId: pid, patch: (() => { const pa = {}; pa[key] = meta.from(val); return pa; })() };
  } else if (meta.kind === 'seg') {
    const on = card.querySelector('.pm-e-seg span.on');
    if (!on) return;
    if (meta.power) { cmd = { type: 'power', plantId: pid, on: on.dataset.v === 'on' }; val = on.dataset.v; }
    else if (meta.speed) { cmd = { type: 'speed', value: +on.dataset.v }; val = on.dataset.v; }
    else cmd = { type: 'config', plantId: pid, patch: (() => { const pa = {}; pa[key] = meta.from(on.dataset.v); return pa; })() };
    val = on.textContent;
  } else if (meta.kind === 'text') {
    const el = card.querySelector('.pm-e-txt');
    val = (el.value || '').trim();
    if (!val) { toast(T('请先填写内容', 'Please type a value first')); return; }
    cmd = { type: 'config', plantId: pid, patch: (() => { const pa = {}; pa[key] = val; return pa; })() };
  } else if (meta.kind === 'country') {
    const el = card.querySelector('.pm-e-sel');
    val = el.value;
    cmd = { type: 'config', plantId: pid, patch: { country: val } };
  }
  /* SOC 上下限联动约束 */
  if (p && (key === 'socNow' || key === 'socMin' || key === 'socMax')) {
    const pa = cmd.patch || {};
    if (key === 'socNow') pa.socNow = Math.max(p.socMin, Math.min(p.socMax, val));
    if (key === 'socMin') pa.socMin = Math.min(val, p.socMax - 5);
    if (key === 'socMax') pa.socMax = Math.max(val, p.socMin + 5);
  }
  sendSimCmd(cmd, T(meta.zh, meta.en) + ' → ' + val);
  btn.textContent = T('已下发，等待仿真台生效…', 'Sending…');
  setTimeout(() => { btn.textContent = T('保存到仿真台', 'Save to simulator'); }, 2600);
  addMsg('ai', T('已把「' + name + '」的' + meta.zh + '调整为 ' + val + '，仿真台会立即生效，首页、详情页、设备页随后同步。',
    'Applied to ' + name + ' — the simulator refreshes shortly.'));
}
function bindParamCard(row){
  const card = (row && row.classList && row.classList.contains('pm-card')) ? row : (row ? row.querySelector('.pm-card') : null);
  if (!card) return;
  const q = k => card.querySelector('[data-k="' + k + '"]');
  const vnum = k => { const el = q(k); return el ? parseFloat(el.value) : NaN; };
  const sync = () => {
    const pv = vnum('pvKwp') || 0;
    const rt = vnum('ratio') || 1;
    const bw = vnum('batKw') || 0;
    const bh = vnum('batHours') || 0;
    const bk = card.querySelector('[data-d="batKwh"]');
    if (bk) bk.textContent = Math.round(bw * bh) + ' kWh';
    const yr = card.querySelector('[data-d="yearKwh"]');
    if (yr) yr.textContent = Math.round(pv * 1150).toLocaleString() + ' kWh';
    const sp = card.querySelector('[data-d="spread"]');
    if (sp) {
      const r = vnum('retail') || 0, f = vnum('fit') || 0;
      const cur = card.querySelector('[data-d="cur"]');
      const sym = cur ? (cur.textContent.split('·').pop() || '¥').trim() : '¥';
      sp.textContent = sym + (Math.max(0, r - f) * bw * bh * 0.9).toFixed(1);
    }
  };
  /* 分页 */
  card.querySelectorAll('.pm-tabs span').forEach(t => {
    t.addEventListener('click', () => {
      card.querySelectorAll('.pm-tabs span').forEach(x => x.classList.remove('on'));
      t.classList.add('on');
      card.querySelectorAll('.pm-pane').forEach(p => p.classList.toggle('on', p.dataset.p === t.dataset.t));
    });
  });
  /* 滑条 */
  card.querySelectorAll('.pm-rng').forEach(el => {
    const k = el.dataset.k;
    const out = card.querySelector('[data-v="' + k + '"]');
    const unit = out ? out.textContent.replace(/^-?[\d.]+/, '') : '';
    el.addEventListener('input', () => {
      if (out) out.textContent = el.value + unit;
      /* SOC 当前值跟随上下限提示 */
      if (k === 'socMin' || k === 'socMax') sync();
    });
  });
  /* 数字 / 文本输入：装机 ↔ 逆变器 双向联动 */
  card.querySelectorAll('.pm-inp').forEach(el => {
    el.addEventListener('input', () => {
      const k = el.dataset.k;
      const pvEl = q('pvKwp'), rtEl = q('ratio'), invEl = q('invKw');
      if (pvEl && rtEl && invEl) {
        if (k === 'invKw') {
          const inv = parseFloat(invEl.value), rt = parseFloat(rtEl.value) || 1;
          if (inv > 0) pvEl.value = +(inv * rt).toFixed(2);
        } else if (k === 'pvKwp' || k === 'ratio') {
          const pv = parseFloat(pvEl.value), rt = parseFloat(rtEl.value) || 1;
          if (pv > 0 && rt > 0) invEl.value = +(pv / rt).toFixed(1);
        }
      }
      sync();
    });
  });
  /* 分段按钮 */
  card.querySelectorAll('.pm-seg').forEach(seg => {
    seg.addEventListener('click', e => {
      const s = e.target.closest('span[data-v]');
      if (!s) return;
      seg.querySelectorAll('span').forEach(x => x.classList.remove('on'));
      s.classList.add('on');
      sync();
    });
  });
  /* 换国家：电价单位同步换成该国货币，并提示电价会按当地默认值重置 */
  const cSel = card.querySelector('.pm-sel[data-k="country"]');
  if (cSel) {
    cSel.addEventListener('change', () => {
      const hit = PM_COUNTRIES.find(o => o[0] === cSel.value);
      const sym = hit ? hit[1] : '¥';
      const cur = card.querySelector('[data-d="cur"]');
      if (cur) cur.textContent = sym;
      ['retail', 'fit'].forEach(k => {
        const u = card.querySelector('[data-u="' + k + '"]');
        if (u) u.textContent = sym + '/kWh';
      });
      sync();
    });
  }
  sync();
}
function showParamCard(q, intro){
  const st = pmPlant(q);
  const head = intro || T('这台电站所有能设置的参数都在下面，拖动或填写后点「保存到仿真台」即可，仿真台会立即生效：',
    'Every settable parameter is below — adjust and save, and the simulator applies it immediately:');
  const row = addMsgHTML('ai', '<div class="soc-intro">' + head + '</div>' + pmCardHTML(st));
  bindParamCard(row);
  return row;
}
/* 输入行「参数」按钮：直接在小源对话里开一张可编辑的完整参数卡 */
function xyParam(){
  document.getElementById('xiaoyuan').classList.add('open');
  const intro = document.getElementById('xy-intro');
  if (intro) intro.classList.add('hide');
  document.getElementById('xy-chat').classList.add('on');
  showParamCard('');
  const chat = document.getElementById('xy-chat');
  setTimeout(() => { chat.scrollTop = chat.scrollHeight; }, 30);
}
function applyParamCard(btn){
  const card = btn.closest('.pm-card');
  if (!card) return;
  const pid = card.dataset.pid || '';
  if (!pid) { toast(T('未连接仿真台，无法修改', 'Simulator not connected')); return; }
  const val = k => { const el = card.querySelector('[data-k="' + k + '"]'); return el ? el.value : null; };
  const f = k => { const v = parseFloat(val(k)); return isFinite(v) ? v : null; };
  const seg = k => { const s = card.querySelector('.pm-seg[data-k="' + k + '"] span.on'); return s ? s.dataset.v : null; };
  const socMin = f('socMin'), socMax = f('socMax');
  if (!(socMax - socMin >= 5)) { toast(T('SOC 上限需比下限至少高 5%', 'SOC ceiling must be at least 5% above floor')); return; }
  const pvKwp = f('pvKwp'), ratio = f('ratio');
  if (!(pvKwp > 0)) { toast(T('装机容量需大于 0', 'Capacity must be greater than 0')); return; }
  if (!(ratio > 1 && ratio < 10)) { toast(T('容配比需在 1–10 之间', 'DC/AC ratio must be between 1 and 10')); return; }
  const invKw = f('invKw'), batKw = f('batKw'), batHours = f('batHours');
  if (!(invKw >= 1)) { toast(T('逆变器功率需不小于 1 kW', 'Inverter must be at least 1 kW')); return; }
  if (!(batKw >= 1) || !(batHours >= 0.5)) { toast(T('储能功率/时长需大于 0', 'Battery power/hours must be positive')); return; }
  const patch = {
    name: val('name'), type: seg('type'), mode: seg('mode'),
    country: val('country'), city: val('city'),
    pvKwp: pvKwp, ratio: ratio, invKw: invKw,
    pr: (f('pr') || 86) / 100,
    batKw: batKw, batHours: batHours,
    socNow: f('socNow'), socMin: socMin, socMax: socMax,
    eff: (f('eff') || 96) / 100,
    batMode: seg('batMode'),
    retail: f('retail'), fit: f('fit'),
    loadScale: (f('loadScale') || 100) / 100,
    loadPeak: f('loadPeak'), gridKw: f('gridKw'),
    cloud: (f('cloud') || 0) / 100,
    gridOut: seg('gridOut') === 'true',
    startMo: f('startMo'), startDd: f('startDd'), startHh: f('startHh')
  };
  Object.keys(patch).forEach(k => {
    if (patch[k] === undefined || patch[k] === null || (typeof patch[k] === 'number' && !isFinite(patch[k]))) delete patch[k];
  });
  sendSimCmd({ type: 'config', plantId: pid, patch: patch }, T('参数修改', 'Parameter change'));
  /* 倍速、启停走各自的专用指令，效果更直接 */
  const sp = seg('speed');
  const curSp = (SIMSTATE && SIMSTATE.time && SIMSTATE.time.speed) || 0;
  if (sp && +sp !== curSp) setTimeout(() => sendSimCmd({ type: 'speed', value: +sp }, T('仿真倍速', 'Simulation speed')), 600);
  const wantOff = seg('runState') === 'off';
  const pObj = PLANTS.find(p => p.id === pid);
  const isOff = !!(pObj && pObj.closed);
  if (wantOff !== isOff) {
    setTimeout(() => sendSimCmd({ type: 'power', plantId: pid, on: !wantOff }, T(wantOff ? '关闭电站' : '启动电站', wantOff ? 'Stop plant' : 'Start plant')), 900);
  }
  btn.textContent = T('已下发，等待仿真台生效…', 'Sending…');
  setTimeout(() => { btn.textContent = T('保存到仿真台', 'Save to simulator'); }, 2600);
  addMsg('ai', T('已把改动下发给仿真台，它会按新参数重算当天曲线；首页、详情页、设备页的数据随后同步刷新。',
    'Changes sent — the simulator recalculates and the app refreshes shortly.'));
}

/* ---------- 自然语言改参数：先试着直接执行，改不了再给面板 ---------- */
function isParamQuestion(q){
  const s = String(q || '');
  if (!s.trim()) return false;
  if (/曲线|柱状|柱形|条形|直方|面积图|饼图|环形|趋势图|画图|图表|表格/.test(s)) return false;
  const panel = /(参数|设置项|能改什么|可以改什么|可调项|配置项|改参数|调参数)/.test(s);
  const verb = /(改成|改为|设为|设置为|设定为|调到|调整到|调成|变成|换成|设成|修改成|调整成)/.test(s);
  const kw = /(装机|光伏|容配比|储能|电池|soc|电价|上网|买电|购电|负载|负荷|云量|倍速|加速|户用|工商业|余电|自发自用|离网|容量|时长|功率|名称|站名|逆变器|效率|峰值|并网容量|变压器|城市|地区|国家|停机|关机|开机|启动)/i.test(s);
  const stopstart = /(停机|关机|开机|启动电站|恢复运行|恢复发电|恢复并网|并网运行|切到离网|断开电网)/.test(s);
  if (panel || stopstart) return true;
  return verb && kw;
}
function pmParsePatch(q, st){
  const s = String(q || '');
  const patch = {}, notes = [];
  const grab = re => { const m = re.exec(s); return m ? parseFloat(m[1]) : null; };
  const put = (k, v, txt) => {
    if (v == null) return;
    if (typeof v === 'number' && !isFinite(v)) return;
    if (typeof v === 'string' && !v.trim()) return;
    patch[k] = v; notes.push(txt);
  };

  /* 名称 */
  const nm = /(?:名称|站名|名字)(?:改成|改为|设为|设成|叫)\s*[「"'（(]?([^\s，。,;；"'」）)]{2,24})/.exec(s) ||
             /(?:改名为|重命名为|叫做)\s*[「"'（(]?([^\s，。,;；"'」）)]{2,24})/.exec(s);
  if (nm) put('name', nm[1], '名称「' + nm[1] + '」');

  /* SOC 区间在一起说：20-90 */
  const rng = /soc[^\d]{0,8}(\d+(?:\.\d+)?)\s*(?:%?\s*[-–~至到]\s*)(\d+(?:\.\d+)?)/i.exec(s);
  if (rng) {
    put('socMin', +rng[1], 'SOC 下限 ' + rng[1] + '%');
    put('socMax', +rng[2], 'SOC 上限 ' + rng[2] + '%');
  } else {
    put('socMin', grab(/(?:放电下限|soc\s*下限|最低\s*soc)[^\d]{0,6}(\d+(?:\.\d+)?)/i), 'SOC 下限');
    put('socMax', grab(/(?:充电上限|soc\s*上限|最高\s*soc)[^\d]{0,6}(\d+(?:\.\d+)?)/i), 'SOC 上限');
  }

  /* 装机 / 容配比 */
  /* 装机 / 容配比（“容量”排除 并网容量/储能容量/变压器容量 等专用词） */
  put('pvKwp', grab(/(?:装机容量|装机|光伏容量|组件容量|(?<!储能)(?<!电池)(?<!并网)(?<!变压器)容量)[^\d]{0,10}(\d+(?:\.\d+)?)/) ||
              grab(/(\d+(?:\.\d+)?)\s*kwp/i), null);
  if (patch.pvKwp != null) notes.push('装机容量 ' + patch.pvKwp + ' kWp');
  put('ratio', grab(/(?:容配比|直流交流比)[^\d]{0,8}(\d+(?:\.\d+)?)/), null);
  if (patch.ratio != null) notes.push('容配比 ' + patch.ratio);

  /* 储能 */
  const kwh = grab(/(?:储能容量|电池容量)[^\d]{0,8}(\d+(?:\.\d+)?)/);
  if (kwh != null) {
    const h = (pmObj(st) && pmObj(st).batHours) || 2;
    put('batKw', +(kwh / h).toFixed(0), '储能 ' + Math.round(kwh) + ' kWh（' + Math.round(kwh / h) + ' kW × ' + h + ' h）');
  } else {
    const bkw = grab(/(?:储能功率|电池功率|充放电功率|储能最大功率)[^\d]{0,8}(\d+(?:\.\d+)?)/);
    if (bkw != null) put('batKw', bkw, '储能功率 ' + bkw + ' kW');
  }
  put('batHours', grab(/(?:储能时长|电池时长|充放电小时数|储能小时数|时长)[^\d]{0,8}(\d+(?:\.\d+)?)/), null);
  if (patch.batHours != null) notes.push('储能时长 ' + patch.batHours + ' h');

  /* 逆变器 / 系统效率 / 充放电效率 */
  const invV = grab(/(?:逆变器|逆变|输出功率)[^\d]{0,8}(\d+(?:\.\d+)?)\s*kw/i);
  if (invV != null) put('invKw', invV, '逆变器 ' + invV + ' kW');
  const prV = grab(/(?:系统效率|综合效率|p\s*r)[^\d]{0,8}(\d+(?:\.\d+)?)\s*%/i);
  if (prV != null) put('pr', prV / 100, '系统效率 ' + prV + '%');
  const effV = grab(/(?:充放电效率|往返效率|循环效率|电池效率)[^\d]{0,8}(\d+(?:\.\d+)?)\s*%/);
  if (effV != null) put('eff', effV / 100, '充放电效率 ' + effV + '%');

  /* 负载峰值 / 并网容量 */
  const lpV = grab(/(?:负载峰值|峰值负载|最大负荷)[^\d]{0,8}(\d+(?:\.\d+)?)\s*kw/i);
  if (lpV != null) put('loadPeak', lpV, '负载峰值 ' + lpV + ' kW');
  const gcV = grab(/(?:并网容量|变压器容量|并网功率)[^\d]{0,8}(\d+(?:\.\d+)?)\s*kw/i);
  if (gcV != null) put('gridKw', gcV, '并网容量 ' + gcV + ' kW');

  /* 当前 SOC（只在明确说“当前/设为”时才当瞬时值，避免和区间冲突） */
  const socNowV = grab(/(?:当前\s*soc|soc\s*(?:设为|设置为|调到|调成|改成|调整到))[^\d]{0,4}(\d+(?:\.\d+)?)/i);
  if (socNowV != null) put('socNow', socNowV, '当前 SOC ' + socNowV + '%');

  /* 城市 / 国家 */
  const cityM = /(?:城市|所在地|位置)(?:改成|改为|设为|设成|调整到)\s*[「"']?([^\s，。,;；「」"'）)]{2,12})/.exec(s);
  if (cityM) put('city', cityM[1], '城市 ' + cityM[1]);
  if (/(国家|地区)(?:改成|改为|设为|切换到|换成)/.test(s)) {
    const hit = PM_COUNTRIES.map(o => o[0]).find(nm => s.indexOf(nm) >= 0 && !/改/.test(nm));
    if (hit) put('country', hit, '国家/地区 ' + hit);
  }

  /* 电价 */
  const fitV = grab(/(?:上网|售电|余电|卖电)(?:电价)?[^\d]{0,8}(\d+(?:\.\d+)?)/);
  if (fitV != null) put('fit', fitV, '上网电价 ' + fitV);
  const retailV = grab(/(?:买电|购电|用电|零售|市电)(?:电价)?[^\d]{0,8}(\d+(?:\.\d+)?)/);
  if (retailV != null) put('retail', retailV, '买电电价 ' + retailV);
  else if (fitV == null) {
    const anyT = grab(/电价[^\d]{0,8}(\d+(?:\.\d+)?)/);
    if (anyT != null) put('retail', anyT, '买电电价 ' + anyT);
  }

  /* 负载 / 云量 */
  const ls = grab(/(?:负载|负荷)[^\d]{0,8}(\d+(?:\.\d+)?)\s*%/);
  if (ls != null) put('loadScale', ls / 100, '负载倍率 ' + ls + '%');
  const cl = grab(/(?:云量|云层|遮挡|多云)[^\d]{0,8}(\d+(?:\.\d+)?)\s*%/);
  if (cl != null) put('cloud', cl / 100, '云量 ' + cl + '%');

  /* 枚举类 */
  if (/(户用|居民)/.test(s)) put('type', 'res', '类型 户用');
  else if (/工商业/.test(s)) put('type', 'ci', '类型 工商业');
  if (/余电上网|全额上网/.test(s)) put('mode', 'surplus', '并网模式 余电上网');
  else if (/自发自用|全额自发/.test(s)) put('mode', 'self', '并网模式 自发自用');
  if (/强制充电/.test(s)) put('batMode', 'charge', '储能策略 强制充电');
  else if (/强制放电/.test(s)) put('batMode', 'discharge', '储能策略 强制放电');
  else if (/待机/.test(s)) put('batMode', 'idle', '储能策略 待机');
  if (!patch.mode && /(离网|停电|断开电网)/.test(s)) put('gridOut', true, '并网点 离网');
  else if (!patch.mode && /(恢复并网|恢复供电|并网运行)/.test(s)) put('gridOut', false, '并网点 正常并网');

  const speed = grab(/(?:倍速|加速|仿真速度|时钟)[^\d]{0,8}(\d+(?:\.\d+)?)/);
  /* 启停 */
  let power = null;
  if (/(停机|关机|停止运行|关掉电站|关闭电站)/.test(s)) power = false;
  else if (/(开机|启动电站|恢复运行|恢复发电)/.test(s)) power = true;
  return { patch: patch, notes: notes.filter(Boolean), speed: speed, power: power };
}
function applyParamPatch(st, r){
  const p = pmObj(st) || st;
  const pid = p && (p.id || p.pid);
  if (!pid) { toast(T('未连接仿真台，无法修改', 'Simulator not connected')); return; }
  const keys = Object.keys(r.patch);
  if (keys.length) sendSimCmd({ type: 'config', plantId: pid, patch: r.patch }, T('参数修改', 'Parameter change'));
  if (r.speed != null && isFinite(r.speed)) setTimeout(() => sendSimCmd({ type: 'speed', value: r.speed }, T('仿真倍速', 'Simulation speed')), r.speed && keys.length ? 600 : 0);
  if (r.power != null) setTimeout(() => sendSimCmd({ type: 'power', plantId: pid, on: r.power }, T(r.power ? '启动电站' : '关闭电站', r.power ? 'Start plant' : 'Stop plant')), keys.length ? 900 : 0);
  const nm = p.name || (st && st.name) || '';
  const said = r.notes.length ? r.notes.join('、') : '';
  const spTxt = (r.speed != null && isFinite(r.speed)) ? (T('仿真倍速 ', 'speed ') + (r.speed === 1 ? T('实时', '1×') : r.speed + '×')) : '';
  const pwTxt = r.power == null ? '' : T(r.power ? '启动电站' : '停机', r.power ? 'start' : 'stop');
  addMsg('ai', T('已把「' + nm + '」的 ' + [said, spTxt, pwTxt].filter(Boolean).join('、') + ' 下发到仿真台，几秒内首页和详情页会同步成新值。\n还想改别的？直接说「参数」，我给你一张可以拖动的完整参数表。',
    'Applied to ' + nm + ': ' + [said, spTxt, pwTxt].filter(Boolean).join(', ') + '. Say "parameters" for the full editable panel.'));
}
function handleParamAsk(q){
  const st = pmPlant(q);
  const obj = pmObj(st);
  if (!obj) { showParamCard(q); return; }
  const r = pmParsePatch(q, st);
  if (r) {
    const keys = Object.keys(r.patch);
    /* 单个参数 → 像 SOC 卡一样的聚焦调节卡（滑条 + 快捷档），预填用户说的值 */
    if (keys.length === 1 && r.speed == null && r.power == null && PM_EDIT[keys[0]]) {
      showPmEditCard(st, keys[0], r.patch[keys[0]]);
      return;
    }
    if (!keys.length && r.power != null && r.speed == null) { showPmEditCard(st, 'runState', r.power ? 'on' : 'off'); return; }
    if (!keys.length && r.power == null && r.speed != null && isFinite(r.speed)) { showPmEditCard(st, 'speed', String(r.speed)); return; }
    if (keys.length || (r.speed != null && isFinite(r.speed)) || r.power != null) { applyParamPatch(st, r); return; }
  }
  showParamCard(q);
}

/* ================= 小源内联功率曲线卡（光伏 / 储能 / 负载 / 电网 · 实时刷新） ================= */
const POWER_CARDS = [];
const PW_SERIES = [
  { key: 'pv',   label: '光伏', en: 'PV',      color: '#30d158' },
  { key: 'load', label: '负载', en: 'Load',    color: '#0a84ff' },
  { key: 'bat',  label: '储能', en: 'Battery', color: '#ff9f0a' },
  { key: 'grid', label: '电网', en: 'Grid',    color: '#bf5af2' }
];
function pwLabel(c){ return curLang === 'zh' ? c.label : (c.en || c.label); }

function isPowerCurveQuestion(q){
  const s = String(q || '');
  if (/曲线|折线|走势|趋势|波形|图表|画个图|画图|看图|柱状|柱形|条形|直方|面积图|堆叠|堆积|饼图|环形图/.test(s)) return true;
  if (/功率/.test(s)) return true;
  if (/表格|列表|明细|数据表/.test(s) && /功率|发电|出力|光伏|储能|负载|负荷|电网|电量/.test(s)) return true;
  if (/(curve|chart|graph|trend|bar|histogram|area chart|table of)/i.test(s) && /(power|pv|solar|load|battery|grid|kw)/i.test(s)) return true;
  return /(发电|出力|光伏|储能|负载|负荷|电网)/.test(s) && /(实时|变化|怎么走|情况)/.test(s);
}
/* 问题里点名的电站 > 小源限定范围 > 全部电站聚合（返回 null） */
function pwScope(q){
  const names = matchStations(q).map(s => s.name);
  let st = names.length ? stations.find(s => s.name === names[0]) : null;
  if (!st && xyScope !== 'all') st = stations.find(s => s.name === xyScope);
  return st || null;
}
function pwSeries(pid){
  if (!pid) {
    const rows = (SIMAGG && SIMAGG.hist) || [];
    return { rows: rows, name: PLANTS.length > 1 ? ('全部 ' + PLANTS.length + ' 座电站') : (PLANTS[0] ? PLANTS[0].name : '全部电站') };
  }
  const p = PLANTS.find(x => x.id === pid);
  return { rows: (p && p.hist) || [], name: p ? p.name : '未连接仿真台' };
}
function pwValueText(key, v){
  if (!v) return '--';
  const zh = curLang === 'zh';
  if (key === 'pv') return (v.pv || 0).toFixed(1) + ' kW';
  if (key === 'load') return (v.load || 0).toFixed(1) + ' kW';
  if (key === 'bat') return (v.bat >= 0 ? (zh ? '放 ' : 'Dis ') : (zh ? '充 ' : 'Chg ')) + Math.abs(v.bat || 0).toFixed(1) + ' kW';
  return (v.grid >= 0 ? (zh ? '取 ' : 'Imp ') : (zh ? '上 ' : 'Exp ')) + Math.abs(v.grid || 0).toFixed(1) + ' kW';
}
/* 曲线几何与纵轴刻度：绘制与点击取值共用，保证点位和线完全对齐 */
const PW_GEO = { W: 320, H: 118, L: 30, R: 315, T: 10, B: 98 };
const PW_COLOR = { pv: '#30d158', load: '#0a84ff', bat: '#ff9f0a', grid: '#bf5af2' };
function pwYMax(rows){
  let maxV = 10;
  (rows || []).forEach(v => { maxV = Math.max(maxV, v.pv || 0, v.load || 0, Math.abs(v.bat || 0), Math.abs(v.grid || 0)); });
  const step = maxV > 400 ? 200 : maxV > 200 ? 100 : maxV > 80 ? 50 : maxV > 40 ? 20 : 10;
  return Math.ceil(maxV / step) * step;
}
/* ---- 图表类型：按用户说法切换（曲线 / 柱状 / 面积 / 表格） ---- */
const PW_TYPES = [
  { k:'line',  label:'曲线',  en:'Line',  title:'功率曲线',   enTitle:'Power · line' },
  { k:'bar',   label:'柱状',  en:'Bar',   title:'功率柱状图', enTitle:'Power · bar' },
  { k:'area',  label:'面积',  en:'Area',  title:'功率面积图', enTitle:'Power · area' },
  { k:'table', label:'表格',  en:'Table', title:'功率数据表', enTitle:'Power · table' }
];
const PW_TYPE_NAME = { line:'曲线', bar:'柱状图', area:'面积图', table:'表格' };
const PW_TYPE_EN = { line:'line', bar:'bar chart', area:'area chart', table:'table' };
/* 从问法里判断想要的图形；没有明确说法时默认曲线 */
function pwChartType(q){
  const s = String(q || '');
  if (/柱状|柱形|条形|直方|柱子|bar\s*chart|barchart|histogram|\bbar\b|column/i.test(s)) return 'bar';
  if (/表格|列表|明细|数据表|清单|逐条|table|list of/i.test(s)) return 'table';
  if (/面积|填充|色块|区域图|area/i.test(s)) return 'area';
  if (/堆叠|堆积|叠加|stacked/i.test(s)) return 'bar';      /* 功率没有可堆叠的分量，用分组柱对比更清楚 */
  if (/饼图|环形图|占比|构成|pie|donut/i.test(s)) return 'bar'; /* 功率随时间变化，饼图不适用 → 落回柱状对比 */
  return 'line';
}
function pwTypeTitle(t){
  const o = PW_TYPES.find(x => x.k === t);
  if (!o) return curLang === 'zh' ? '功率曲线' : 'Power · line';
  return curLang === 'zh' ? o.title : o.enTitle;
}
/* 把采样行转成绘图点：曲线/面积用原始采样，柱状按桶聚合（200 个点太密，聚合后更易读） */
function pwPlot(rows, type){
  const n = (rows || []).length;
  if (type === 'bar') {
    const K = Math.max(6, Math.min(16, Math.round(n / 6) || 10));
    const pts = [];
    for (let b = 0; b < K; b++) {
      const a = Math.floor(b * n / K), z = Math.max(a + 1, Math.floor((b + 1) * n / K));
      let pv = 0, load = 0, bat = 0, grid = 0, c = 0;
      for (let i = a; i < z && i < n; i++) {
        pv += rows[i].pv || 0; load += rows[i].load || 0;
        bat += rows[i].bat || 0; grid += rows[i].grid || 0; c++;
      }
      c = c || 1;
      pts.push({ v: { pv: pv / c, load: load / c, bat: bat / c, grid: grid / c }, x: (b + 0.5) / K, i0: a, i1: z - 1 });
    }
    return { pts: pts, K: K };
  }
  return { pts: rows.map((v, i) => ({ v: v, x: n > 1 ? i / (n - 1) : 0, i0: i, i1: i })), K: n };
}
function pwAxes(yMax){
  const { L, R, T, B } = PW_GEO;
  let s = '';
  for (let i = 0; i <= 3; i++) {
    const gy = (T + (B - T) * i / 3).toFixed(1);
    s += '<line x1="' + L + '" y1="' + gy + '" x2="' + R + '" y2="' + gy + '" stroke="#262b36" stroke-width="1" stroke-dasharray="3 4"/>';
    s += '<text x="' + (L - 5) + '" y="' + (+gy + 3.5) + '" fill="#5f6675" font-size="9" text-anchor="end">' + Math.round(yMax * (1 - i / 3)) + '</text>';
  }
  return s;
}
function pwTableHTML(rows){
  const tz = (PLANTS[0] && PLANTS[0].tz) || 'Asia/Shanghai';
  const n = rows.length;
  const step = Math.max(1, Math.ceil(n / 12));
  let body = '';
  for (let i = n - 1; i >= 0; i -= step) {
    const v = rows[i] || {};
    const secs = Math.round((n - 1 - i) * 1.5);
    const lt = localOf(tz, nowUtc() - secs * 1000);
    body += '<tr><td>' + lt.clock + '</td>' +
      '<td>' + (v.pv || 0).toFixed(1) + '</td>' +
      '<td>' + (v.load || 0).toFixed(1) + '</td>' +
      '<td>' + (v.bat >= 0 ? T('放 ', 'Dis ') : T('充 ', 'Chg ')) + Math.abs(v.bat || 0).toFixed(1) + '</td>' +
      '<td>' + (v.grid >= 0 ? T('取 ', 'Imp ') : T('上 ', 'Exp ')) + Math.abs(v.grid || 0).toFixed(1) + '</td></tr>';
  }
  return '<div class="pw-tWrap"><table class="pw-table"><thead><tr><th>' + T('时间', 'Time') + '</th><th>' + T('光伏', 'PV') + '</th><th>' + T('负载', 'Load') + '</th><th>' + T('储能', 'Batt') + '</th><th>' + T('电网', 'Grid') + '</th></tr></thead><tbody>' + body + '</tbody></table></div>';
}
/* 横轴跨度：仿真台加速时一个采样点代表的仿真时间会被拉长，标签要跟着变 */
function pwSpanText(n){
  const spd = (typeof TIME !== 'undefined' && TIME && TIME.speed) ? +TIME.speed : 1;
  const sec = Math.max(0, n - 1) * 1.5 * (spd > 0 ? spd : 1);
  if (sec < 3600) return '-' + Math.max(1, Math.round(sec / 60)) + T(' 分钟', ' min');
  const h = sec / 3600;
  if (h < 48) return '-' + (h >= 10 ? Math.round(h) : h.toFixed(1)) + T(' 小时', ' h');
  return '-' + (h / 24).toFixed(1) + T(' 天', ' d');
}
function pwSVG(rows, type){
  type = type || 'line';  const { W, H, L, R, T, B } = PW_GEO;
  if (!rows || rows.length < 2) return '<div class="pw-empty">采样中，几秒后自动出现' + (PW_TYPE_NAME[type] || '曲线') + '…</div>';
  if (type === 'table') return pwTableHTML(rows);
  const yMax = pwYMax(rows);
  const d = pwPlot(rows, type);
  const X = x01 => L + (R - L) * x01;
  const Y = v => B - (B - T) * Math.min(1, Math.abs(v || 0) / yMax);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '">' + pwAxes(yMax);

  if (type === 'bar') {
    /* 分组柱：每个时间桶内四路并排，一眼看出同一时刻谁高谁低 */
    const band = (R - L) / d.K;
    const bw = Math.max(1.6, band / 4 * 0.74);
    d.pts.forEach(pt => {
      PW_SERIES.forEach((c, k) => {
        const x = X(pt.x) - band / 2 + band / 4 * (k + 0.5) - bw / 2;
        const y = Y(pt.v[c.key]);
        const h = Math.max(0.9, B - y);
        s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) +
             '" rx=".8" fill="' + c.color + '" opacity="' + ((c.key === 'pv' || c.key === 'load') ? '.95' : '.7') + '"/>';
      });
    });
  } else {
    if (type === 'area') {
      /* 面积图：四路各自铺一层同色半透明填充 */
      PW_SERIES.forEach(c => {
        let poly = '';
        rows.forEach((v, i) => { poly += X(i / (rows.length - 1)).toFixed(1) + ',' + Y(v[c.key]).toFixed(1) + ' '; });
        s += '<polygon points="' + L + ',' + B + ' ' + poly + R + ',' + B + '" fill="' + c.color + '" opacity=".14"/>';
      });
    } else {
      let area = '';
      rows.forEach((v, i) => { area += X(i / (rows.length - 1)).toFixed(1) + ',' + Y(v.pv).toFixed(1) + ' '; });
      s += '<polygon points="' + L + ',' + B + ' ' + area + R + ',' + B + '" fill="rgba(48,209,88,.12)"/>';
    }
    const line = (key, color, w, dash) => {
      let pts = '';
      rows.forEach((v, i) => { pts += X(i / (rows.length - 1)).toFixed(1) + ',' + Y(v[key]).toFixed(1) + ' '; });
      return '<polyline points="' + pts.trim() + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linejoin="round" stroke-linecap="round"' + (dash ? ' stroke-dasharray="4 3"' : '') + '/>';
    };
    s += line('pv', '#30d158', 1.8);
    s += line('load', '#0a84ff', 1.6);
    s += line('bat', '#ff9f0a', 1.4, true);
    s += line('grid', '#bf5af2', 1.2, true);
    const last = rows[rows.length - 1] || {};
    PW_SERIES.forEach(cfg => {
      s += '<circle cx="' + X(1).toFixed(1) + '" cy="' + Y(last[cfg.key]).toFixed(1) + '" r="2.4" fill="' + cfg.color + '"/>';
    });
  }
  s += '<text x="' + L + '" y="' + (H - 2) + '" fill="#4d5462" font-size="9">' + pwSpanText(rows.length) + '</text>';
  s += '<text x="' + R + '" y="' + (H - 2) + '" fill="#4d5462" font-size="9" text-anchor="end">' + (curLang === 'zh' ? '现在' : 'now') + '</text>';
  return s + '</svg>';
}
function pwCardHTML(pid, type){
  type = type || 'line';
  const s = pwSeries(pid);
  const last = s.rows.length ? s.rows[s.rows.length - 1] : null;
  let vals = '';
  PW_SERIES.forEach(c => {
    vals += '<div><i style="background:' + c.color + '"></i><span>' + pwLabel(c) + '</span><b class="pw-' + c.key + '">' + pwValueText(c.key, last) + '</b></div>';
  });
  let dots = '';
  PW_SERIES.forEach(c => { dots += '<i class="pw-pt" data-k="' + c.key + '" style="background:' + c.color + '"></i>'; });
  const tabs = PW_TYPES.map(t => '<span data-t="' + t.k + '"' + (t.k === type ? ' class="on"' : '') + '>' + (curLang === 'zh' ? t.label : t.en) + '</span>').join('');
  return '<div class="pw-card" data-pid="' + esc(pid || '') + '" data-type="' + type + '">' +
    '<div class="pw-h"><b>' + pwTypeTitle(type) + '</b><span>' + esc(s.name) + ' · ' + T('实时', 'live') + '</span></div>' +
    '<div class="pw-tabs">' + tabs + '</div>' +
    '<div class="pw-vals">' + vals + '</div>' +
    '<div class="pw-plot"><div class="pw-chart">' + pwSVG(s.rows, type) + '</div>' +
      '<div class="pw-overlay"><div class="pw-vline"></div>' + dots + '</div></div>' +
    '<div class="pw-info"></div>' +
    '<div class="pw-foot"><span class="pw-dot"></span><span>' + T('点一下图表，看那一刻的数值和充放电逻辑', 'Tap the chart to inspect a moment and the power-flow logic') + '</span></div>' +
  '</div>';
}
/* ---- 点按曲线：显示该时刻数值 + 充放电逻辑 ---- */
function pwSocRange(p){
  if (!p) return '';
  const a = p.socMin != null ? Math.round(p.socMin) : 10;
  const b = p.socMax != null ? Math.round(p.socMax) : 98;
  return a + '%–' + b + '%';
}
/* 用一句人话解释这一刻的能量去哪了（bat>0 放电，grid>0 取电） */
function pwWhy(v, p){
  if (curLang !== 'zh') return pwWhyEN(v, p);
  const pv = Math.max(0, v.pv || 0), load = Math.max(0, v.load || 0);
  const bat = v.bat || 0, grid = v.grid || 0;
  const f = n => Math.abs(n).toFixed(1);
  const socNow = p && p.soc != null ? Math.round(p.soc) : null;
  if (p && p.gridOut) {
    return '并网点失电，正在离网运行：光伏 <b>' + f(pv) + ' kW</b> 先供负载，不够的部分由储能放电补足，负载已按离网能力做了限制。';
  }
  if (pv >= load + 0.05) {
    const surplus = pv - load;
    let s = '光伏 <b>' + f(pv) + ' kW</b> 比负载 <b>' + f(load) + ' kW</b> 多 <b>' + f(surplus) + ' kW</b>。';
    if (bat < -0.05) {
      const nearTop = p && socNow != null && socNow >= (p.socMax != null ? p.socMax : 98) - 2;
      s += '这部分先给储能充电 <b>' + f(bat) + ' kW</b>';
      if (p) s += nearTop ? '（SOC 已接近上限 ' + pwSocRange(p) + '，很快会停充）' : '（SOC 在 ' + pwSocRange(p) + ' 区间内，还能继续存）';
    } else {
      s += '储能没有充电' + (p ? '（' + (socNow != null && socNow >= (p.socMax != null ? p.socMax : 98) - 1 ? 'SOC 已到充电上限' : '当前不满足充电条件') + '）' : '');
    }
    if (grid < -0.05) s += '，剩下的 <b>' + f(grid) + ' kW</b> ' + (p && p.mode === 'self' ? '本该限发，余电为零' : '上网卖给电网');
    else s += '，没有余电上网';
    return s + '。';
  }
  if (load > pv + 0.05) {
    const gap = load - pv;
    let s = pv < 0.2
      ? '此时光伏没有出力（夜间或强遮挡），负载 <b>' + f(load) + ' kW</b> 只能靠储能和电网，'
      : '光伏 <b>' + f(pv) + ' kW</b> 覆盖不了负载 <b>' + f(load) + ' kW</b>，缺 <b>' + f(gap) + ' kW</b>，';
    if (bat > 0.05) {
      const nearBottom = p && socNow != null && socNow <= (p.socMin != null ? p.socMin : 10) + 3;
      s += '储能放电 <b>' + f(bat) + ' kW</b> 补上' + (nearBottom ? '（SOC 已接近下限 ' + pwSocRange(p) + '，之后会停放电）' : '');
    }
    if (grid > 0.05) s += (bat > 0.05 ? '，其余 <b>' + f(grid) + ' kW</b> 从电网买电' : '，由电网买电 <b>' + f(grid) + ' kW</b>');
    else if (grid < -0.05) s += '，同时还有 <b>' + f(grid) + ' kW</b> 余电上网';
    else if (bat <= 0.05) s += '，储能当前未放电';
    return s + '。';
  }
  return '这一刻光伏出力与负载基本持平，储能和电网几乎不动作，系统在“自平衡”状态。';
}
/* 英文版充放电逻辑说明（其他非中文语言统一用它） */
function pwWhyEN(v, p){
  const pv = Math.max(0, v.pv || 0), load = Math.max(0, v.load || 0);
  const bat = v.bat || 0, grid = v.grid || 0;
  const f = n => Math.abs(n).toFixed(1);
  if (p && p.gridOut) return 'Grid outage — the site is islanded: PV <b>' + f(pv) + ' kW</b> feeds the load first and the battery covers the shortfall.';
  const parts = [];
  parts.push('PV <b>' + f(pv) + ' kW</b>, load <b>' + f(load) + ' kW</b>.');
  if (bat > 0.05) parts.push('Battery is discharging <b>' + f(bat) + ' kW</b> (SOC ' + (p ? pwSocRange(p) : '--') + ').');
  else if (bat < -0.05) parts.push('Battery is charging <b>' + f(-bat) + ' kW</b> (SOC ' + (p ? pwSocRange(p) : '--') + ').');
  else parts.push('Battery is idle.');
  if (grid > 0.05) parts.push('Grid is importing <b>' + f(grid) + ' kW</b> to cover the rest.');
  else if (grid < -0.05) parts.push('Surplus <b>' + f(-grid) + ' kW</b> is exported to the grid' + (p && p.mode === 'self' ? ' (self-consumption mode: normally curtailed).' : '.'));
  else parts.push('No power exchanged with the grid.');
  return parts.join(' ');
}
function pwShowPoint(card, ratio){
  const pid = card.dataset.pid || '';
  const type = card.dataset.type || 'line';
  if (type === 'table') return;                 /* 表格本身就是逐条数值，不需要叠加层 */
  const rows = pwSeries(pid).rows;
  const n = rows.length;
  if (n < 2) return;
  const r = Math.max(0, Math.min(1, ratio));
  card._pwRatio = r;
  const d = pwPlot(rows, type);
  const idx = Math.round(r * (d.pts.length - 1));
  const pt = d.pts[idx] || d.pts[d.pts.length - 1];
  if (!pt) return;
  const v = pt.v;
  const { W, H, L, R, T, B } = PW_GEO;
  const chart = card.querySelector('.pw-chart');
  const rect = chart.getBoundingClientRect();
  if (!rect.width) return;
  const kx = rect.width / W, ky = rect.height / H;
  const xv = L + (R - L) * pt.x;
  const yMax = pwYMax(rows);
  const overlay = card.querySelector('.pw-overlay');
  overlay.classList.add('on');
  overlay.querySelector('.pw-vline').style.left = (xv * kx).toFixed(1) + 'px';
  PW_SERIES.forEach(c => {
    const dot = overlay.querySelector('.pw-pt[data-k="' + c.key + '"]');
    if (!dot) return;
    const yv = B - (B - T) * Math.min(1, Math.abs(v[c.key] || 0) / yMax);
    dot.style.left = (xv * kx).toFixed(1) + 'px';
    dot.style.top = (yv * ky).toFixed(1) + 'px';
  });
  const p = pid ? (PLANTS.find(x => x.id === pid) || null) : (PLANTS.length === 1 ? PLANTS[0] : null);
  const secsAgo = Math.round((n - 1 - (pt.i1 != null ? pt.i1 : pt.i0)) * 1.5);
  const tz = (p && p.tz) || (PLANTS[0] && PLANTS[0].tz) || 'Asia/Shanghai';
  const lt = localOf(tz, nowUtc() - secsAgo * 1000);
  const zh = curLang === 'zh';
  const ago = secsAgo <= 2 ? (zh ? '就在此刻' : 'just now')
    : secsAgo < 60 ? (zh ? secsAgo + ' 秒前' : secsAgo + 's ago')
    : (zh ? Math.floor(secsAgo / 60) + ' 分 ' + (secsAgo % 60) + ' 秒前'
          : Math.floor(secsAgo / 60) + 'm ' + (secsAgo % 60) + 's ago');
  const spanTxt = (type === 'bar' && pt.i0 != null && pt.i1 != null && pt.i1 > pt.i0)
    ? (zh ? '（' + Math.round((pt.i1 - pt.i0 + 1) * 1.5) + ' 秒均值）' : ' (' + Math.round((pt.i1 - pt.i0 + 1) * 1.5) + 's average)') : '';
  let cells = '';
  PW_SERIES.forEach(c => {
    cells += '<div><i style="background:' + c.color + '"></i><span>' + pwLabel(c) + '</span><b>' + pwValueText(c.key, v) + '</b></div>';
  });
  const info = card.querySelector('.pw-info');
  info.innerHTML = '<div class="pwi-t"><b>' + lt.clock + '</b><span>' + ago + ' · ' + lt.tzLabel + ' · ' + esc(pwSeries(pid).name) + spanTxt + '</span></div>' +
    '<div class="pwi-grid">' + cells + '</div>' +
    '<div class="pw-why">💡 ' + pwWhy(v, p) + '</div>';
  info.classList.add('on');
}
function pwHidePoint(card){
  card._pwRatio = null;
  const ov = card.querySelector('.pw-overlay');
  const info = card.querySelector('.pw-info');
  if (ov) ov.classList.remove('on');
  if (info) info.classList.remove('on');
}
function bindPwCard(card){
  const plot = card.querySelector('.pw-plot');
  if (!plot || plot._bound) return;
  plot._bound = true;
  let hideTimer = null;
  const ratioAt = e => {
    const chart = card.querySelector('.pw-chart');
    const rect = chart.getBoundingClientRect();
    return (e.clientX - rect.left) / Math.max(1, rect.width);
  };
  const tap = e => {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    pwShowPoint(card, ratioAt(e));
  };
  plot.addEventListener('pointerdown', e => {
    try { plot.setPointerCapture(e.pointerId); } catch (x) {}
    tap(e);
  });
  plot.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse' || (plot.hasPointerCapture && plot.hasPointerCapture(e.pointerId))) {
      e.preventDefault();
      tap(e);
    }
  });
  plot.addEventListener('pointerup', e => {
    if (e.pointerType === 'mouse') return;         /* 鼠标：离开曲线才收起 */
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { hideTimer = null; pwHidePoint(card); }, 3500);
  });
  plot.addEventListener('pointerleave', e => {
    if (e.pointerType === 'mouse') pwHidePoint(card);
  });
  /* 图表类型切换：客户想怎么看就怎么看，点一下即时换 */
  card.querySelectorAll('.pw-tabs span').forEach(tab => {
    tab.addEventListener('click', function () {
      const t = tab.dataset.t || 'line';
      if ((card.dataset.type || 'line') === t) return;
      card.dataset.type = t;
      card.querySelectorAll('.pw-tabs span').forEach(x => x.classList.toggle('on', x.dataset.t === t));
      const h = card.querySelector('.pw-h b');
      if (h) h.textContent = pwTypeTitle(t);
      pwHidePoint(card);
      pwRedrawCard(card);
    });
  });
}
/* 按卡片当前类型重绘图表（类型切换与实时刷新共用） */
function pwRedrawCard(card){
  if (!card || !card.isConnected) return;
  const type = card.dataset.type || 'line';
  const s = pwSeries(card.dataset.pid || '');
  const last = s.rows.length ? s.rows[s.rows.length - 1] : null;
  PW_SERIES.forEach(c => {
    const el = card.querySelector('.pw-' + c.key);
    if (el) el.textContent = pwValueText(c.key, last);
  });
  const ch = card.querySelector('.pw-chart');
  if (ch) ch.innerHTML = pwSVG(s.rows, type);
  if (type !== 'table' && card._pwRatio != null) pwShowPoint(card, card._pwRatio);
}

function showPowerCurveCard(q, intro){
  const st = pwScope(q);
  const type = pwChartType(q);
  const rows = st ? pwSeries(st.pid).rows : ((SIMAGG && SIMAGG.hist) || []);
  const en = curLang !== 'zh';
  const tn = en ? (PW_TYPE_EN[type] || 'line') : (PW_TYPE_NAME[type] || '曲线');
  const who = st ? (en ? st.name : '「' + st.name + '」') : T('当前所有电站', 'all plants');
  const head = intro || (en
    ? who + ' — PV, battery, load and grid power shown as a ' + tn + ', refreshing live from the simulator' +
      (type === 'line' ? '.' : ' (use the tabs above to switch to line / bar / area / table).')
    : who + '的光伏、储能、负载、电网功率，已用' + tn + '展示，会跟着仿真台实时刷新：' +
      (type === 'line' ? '' : '（上方标签可以随时换成曲线 / 柱状 / 面积 / 表格）'));
  let row;
  if (!rows.length) {
    row = addMsg('ai', head + (en
      ? '\n\nNo simulator data yet — open the "Simulator" page in the same browser and the chart will appear here.'
      : '\n\n现在还没收到仿真台数据，请在同一浏览器里打开「仿真电站」，图表会自动出现在这里。'));
    return row;
  }
  row = addMsgHTML('ai', '<div class="soc-intro">' + esc(head) + '</div>' + pwCardHTML(st ? st.pid : '', type));
  const b = row.querySelector('.bubble');
  if (b) b.classList.add('wide');
  const card = row.querySelector('.pw-card');
  if (card) { POWER_CARDS.push(card); bindPwCard(card); }
  return row;
}
/* 每秒跟着快照刷新卡片（卡片被清空后自动摘除） */
function refreshPowerCards(){
  if (!POWER_CARDS.length) return;
  for (let i = POWER_CARDS.length - 1; i >= 0; i--) {
    const card = POWER_CARDS[i];
    if (!card.isConnected) { POWER_CARDS.splice(i, 1); continue; }
    pwRedrawCard(card);
  }
}

/* ---------- 能量流图 ---------- */

/* ---------- 实时曲线 ---------- */
function simChartSVG(){
  const d = (SIMAGG && SIMAGG.hist) || [];
  const W = 404, H = 122, L = 30, R = W - 6, T = 8, B = 100;
  if (d.length < 2) return '<div style="color:#5f6675;font-size:12px;padding:20px 4px;text-align:center">采样中…</div>';
  let maxV = 40;
  d.forEach(p => { maxV = Math.max(maxV, p.pv, p.load, Math.abs(p.bat), Math.abs(p.grid)); });
  const yMax = Math.ceil(maxV / 40) * 40;
  const x = i => L + (R - L) * i / (d.length - 1);
  const y = v => B - (B - T) * Math.min(1, Math.abs(v) / yMax);
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '">';
  for (let i = 0; i <= 3; i++) {
    const gy = (T + (B - T) * i / 3).toFixed(1);
    s += '<line x1="' + L + '" y1="' + gy + '" x2="' + R + '" y2="' + gy + '" stroke="#262b36" stroke-width="1" stroke-dasharray="3 4"/>';
    s += '<text x="' + (L - 5) + '" y="' + (+gy + 3.5) + '" fill="#5f6675" font-size="9" text-anchor="end">' + Math.round(yMax * (1 - i / 3)) + '</text>';
  }
  const line = (key, color, w, dash) => {
    const pts = d.map((p, i) => x(i).toFixed(1) + ',' + y(p[key]).toFixed(1)).join(' ');
    return '<polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="' + w + '" stroke-linejoin="round"' + (dash ? ' stroke-dasharray="4 3"' : '') + '/>';
  };
  const area = d.map((p, i) => x(i).toFixed(1) + ',' + y(p.pv).toFixed(1)).join(' ');
  s += '<polygon points="' + L + ',' + B + ' ' + area + ' ' + R + ',' + B + '" fill="rgba(48,209,88,.12)"/>';
  s += line('pv', '#30d158', 2);
  s += line('load', '#0a84ff', 1.8);
  s += line('bat', '#ff9f0a', 1.5, true);
  s += line('grid', '#bf5af2', 1.2, true);
  return s + '</svg>';
}

/* ---------- 视图切换 ---------- */
function setTxt(id, v){ const el = document.getElementById(id); if (el) el.textContent = v; }


/* ---------- 把仿真数据推给 APP ---------- */
function syncLiveToApp(){
  ensureLiveStations();

  PLANTS.forEach((p, i) => {
    const s = stations[i];
    if (!s || s.pid !== p.id) return;
    s.power = p.pv;
    s.soc = p.soc;
    s.closed = !!p.closed;
    s.status = p.closed ? 'off' : (p.gridOut ? 'fault' : 'ok');
    s.kwp = p.cfg.pvKwp.toFixed(1) + ' kWp';
    s.day = p.dayPv.toFixed(2) + ' 度';
    s.total = ((p.totalBase + p.dayPv) / 10000).toFixed(2) + ' 万度';
    s.cap = p.cfg.pvKwp;
  });

  /* 账号级聚合 */
  let pvSum = 0, daySum = 0, totalSum = 0;
  const hourly = new Array(24).fill(0);
  PLANTS.forEach(p => {
    pvSum += p.pv;
    daySum += p.dayPv;
    totalSum += p.totalBase + p.dayPv;
    p.hourly.forEach((v, i) => { hourly[i] += v; });
  });

  /* 收益与货币来自仿真台快照（按国家电价计算） */
  const agg = SIMSTATE && SIMSTATE.agg ? SIMSTATE.agg : null;
  const curSym = agg ? agg.sym : '¥';
  const revVal = agg ? agg.revenue : daySum * 0.55;

  const power = pvSum.toFixed(2) + ' <i>kW</i>';
  const dayv  = daySum.toFixed(2) + ' <i>度</i>';
  const rev   = curSym + revVal.toFixed(2) + ' <i></i>';
  const tot   = (totalSum / 10000).toFixed(2) + ' <i>万度</i>';
  const kp = document.getElementById('k-power'); if (kp) kp.innerHTML = power;
  const kd = document.getElementById('k-day');   if (kd) kd.innerHTML = dayv;
  const kr = document.getElementById('k-rev');   if (kr) kr.innerHTML = rev;
  const kt = document.getElementById('k-total'); if (kt) kt.innerHTML = tot;

  STAT.power = pvSum.toFixed(2) + ' kW';
  STAT.day = daySum.toFixed(2) + ' 度';
  STAT.revenue = curSym + revVal.toFixed(2);
  STAT.total = (totalSum / 10000).toFixed(2) + ' 万度';
  STAT.updated = simDateText();

  /* 发电量统计（日） = 全场站逐小时合计 */
  STAT_DATA.day.vals = hourly.map(v => +v.toFixed(1));
  STAT_DATA.day.label = simDateText().slice(0, 10);
  const mx = Math.max(20, ...hourly);
  const step = mx > 4000 ? 2000 : mx > 1600 ? 1000 : mx > 800 ? 500 : mx > 400 ? 200 : mx > 160 ? 100 : mx > 60 ? 50 : 20;
  STAT_DATA.day.yMax = Math.ceil(mx / step) * step;
  STAT_DATA.day.yStep = step;

  /* 排名与小源数据 */
  syncRanks();

  /* APP 列表 */
  const hs = document.getElementById('home-station');
  if (hs && hs.style.display !== 'none' && curTab === 'home') renderStations();

  /* 设备实时行 */
  devices.forEach(d => {
    if (!d.live) return;
    const p = PLANTS.find(x => x.id === d.pid);
    if (!p) return;
    if (d.type === '逆变器') d.liveVal = (Number.isFinite(p.invTemp) ? '温度 ' + p.invTemp.toFixed(1) + ' ℃ · ' : '') + Math.min(p.pv, p.cfg.invKw).toFixed(1) + ' kW · ' + (p.pv > p.cfg.invKw ? '限功率运行' : 'MPPT 正常');
    else if (d.type === 'ESS') d.liveVal = (p.bat >= 0 ? '放电 ' : '充电 ') + Math.abs(p.bat).toFixed(1) + ' kW · SOC ' + p.soc.toFixed(0) + '%';
    else if (d.type === '电表') d.liveVal = (p.grid >= 0 ? '正向取电 ' : '反向上网 ') + Math.abs(p.grid).toFixed(1) + ' kW';
    else d.liveVal = '组串负载率 ' + (p.pv / p.cfg.pvKwp * 100).toFixed(0) + '%';
  });
  document.querySelectorAll('[data-dv]').forEach(el => {
    const d = devices.find(x => x.sn === el.dataset.dv);
    if (d && d.liveVal) el.textContent = d.liveVal;
  });

  const lc = document.getElementById('live-chart');
  if (lc && lc.offsetParent !== null) lc.innerHTML = simChartSVG();
  const stv = document.getElementById('stat-bars');
  if (stv && stv.offsetParent !== null && statMode === 'day') renderBars('day');

  refreshPowerCards();          /* 小源里的功率曲线卡同步刷新 */
  refreshPlantDetail();         /* 电站详情页开着时跟随刷新 */
  syncStationTags();            /* 列表标签（正常 / 断连）跟着电站开关状态走 */
}

/* 不重绘整个列表，只更新状态标签与实时功率，避免滑动/滚动被打断 */
function syncStationTags(){
  const rows = document.querySelectorAll('#station-list .sw-row');
  if (!rows.length) return;
  rows.forEach(row => {
    const s = stations[+row.dataset.i];
    if (!s) return;
    const tag = row.querySelector('.tag');
    if (tag) {
      const txt = s.status === 'ok' ? '正常' : (s.status === 'fault' ? '故障' : '断连');
      const cls = 'tag ' + (s.status === 'ok' ? 'ok' : (s.status === 'fault' ? 'fault' : 'off'));
      if (tag.textContent !== txt) tag.textContent = txt;
      if (tag.className !== cls) tag.className = cls;
    }
    const pw = row.querySelector('.st-power');
    if (pw && s.live) {
      const txt = '实时 ' + (s.power || 0).toFixed(2) + ' kW · SOC ' + (s.soc || 0).toFixed(0) + '%';
      if (pw.lastChild && pw.lastChild.nodeType === 3) {
        if (pw.lastChild.nodeValue !== txt) pw.lastChild.nodeValue = txt;
      }
    }
  });
}

function rankList(){
  const rows = PLANTS.map(p => ({
    name: p.name,
    v: p.cfg.pvKwp > 0 ? p.dayPv / p.cfg.pvKwp : 0,
    idx: stations.findIndex(s => s.name === p.name)
  }));
  ['西班牙户用','无业主主站升级','无业主电站','户用电站','工商业电站-App'].forEach(n => {
    rows.push({ name: n, v: 0, idx: stations.findIndex(s => s.name === n) });
  });
  rows.sort((a, b) => b.v - a.v);
  return rows.slice(0, 6);
}
function syncRanks(){
  const rows = rankList();
  RANKS.length = 0;
  rows.forEach(r => RANKS.push({ name: r.name, v: (r.v || 0).toFixed(2) }));
  if (typeof renderRank === 'function') renderRank();
}

/* ---------- 告警环形图 ---------- */
const DONUT_C = 2 * Math.PI * 44;
const LV_COLOR = { crit:'#ff453a', imp:'#ff9f0a', minor:'#ffd60a', hint:'#0a84ff' };
function renderAlarmSummary(){
  const c = { crit:0, imp:0, minor:0, hint:0 };
  alarms.forEach(a => { if (c[a.lv] != null) c[a.lv]++; });
  const total = alarms.length;
  let off = 0, segs = '';
  ['crit','imp','minor','hint'].forEach(k => {
    const len = DONUT_C * c[k] / Math.max(total, 1);
    if (len > 0.8) {
      segs += '<circle cx="52" cy="52" r="44" fill="none" stroke="' + LV_COLOR[k] + '" stroke-width="8" stroke-linecap="round" ' +
        'stroke-dasharray="' + len.toFixed(2) + ' ' + (DONUT_C - len).toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '"/>';
    }
    off += len;
  });
  const gEl = document.getElementById('donut-segs');
  if (gEl) gEl.innerHTML = segs;
  setTxt('donut-total', total);
  setTxt('ac-crit', c.crit);
  setTxt('ac-imp', c.imp);
  setTxt('ac-minor', c.minor);
  setTxt('ac-hint', c.hint);
}


/* ---------- APP 侧数据重建 ---------- */
function ensureLiveStations(){
  const liveN = stations.filter(s => s.live).length;
  const same = liveN === PLANTS.length && PLANTS.every((p, i) => stations[i] && stations[i].pid === p.id);
  if (!same) rebuildStations();
}
function rebuildStations(){
  const live = PLANTS.map(p => ({
    pid: p.id,
    name: p.name,
    addr: p.country + ' ' + p.city,
    status: p.closed ? 'off' : (p.gridOut ? 'fault' : 'ok'),
    closed: !!p.closed,
    geo: p.geo || null,
    socMin: p.socMin, socMax: p.socMax, start: p.start,
    kwp: p.cfg.pvKwp.toFixed(1) + ' kWp',
    day: p.dayPv.toFixed(2) + ' 度',
    total: ((p.totalBase + p.dayPv) / 10000).toFixed(2) + ' 万度',
    type: p.invKw >= 30 ? '工商业' : '户用',
    cap: p.cfg.pvKwp,
    cfg: ['储能'],
    date: p.created,
    country: p.country,
    tz: p.tz,
    live: true,
    power: p.pv,
    soc: p.soc
  }));
  stations.length = 0;
  live.forEach(s => stations.push(s));
  BASE_STATIONS.forEach(s => { if (!hiddenBase.has(s.name)) stations.push(Object.assign({}, s)); });
  if (typeof refreshChips === 'function') refreshChips();
  if (curTab === 'home') renderStations();
  if (typeof renderRank === 'function') renderRank();
  if (typeof updateScopeChip === 'function') updateScopeChip();
}
function rebuildDevices(){
  devices.length = 0;
  PLANTS.forEach(p => {
    devices.push(
      { name: 'SUN2000-' + Math.round(p.invKw) + 'KTL', st: p.name, sn: p.id + '-INV',    type: '逆变器', status: 'ok', live: true, liveVal: '--', pid: p.id },
      { name: 'ESS-' + p.cfg.batKwh + 'KWh',            st: p.name, sn: p.id + '-ESS',    type: 'ESS',   status: 'ok', sub: true, live: true, liveVal: '--', pid: p.id },
      { name: 'DTSU666-H 电表',                          st: p.name, sn: p.id + '-METER',  type: '电表',  status: 'ok', live: true, liveVal: '--', pid: p.id },
      { name: 'SUN2000-450W-P',                          st: p.name, sn: p.id + '-OPT',    type: '优化器', status: 'ok', live: true, liveVal: '--', pid: p.id }
    );
  });
  BASE_DEVICES.forEach(d => devices.push(Object.assign({}, d)));
  if (curTab === 'dev') renderDevices();
}

function refreshChips(){
  const n = f => stations.filter(s => f === 'all' || s.status === f).length;
  document.querySelectorAll('.chip').forEach(c => {
    const el = c.querySelector('.n');
    if (el) el.textContent = n(c.dataset.f);
  });
}


/* ---------- 读取仿真台快照并应用（simulator.html 每 1.5s 发布一次） ---------- */
function mergeSimAlarms(list){
  const seen = new Set((list || []).map(a => a.title + '|' + a.st + '|' + a.t));
  alarms.length = 0;
  (list || []).forEach(a => alarms.push(a));
  BASE_ALARMS.forEach(a => { if (!seen.has(a.title + '|' + a.st + '|' + a.t)) alarms.push(a); });
  renderAlarms();
  const aside = 0;
}

async function loadSimState(){
  let data;
  try { data = await AppBridge.state(); } catch { updateBridgeTip(); return; }
  if (!data || !Array.isArray(data.plants)) { updateBridgeTip(); return; }
  if (data.v !== 3 && data.v !== 2) return;
  if (data.v === 2) normalizeSnapshotV2(data);
  if (SIMSTATE && SIMSTATE.ts === data.ts && SIMSTATE.viewRevision === data.viewRevision) { updateBridgeTip(); return; }
  SIMSTATE = data;
  TIME.t = data.time.utc != null ? data.time.utc / 60000 : 0;
  TIME.day = data.time.day;
  TIME.speed = data.time.speed; TIME.running = data.time.running;
  SIMAGG = data.agg;
  PLANTS.length = 0;
  data.plants.forEach(pd => PLANTS.push(pd));
  mergeSimAlarms(data.alarms || []);
  ensureLiveDevices();
  syncLiveToApp();
  if (curTab === 'ops') renderAlarms();
  updateBridgeTip();
}

/* 旧版（v2）快照补齐字段，保证 APP 侧渲染不因缺字段而中断 */
function normalizeSnapshotV2(d){
  d.v = 3;
  d.time = d.time || {};
  if (d.time.utc == null) d.time.utc = d.time.t != null ? d.time.t * 60000 : Date.now();
  if (d.time.day == null) d.time.day = 1;
  if (d.time.speed == null) d.time.speed = 60;
  if (d.time.running == null) d.time.running = true;
  if (d.time.clock == null) d.time.clock = '';
  if (d.time.dateText == null) d.time.dateText = '';
  if (d.time.tz == null) d.time.tz = 'Asia/Shanghai';
  if (d.time.tzLabel == null) d.time.tzLabel = '';
  const agg = d.agg || (d.agg = {});
  if (!agg.cur) agg.cur = 'CNY';
  if (!agg.sym) agg.sym = '¥';
  if (agg.revenue == null) agg.revenue = 0;
  if (agg.totalRev == null) agg.totalRev = 0;
  if (agg.hourly == null) agg.hourly = new Array(24).fill(0);
  if (agg.hist == null) agg.hist = [];
  if (agg.soc == null) agg.soc = 0;
  if (agg.totalKwh == null) agg.totalKwh = 0;
  d.alarms = d.alarms || [];
  d.plants.forEach(p => {
    if (!p.tariff) p.tariff = { cur: agg.cur, sym: agg.sym, retail: 0.62, fit: 0.35 };
    if (!p.cfg) p.cfg = {};
    if (p.type == null) p.type = (p.invKw >= 30 ? 'ci' : 'res');
    if (p.mode == null) p.mode = 'surplus';
    if (p.ratio == null) p.ratio = (p.cfg.pvKwp && p.invKw) ? p.cfg.pvKwp / p.invKw : 1.2;
    if (p.gridOut == null) p.gridOut = false;
    ['demand','shed','curtail','dayRev','daySelf','totalRev','batTemp'].forEach(k => { if (p[k] == null) p[k] = 0; });
    if (!p.loadScale) p.loadScale = 1;
    if (!p.hourly) p.hourly = new Array(24).fill(0);
    if (!p.events) p.events = [];
  });
}

/* ---------- 分享链接带上访问参数 sharecode 才能打开，页面间跳转必须原样透传 ---------- */
function shareQuery(){
  let q = location.search || '';
  /* 体验参数只对 APP 首页有意义，跳仿真台时剥掉，保持链接干净 */
  q = q.replace(/[?&](exp|intro)=1/g, '').replace(/^&/, '?').replace(/^\?&/, '?');
  try {
    const m = q.match(/[?&]sharecode=([^&]+)/);
    if (m) localStorage.setItem('fs_sharecode', m[1]);
    else {
      const s = localStorage.getItem('fs_sharecode');
      if (s) q = '?sharecode=' + s;
    }
  } catch (e) {}
  return q;
}
function simPageUrl(hash){ return '/manage/' + (hash || ''); }

/* 建站向导：真正打开仿真台的创建页（APP 只做监控，建站在仿真台完成） */
function openWizard(){ toast('创建电站请使用独立仿真管理端'); }
function openPlantPage(){
  try { window.open(simPageUrl(), '_blank'); } catch (e) {}
}

/* 仿真台连接状态提示：让“没数据/数据停了”这件事可见，而不是静默 */
function updateBridgeTip(){
  const el = document.getElementById('bridge-tip'); if (!el) return;
  const age = SIMSTATE ? Math.max(0, Date.now() - SIMSTATE.ts) : 0;
  if (!SIMSTATE) { el.className = 'bridge-tip'; el.textContent = AppBridge.connectionError ? '共享服务连接失败，请稍后刷新：' + AppBridge.connectionError : '等待管理端发布电站数据，连接后将自动显示。'; el.style.display = 'flex'; }
  else if (age > 15000) { el.className = 'bridge-tip stale'; el.textContent = '管理端数据已停更 ' + Math.round(age / 1000) + ' 秒，当前显示最后快照。'; el.style.display = 'flex'; }
  else el.style.display = 'none';
}

function ensureLiveDevices(){
  const liveN = devices.filter(d => d.live).length;
  if (liveN !== PLANTS.length * 4) rebuildDevices();
}

rebuildDevices();              /* 先建预置设备，首次快照随后重建出实时设备 */
loadSimState();
if (!PLANTS.length) { rebuildStations(); mergeSimAlarms([]); }
updateBridgeTip();
setInterval(loadSimState, 1000);
setInterval(checkSimAck, 900);
setInterval(updateBridgeTip, 2500);
try { window.addEventListener('storage', e => { if (false) loadSimState(); }); } catch (e) {}


/* hash 直达视图（演示/测试用）：#stat 统计 / #dev 设备 / #ops 运维 */
if (location.hash === '#stat') switchHome('stat');
else if (location.hash === '#dev') go('dev');
else if (location.hash === '#ops') go('ops');
else if (location.hash === '#xiaoyuan') openXY();

renderStations('all'); renderAlarms(); renderDevices(); renderSugs(); renderBars('day'); renderRank(); updateScopeChip(); initializeAI();
refreshChips(); renderAlarmSummary();
document.querySelectorAll('.fchip').forEach(c => c.addEventListener('click', () => pickF(c)));

/* ============ 分享体验引导：仅首次访问（本地没有任何仿真数据）时出现 ============ */
/* 朋友带 #p=<base64> 打开时：把电站数据交给仿真台，并以「演示模式」运行（独立存储，不动本机数据） */
const SHARE_KEY = 'fs_sim_share_v1';
let SHARE_PLANTS = null;
function b64uDecode(t){
  try {
    const b = t.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(b + '==='.slice((b.length + 3) % 4))));
  } catch (e) { return ''; }
}
function parseSharePlant(){
  const m = /(?:^|[#&])p=([A-Za-z0-9\-_]+)/.exec(location.hash || '');
  if (!m) return null;
  let list = null;
  try { list = JSON.parse(b64uDecode(m[1])); } catch (e) { list = null; }
  if (!Array.isArray(list) || !list.length) return null;
  try { localStorage.setItem(SHARE_KEY, JSON.stringify({ t: Date.now(), list: list })); } catch (e) {}
  return list;
}
SHARE_PLANTS = parseSharePlant();

function introHasLocalSim(){
  try {
    if (localStorage.getItem('fs_intro_done') === '1') return true;
    return !!localStorage.getItem(SIM_KEY)
        || !!localStorage.getItem('fs_sim_plants_v2')
        || !!localStorage.getItem('fs_sim_state_v2');
  } catch (e) { return true; }   /* 读不到存储就当作老用户，不打扰 */
}
/* 分享链接的欢迎卡：直接告诉对方「朋友分享给你的是哪座电站」 */
function introApplyShare(){
  const p = SHARE_PLANTS[0] || {};
  const name = p.n || '光储仿真电站';
  const extra = SHARE_PLANTS.length > 1 ? ' 等 ' + SHARE_PLANTS.length + ' 座电站' : '';
  const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
  set('intro-badge', '朋友分享给你 · 光储电站演示');
  set('intro-h2', '朋友分享了「' + escHtml(name) + '」<br>带你看看实时运行');
  set('intro-desc', '这是一座真实配置的仿真电站，参数（地点、装机、容配比、电价、储能）都已随链接带过来，打开就能看到它按当地时间实时发电、储能充放、负载用电。');
  set('intro-list',
    '<li><i>1</i><span>点下面按钮打开仿真电站，「' + escHtml(name) + '」' + extra + ' 会自动开始运行</span></li>' +
    '<li><i>2</i><span>切回本页（仿真台开在新标签），这里的功率、收益、设备状态会跟着实时同步</span></li>' +
    '<li><i>3</i><span>想看懂了就问右下角「小源」：功率曲线点一下还能看到每一刻的充放电逻辑</span></li>');
  set('intro-note', '这是只读演示环境：数据存在独立的演示空间，不会动到你自己建的电站。想退出演示，点仿真台顶部的「看我的电站」。');
  set('intro-go', '打开仿真电站看这座站 ›');
}
function escHtml(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
}
function introShow(){}
function introGoSim(){
  try { localStorage.setItem('fs_intro_done', '1'); } catch (e) {}
  let w = null;
  try { w = window.open(simPageUrl(), '_blank'); } catch (e) {}
  if (w) {
    introDismiss();
    toast('仿真电站已在新标签打开，切回本页即可看到实时数据');
  } else {
    location.href = simPageUrl();   /* 弹窗被拦截时退回当前标签跳转 */
  }
}
function introDismiss(){
  try { localStorage.setItem('fs_intro_done', '1'); } catch (e) {}
  const el = document.getElementById('share-intro');
  if (el) el.classList.remove('show');
}
/* 体验链接参数：
   ?intro=1 → 无条件强制显示引导层（自己测效果用）
   ?exp=1   → 发给朋友的体验链接：只要这台设备还没看过引导，就一定弹出（避免对方浏览器里有旧数据被跳过）*/
if (SHARE_PLANTS) { introApplyShare(); introShow(); }
else if (/[?&]intro=1/.test(location.search)) introShow();
else if (/[?&]exp=1/.test(location.search)) {
  let done = '1';
  try { done = localStorage.getItem('fs_intro_done'); } catch (e) {}
  if (done !== '1') introShow();
}
else setTimeout(function(){ if (!introHasLocalSim()) introShow(); }, 500);
