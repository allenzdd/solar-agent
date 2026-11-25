import fs from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const metrics = ['dayPv', 'dayLoad', 'dayImp', 'dayExp', 'dayChg', 'dayDis', 'dayRev', 'daySelf'];
const round = n => Math.round(n * 1000000) / 1000000;
// City-centre approximations for these demonstration stations, not real site coordinates.
const cities = { 济宁: { lat: 35.41, lng: 116.59 }, 苏州: { lat: 31.3, lng: 120.6 }, 三亚: { lat: 18.25, lng: 109.5 } };
export function rollingWindow(asOf, days = 90) {
  const end = typeof asOf === 'number' ? asOf : Date.parse(asOf);
  if (!Number.isFinite(end) || !Number.isInteger(days) || days < 1 || days > 365) throw new Error('Invalid rolling history window');
  const local = new Date(end + 8 * 3600000).toISOString().slice(0, 10);
  const todayStart = Date.parse(local + 'T00:00:00+08:00'), start = todayStart - (days - 1) * 86400000;
  return { start, end, window: { kind: 'rolling-days', days, asOf: new Date(end).toISOString(), startDate: new Date(start + 8 * 3600000).toISOString().slice(0, 10), endDate: local, timezone: 'Asia/Shanghai' } };
}
export async function simulateHistory(configs, { start, end, stepMinutes = 5, initialSocByPlant = {} } = {}) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || (end - start) > 370 * 86400000 || ![1, 5, 10, 15].includes(stepMinutes)) throw new Error('Invalid history interval');
  const source = await fs.readFile(new URL('../public/js/simulator.js', import.meta.url), 'utf8');
  const cut = source.indexOf('function simEvent('); if (cut < 0) throw new Error('Simulator core boundary missing');
  const context = vm.createContext({});
  vm.runInContext(source.slice(0, cut) + '\nglobalThis.engine = { makePlant, simStepPlant, localTime, SIMTIME };', context);
  const engine = context.engine, datasets = [];
  for (const config of configs) {
    if (config.useLoadFile || config.loadTable) throw new Error('Uploaded load curve requires an explicit history adapter: ' + config.id);
    if (config.country !== '中国') throw new Error('This batch expects China-station calendar boundaries');
    engine.SIMTIME.utc = start;
    const p = engine.makePlant(config);
    p.id = config.id; p.seed = config.seed || 1;
    Object.assign(p, { cloud: config.cloud ?? .25, loadScale: config.loadScale ?? 1, batMode: config.batMode || 'auto', gridOut: !!config.gridOut });
    p.geo = cities[String(config.city).replace(/市$/, '')] || p.geo;
    const initialSoc = initialSocByPlant[config.id] ?? 50;
    if (!Number.isFinite(initialSoc) || initialSoc < p.socMin || initialSoc > p.socMax) throw new Error('Invalid initial SOC: ' + config.id);
    p.totalBase = 0; p.totalRev = 0; p.soc = initialSoc;
    const months = new Map();
    let lastDay = null;
    for (let utc = start; utc < end;) {
      // A resumed partial interval must stop at the next grid boundary, never cross an hour/day.
      const next = Math.min(end, (Math.floor(utc / (stepMinutes * 60000)) + 1) * stepMinutes * 60000);
      const dt = (next - utc) / 60000;
      engine.SIMTIME.utc = utc;
      const lt = engine.localTime(p.tz, utc), date = lt.date.replaceAll('/', '-'), month = date.slice(0, 7), hour = lt.hh;
      let record = months.get(month);
      if (!record) { record = { month, startUtc: utc, endUtc: utc, steps: 0, totals: {}, daily: [], hourly: [] }; months.set(month, record); }
      if (!lastDay || lastDay.date !== date) { lastDay = { date, totals: {}, socMin: p.soc, socMax: p.soc }; record.daily.push(lastDay); }
      let cell = record.hourly.at(-1);
      if (!cell || cell.date !== date || cell.hour !== hour) { cell = { utc, date, hour, minutes: 0, totals: {} }; record.hourly.push(cell); }
      const oldKey = p.dayKey, before = Object.fromEntries(metrics.map(k => [k, p[k]]));
      engine.simStepPlant(p, dt, true, utc, true);
      for (const k of metrics) {
        const delta = p[k] - (oldKey === p.dayKey ? before[k] : 0);
        if (!Number.isFinite(delta) || delta < -1e-6) throw new Error('Invalid integrated energy: ' + config.id + ' ' + k);
        const value = Math.max(0, delta);
        record.totals[k] = (record.totals[k] || 0) + value;
        lastDay.totals[k] = (lastDay.totals[k] || 0) + value;
        cell.totals[k] = (cell.totals[k] || 0) + value;
      }
      if (p.soc < p.socMin - 1e-8 || p.soc > p.socMax + 1e-8) throw new Error('SOC out of range');
      lastDay.socMin = Math.min(lastDay.socMin, p.soc); lastDay.socMax = Math.max(lastDay.socMax, p.soc);
      cell.invTempStart ??= round(p.invTemp); cell.invTempEnd = round(p.invTemp); cell.invTempMax = Math.max(cell.invTempMax ?? -Infinity, round(p.invTemp));
      cell.minutes += dt; cell.socEnd = p.soc; cell.pvKwAvg = cell.totals.dayPv / (cell.minutes / 60);
      record.steps++; record.endUtc = next; utc = next;
    }
    for (const record of months.values()) {
      for (const object of [record, ...record.daily, ...record.hourly]) {
        for (const k of metrics) object.totals[k] = round(object.totals[k] || 0);
        for (const k of ['socEnd', 'socMin', 'socMax', 'pvKwAvg']) if (object[k] !== undefined) object[k] = round(object[k]);
      }
      const [year, month] = record.month.split('-').map(Number);
      const monthStart = Date.UTC(year, month - 1, 1) - 8 * 3600000, monthEnd = Date.UTC(year, month, 1) - 8 * 3600000;
      for (const day of record.daily) day.complete = record.endUtc >= Date.parse(day.date + 'T00:00:00+08:00') + 86400000;
      datasets.push({ ...record, completeMonth: record.startUtc === monthStart && record.endUtc === monthEnd, plantId: p.id, plantName: p.name, city: p.city, timezone: p.tz, geo: p.geo, cfg: p.cfg,
        tariff: p.tariff, seed: p.seed, stepMinutes, initialSoc, simulation: true,
        method: '现有光伏/负载/储能模型，按仿真时间积分；模型天气，城市中心近似坐标，非真实历史观测。' });
    }
  }
  return { version: 1, generatedAt: Date.now(), start, end, configs, datasets };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [input, output, asOf = new Date().toISOString(), mode = 'rolling90'] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node scripts/simulate-history.mjs INPUT.json OUTPUT.json [AS_OF_ISO] [rolling90|calendar-months]');
  const configs = JSON.parse(await fs.readFile(input, 'utf8'));
  const [year, month] = asOf.split('-').map(Number);
  const range = mode === 'rolling90' ? rollingWindow(asOf) : { end: Date.UTC(year, month - 1, 1) - 8 * 3600000, start: Date.UTC(year, month - 4, 1) - 8 * 3600000 };
  const result = await simulateHistory(configs, range);
  if (range.window) result.window = range.window;
  await fs.writeFile(output, JSON.stringify(result));
  console.log(JSON.stringify(result.datasets.map(d => ({ station: d.plantName, month: d.month, days: d.daily.length, hours: d.hourly.length, steps: d.steps, pvKwh: d.totals.dayPv, revenue: d.totals.dayRev })), null, 2));
}
