// Deterministic rules over authenticated simulator snapshots. No model or weather API required.
import { applyInverterDrill } from './inverter-drill.mjs';
import { inverterRisk } from './inverter-risk.mjs';
const minute = 60000;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const numeric = value => finite(value) ? Math.max(0, value) : 0;
const round = value => Math.round(value * 100) / 100;
const metrics = ['dayPv', 'dayLoad', 'dayImp', 'dayExp', 'dayChg', 'dayDis', 'dayRev', 'daySelf'];
function calendar(utc, tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(utc);
    const get = type => parts.find(p => p.type === type).value;
    return `${get('year')}-${get('month')}-${get('day')}`;
  } catch { return new Date(utc).toISOString().slice(0, 10); }
}
function state(document) {
  return document.assistant ||= { version: 1, events: [], plants: {}, scenarios: {} };
}
function upsert(a, id, data, now) {
  let event = a.events.find(e => e.id === id);
  if (!event) { event = { id, createdAt: now, status: 'active', ...data }; a.events.push(event); }
  else Object.assign(event, data);
  event.updatedAt = now;
  return event;
}
function settle(a, pid, type, now) {
  for (const e of a.events) if (e.plantId === pid && e.type === type && e.status === 'active') {
    e.status = 'recovered'; e.updatedAt = now;
  }
}
function report(a, p, month, record, simUtc, now) {
  const totals = Object.fromEntries(metrics.map(k => [k, round(record.values[k] || 0)]));
  const report = { month, observedFrom: record.first, observedUntil: record.last, samples: record.samples, totals,
    selfUsePercent: totals.dayPv > 0 ? round(Math.min(100, totals.daySelf / totals.dayPv * 100)) : null,
    currency: p.tariff?.sym || '¥', partial: true };
  upsert(a, `month:${p.id}:${month}`, { plantId: p.id, plantName: p.name, type: 'monthly', level: 'info', simulation: true,
    simUtc, title: `${month} 月度运营报告`,
    summary: `${p.name}的仿真月报已生成。已观测发电 ${totals.dayPv.toLocaleString('zh-CN')} kWh，收益 ${report.currency}${totals.dayRev.toLocaleString('zh-CN')}。`,
    advice: '报告基于服务端收到的快照增量，不补算缺失时段；请查看观测范围后评估发电、自用和储能表现。', report }, now);
}
export function evaluateReminders(document, snapshot, now = Date.now()) {
  const utc = snapshot?.time?.utc;
  if (!finite(utc) || Math.abs(utc) > 8640000000000000) return;
  const a = state(document);
  const ids = new Set(snapshot.plants.map(p => p.id));
  for (const id of Object.keys(a.plants)) if (!ids.has(id)) { delete a.plants[id]; delete a.scenarios[id]; }
  a.events = a.events.filter(e => ids.has(e.plantId));
  for (const p of snapshot.plants) {
    const ps = a.plants[p.id] ||= { months: {}, previous: null, heatSince: null, episode: 0 };
    const date = calendar(utc, p.tz), month = date.slice(0, 7);
    const prev = ps.previous;
    // Clock rewind resets tracking, never fabricates a month-end report or negative energy.
    if (prev && utc < prev.utc) { ps.previous = null; ps.heatSince = null; ps.months = {}; settle(a, p.id, 'temperature', now); }
    const previous = ps.previous;
    if (previous && month > previous.month) {
      const old = ps.months[previous.month];
      if (old) report(a, p, previous.month, old, utc, now);
    }
    const record = ps.months[month] ||= { first: utc, last: utc, samples: 0, values: {} };
    if (!previous || utc > previous.utc) {
      // First observation establishes a baseline; start counting only subsequent positive deltas.
      for (const k of metrics) {
        const value = numeric(p[k]);
        const delta = previous ? (previous.date === date ? Math.max(0, value - previous.values[k]) : value) : 0;
        record.values[k] = round((record.values[k] || 0) + delta);
      }
      record.last = utc; record.samples++;
      ps.previous = { utc, date, month, values: Object.fromEntries(metrics.map(k => [k, numeric(p[k])])) };
    }
    // Keep bounded aggregates; reports and events survive process restarts in the workspace store.
    for (const old of Object.keys(ps.months).sort().slice(0, -3)) delete ps.months[old];
    let scenario = a.scenarios[p.id];
    if (scenario && (now > scenario.expiresAt || utc > scenario.untilUtc || utc < scenario.startUtc)) {
      delete a.scenarios[p.id]; scenario = null;
    }
    const temperature = scenario?.type === 'heat' ? 43 : p.batTemp;
    if (finite(temperature) && temperature >= 38 && !p.closed) {
      if (ps.heatSince === null) ps.heatSince = utc;
      const urgent = temperature >= 45;
      if (urgent || utc - ps.heatSince >= 10 * minute) {
        let active = a.events.find(e => e.plantId === p.id && e.type === 'temperature' && e.status === 'active');
        if (!active) ps.episode++;
        upsert(a, active?.id || `heat:${p.id}:${ps.episode}:${utc}`, { plantId: p.id, plantName: p.name, type: 'temperature',
          level: urgent ? 'urgent' : 'warning', simulation: true, demo: scenario?.type === 'heat', simUtc: utc,
          title: urgent ? '储能温度达到演示高温阈值' : '储能温度持续偏高',
          summary: `${p.name}储能电池温度 ${round(temperature)}℃${urgent ? '' : '，持续达到或超过 38℃ 已满 10 个仿真分钟'}。`,
          advice: '建议检查环境温度、通风及散热系统；若发现积尘，按维护规程安排人员清理。演示阈值为 38℃ / 45℃，真实设备应使用厂家阈值；不要自行打开带电设备。',
          evidence: { temperature: round(temperature), durationMinutes: Math.floor((utc - ps.heatSince) / minute), warningThreshold: 38, urgentThreshold: 45 } }, now);
      }
    } else {
      ps.heatSince = null;
      if (!finite(temperature) || temperature < 36 || p.closed) settle(a, p.id, 'temperature', now);
    }
    const inverterDrill=scenario?.type === 'inverter_heat';
    const risk = inverterDrill ? inverterRisk(ps,p,utc) : null;
    if(!inverterDrill) ps.inverterSamples=[];
    if(risk) risk.demo=true;
    if (risk) {
      const active = a.events.find(e => e.plantId === p.id && e.type === 'inverter-risk' && e.status === 'active');
      const reached = risk.currentC >= risk.thresholdC;
      upsert(a, active?.id || 'inverter:' + p.id + ':' + utc, { plantId:p.id, plantName:p.name, deviceId:p.id+'-INV', type:'inverter-risk', level:reached?'urgent':'warning', simulation:true, demo:risk.demo, simUtc:utc,
        title: reached ? '逆变器温度已达演示高温阈值' : '发现 1 个设备存在过热风险',
        summary:p.name+' · 逆变器 '+p.id+'-INV 当前 '+risk.currentC+'℃。'+(reached?'已达到 70℃ 演示阈值。':'温度持续上升，若保持当前趋势，预计约 '+risk.etaMinutes+' 个仿真分钟后达到 70℃ 演示阈值。'),
        advice:'建议优先检查通风、风扇及散热片积尘，核查环境温度、负载与同型号设备温差。散热不良、积尘或风扇异常均为待排查原因，尚未诊断确认。由合格人员按停电维护规程处理；处理后观察温度趋势是否回落。70℃ 为演示阈值，实际以厂家规范为准。',
        risk, evidence:{deviceId:p.id+'-INV',temperature:risk.currentC,rateCPerMinute:risk.rateCPerMinute,sampleCount:risk.sampleCount,observedMinutes:risk.observedMinutes,threshold:risk.thresholdC,etaMinutes:risk.etaMinutes}
      },now);
    } else settle(a,p.id,'inverter-risk',now);
    if (scenario?.type === 'typhoon') {
      const dateText = calendar(scenario.startUtc + 86400000, p.tz);
      upsert(a, `weather:${p.id}:${scenario.id}`, { plantId: p.id, plantName: p.name, type: 'weather', level: 'warning',
        simulation: true, demo: true, simUtc: utc, expiresSimUtc: scenario.untilUtc, title: '台风风险演练 · 建议预留备用电',
        summary: `${p.name}：模拟预警日期 ${dateText}，建议提前检查应急负载及备用电量。当前 SOC ${round(numeric(p.soc))}%。`,
        advice: '这是管理端触发的仿真天气事件，不是真实气象预报。可结合重要负载与预计停电时长评估备用电目标；提高备用比例可能减少套利电量。调整策略需用户确认，本提醒不会自动控制设备。' }, now);
    } else settle(a, p.id, 'weather', now);
    for (const e of a.events) if (e.plantId === p.id) e.plantName = p.name;
  }
  a.events.sort((x, y) => y.createdAt - x.createdAt);
  a.events = a.events.slice(0, 200);
}
export function reminderFeed(document, now = Date.now()) {
  const snapshot = document?.snapshot;
  const utc = snapshot?.time?.utc || 0;
  const stale = !snapshot || now - snapshot.ts > 30000;
  const events = (document?.assistant?.events || []).map(e => ({ ...e,
    status: e.status === 'active' && e.type === 'weather' && (utc > e.expiresSimUtc || now > e.createdAt + 1800000) ? 'recovered' : e.status,
  }));
  return { events, stale, updatedAt: snapshot?.ts || null, simUtc: utc,
    notice: '仿真提醒 · 温度为演示阈值，天气尚未接入真实预警；月报为观测汇总。' };
}
export function setReminderScenario(document, input, now = Date.now(), history = null) {
  const p = document.snapshot?.plants.find(p => p.id === input.plantId);
  if (!p || !['heat', 'inverter_heat', 'typhoon', 'clear', 'saving', 'monthly_report', 'storage_upgrade', 'weather_backup'].includes(input.type)) throw Object.assign(new Error('请选择现有电站和有效演练类型'), { status: 400 });
  const a = state(document), utc = document.snapshot.time.utc;
  if (!finite(utc)) throw Object.assign(new Error('仿真时钟尚未就绪'), { status: 409 });
  if (['saving', 'monthly_report', 'storage_upgrade', 'weather_backup'].includes(input.type)) {
    const type = {saving:'saving-opportunity',monthly_report:'monthly',storage_upgrade:'storage-upgrade',weather_backup:'weather-backup'}[input.type];
    // A new event ID makes replay independent of the viewer's previously handled state.
    settle(a,p.id,type,now);
    const event = {plantId:p.id,plantName:p.name,type,level:input.type==='weather_backup'?'warning':'info',simulation:true,demo:true,simUtc:utc};
    if (input.type === 'saving') Object.assign(event,{title:'小源发现一个省钱机会',summary:'峰谷电价存在优化空间，建议评估谷充峰放策略。',advice:'按假设电价与负载生成方案，确认后仅模拟应用，不下发设备控制。'});
    if (input.type === 'storage_upgrade') Object.assign(event,{title:'发现 1 个电站有增购储能空间',summary:'光伏余电可通过增配储能提高自用比例，建议比较扩容前后表现。',advice:'扩容容量、收益与自用率为演示方案假设。点击查看方案可以模拟提交咨询，不会真实下单或扣费。',upgrade:{addKwh:10,beforeAnnual:11500,afterAnnual:14700,beforeSelf:62,afterSelf:78}});
    if (input.type === 'weather_backup') Object.assign(event,{title:'明天台风风力较大，建议多留一些备用电',summary:'模拟天气风险：建议今晚提前蓄电，为明天重要负载预留电量。',advice:'这是管理端触发的演示，不是真实天气预报。可先评估备用电方案，确认后仅模拟应用。',backup:{beforeReserve:20,afterReserve:60,wind:'8–9 级',hours:'10:00–16:00'}});
    if (input.type === 'monthly_report') {
      const current=calendar(now,'Asia/Shanghai'),first=Date.parse(current.slice(0,7)+'-01T00:00:00+08:00'),month=calendar(first-86400000,'Asia/Shanghai').slice(0,7);
      const d=history?.datasets?.find(d=>d.plantId===p.id&&d.month===month);
      const prior=a.events.find(e=>e.plantId===p.id&&e.report?.month===month);
      let r=d?{month,observedFrom:d.startUtc,observedUntil:d.endUtc-1,samples:d.steps,totals:d.totals,selfUsePercent:d.totals.dayPv?round(d.totals.daySelf/d.totals.dayPv*100):null,currency:d.tariff?.sym||'¥',partial:!d.completeMonth,historical:true,stepMinutes:d.stepMinutes||5,daily:d.daily,method:d.method}:prior?.report;
      if(!r){const totals={dayPv:128600,dayLoad:132000,dayImp:31174,dayExp:27774,dayChg:28000,dayDis:26000,dayRev:62700,daySelf:100826};r={month,observedFrom:Date.parse(month+'-01T00:00:00+08:00'),observedUntil:first-1,samples:1,totals,selfUsePercent:78.4,currency:'¥',partial:false,historical:true,demoFixture:true,method:'固定演示样例，非该电站历史统计，不用于结算。'};}
      Object.assign(event,{title:'上月运营报告已生成',summary:`${r.month} 运营报告已准备好，可查看发电量、收益和自用率。`,advice:r.demoFixture?'本报告使用固定演示样例，非该电站历史统计。':'本报告来自已保存的模型仿真历史，非真实电站结算。',report:structuredClone(r)});
    }
    upsert(a,`demo:${type}:${p.id}:${now}:${a.events.length}`,event,now);
    a.events.sort((x,y)=>y.createdAt-x.createdAt);a.events=a.events.slice(0,200);
    return;
  }
  if (input.type === 'clear') {
    delete a.scenarios[p.id]; settle(a, p.id, 'inverter-risk', now); settle(a, p.id, 'temperature', now); settle(a, p.id, 'weather', now);
    if (a.plants[p.id]) a.plants[p.id].heatSince = null;
    for(const e of a.events) if(e.plantId===p.id&&e.status==='active'&&e.demo){e.status='archived';e.updatedAt=now;}
  } else {
    a.scenarios[p.id] = { id: String(now), type: input.type, startUtc: utc, untilUtc: utc + 86400000, expiresAt: now + 1800000 };
    if (input.type === 'heat') { const ps = a.plants[p.id] ||= { months: {}, previous: null, episode: 0 }; ps.heatSince = utc - 10 * minute; }
  }
  if(a.plants[p.id]) a.plants[p.id].inverterSamples=[];
  document.snapshot=applyInverterDrill(document,document.snapshot,now);
  evaluateReminders(document, document.snapshot, now);
}

export function resetReminders(document, now = Date.now()) {
  const a = state(document);
  a.scenarios = {};
  for (const p of Object.values(a.plants)) {p.heatSince=null;p.inverterSamples=[];}
  if(document.config) document.config=document.config.map(p=>({...p,inverterThermal:null}));
  document.snapshot=applyInverterDrill(document,document.snapshot,now);
  let count = 0;
  for (const event of a.events) if (event.status === 'active') {
    event.status = 'archived'; event.updatedAt = now; count++;
  }
  // Preserve event IDs, report attachments, running snapshots and month baselines.
  return count;
}
