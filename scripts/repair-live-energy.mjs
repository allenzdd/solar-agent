// Run while the application is stopped. Rebuild PV counters at the saved simulation instant.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createFileWorkspaceStore } from '../server/file-store.mjs';
import { simulateHistory } from './simulate-history.mjs';
import { enrichEnergySnapshot } from '../server/energy.mjs';
const directory = process.argv[2]; if (!directory) throw new Error('DATA_DIR is required');
const store = createFileWorkspaceStore(directory), document = await store.read('workspace'), oldHistory = await store.read('history');
const utc = document?.snapshot?.time?.utc;
if (!Number.isFinite(utc) || !oldHistory?.window || !document.config?.length) throw new Error('Saved runtime and history are required');
const date = new Date(utc + 8 * 3600000).toISOString().slice(0, 10);
if (date !== oldHistory.window.endDate) throw new Error('Saved simulation date differs from the history end date; refusing to apply another day\'s energy.');
const backup = path.join(directory, 'energy-backup-' + Date.now()); await fs.mkdir(backup, { mode: 0o700 });
for (const [key, data] of [['workspace', document], ['history', oldHistory]]) await fs.writeFile(path.join(backup, key + '.json'), JSON.stringify(data), { mode: 0o600 });
const history = await simulateHistory(document.config, { start: oldHistory.start, end: utc });
history.window = { ...oldHistory.window, asOf: new Date(utc).toISOString() };
const fields = ['dayPv','dayLoad','dayImp','dayExp','dayChg','dayDis','dayRev','daySelf'];
const changed = [];
for (const p of document.snapshot.plants) {
  const records = history.datasets.filter(d => d.plantId === p.id), days = records.flatMap(d => d.daily);
  const today = days.find(d => d.date === date); if (!today) throw new Error('Today missing from history: ' + p.id);
  changed.push({ plant: p.name, beforePvKwh: p.dayPv, afterPvKwh: today.totals.dayPv });
  for (const k of fields) p[k] = today.totals[k];
  p.totalBase = days.filter(d => d.date < date).reduce((s, d) => s + d.totals.dayPv, 0);
  p.totalRev = days.reduce((s, d) => s + d.totals.dayRev, 0);
  p.hourly = new Array(24).fill(0);
  for (const d of records) for (const h of d.hourly) if (h.date === date) p.hourly[h.hour] += h.totals.dayPv;
  p.geo = { ...records[0].geo };
  if (document.assistant?.plants?.[p.id]) document.assistant.plants[p.id].previous = null;
}
for (const e of document.assistant?.events || []) {
  if (!e.report?.historical) continue;
  const d = history.datasets.find(d => d.plantId === e.plantId && d.month === e.report.month); if (!d) continue;
  Object.assign(e.report, { totals: d.totals, daily: d.daily, samples: d.steps, observedUntil: d.endUtc - 1, window: history.window,
    selfUsePercent: d.totals.dayPv ? Math.round(d.totals.daySelf / d.totals.dayPv * 10000) / 100 : null });
  e.summary = `${d.plantName} ${d.month} 历史仿真完成：光伏发电 ${d.totals.dayPv.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} kWh，收益 ${d.tariff.sym}${d.totals.dayRev.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}。`;
}
document.snapshot = enrichEnergySnapshot(document.snapshot, history);
document.snapshot.ts = Date.now();
document.lease = null; // Fence old management pages that still hold zeroed in-memory counters.
await store.update('history', () => history); await store.update('workspace', () => document);
console.log(JSON.stringify({ backup, repaired: changed, clockUnchanged: utc }));
