import fs from 'node:fs/promises';
import path from 'node:path';
import { createFileWorkspaceStore } from '../server/file-store.mjs';

const [filename, directory] = process.argv.slice(2);
if (!filename || !directory) throw new Error('Run with INPUT.json DATA_DIR while the application service is stopped.');
const batch = JSON.parse(await fs.readFile(filename, 'utf8'));
if (batch.version !== 1 || !Array.isArray(batch.datasets) || !batch.datasets.length) throw new Error('Invalid history batch');
const store = createFileWorkspaceStore(directory), current = await store.read('workspace');
const keys = ['id', 'name', 'city', 'country', 'invKw', 'ratio', 'batKw', 'batHours', 'type', 'mode', 'tariff', 'seed', 'loadScale', 'cloud', 'batMode', 'gridOut'];
const signature = list => JSON.stringify(list.map(p => Object.fromEntries(keys.map(k => [k, p[k]]))).sort((a, b) => a.id.localeCompare(b.id)));
if (signature(current?.config || []) !== signature(batch.configs)) throw new Error('Station configuration changed; regenerate history before import.');
if (batch.window?.kind === 'rolling-days') {
  for (const p of batch.configs) {
    const dates = batch.datasets.filter(d => d.plantId === p.id).flatMap(d => d.daily.map(day => day.date)).sort();
    if (dates.length !== batch.window.days || new Set(dates).size !== dates.length || dates[0] !== batch.window.startDate || dates.at(-1) !== batch.window.endDate || dates.some((date, i) => i && Date.parse(date) - Date.parse(dates[i - 1]) !== 86400000)) throw new Error('History contains a missing or duplicate day: ' + p.id);
  }
}
const backup = path.join(directory, 'history-backup-' + Date.now()); await fs.mkdir(backup, { mode: 0o700 });
for (const key of ['workspace', 'history']) { const data = await store.read(key); if (data) await fs.writeFile(path.join(backup, key + '.json'), JSON.stringify(data), { mode: 0o600 }); }
await store.update('history', existing => ({ ...batch, datasets: [...(existing?.datasets || []).filter(old => batch.window ? !batch.configs.some(p => p.id === old.plantId) : !batch.datasets.some(d => d.plantId === old.plantId && d.month === old.month)), ...batch.datasets] }));
await store.update('workspace', document => {
  const a = document.assistant ||= { version: 1, events: [], plants: {}, scenarios: {} };
  for (const d of batch.datasets) {
    const id = `month:${d.plantId}:${d.month}`, pv = d.totals.dayPv;
    const report = { month: d.month, observedFrom: d.startUtc, observedUntil: d.endUtc - 1, samples: d.steps, totals: d.totals,
      selfUsePercent: pv > 0 ? Math.round(d.totals.daySelf / pv * 10000) / 100 : null, currency: d.tariff.sym,
      partial: !d.completeMonth, historical: true, window: batch.window || null, stepMinutes: d.stepMinutes, daily: d.daily, method: d.method };
    a.events = a.events.filter(e => e.id !== id);
    a.events.push({ id, createdAt: batch.generatedAt, updatedAt: batch.generatedAt, status: 'active', plantId: d.plantId, plantName: d.plantName,
      type: 'monthly', level: 'info', simulation: true, simUtc: d.endUtc, title: `${d.month} ${d.completeMonth ? '月度' : '时段'}运营报告`, report,
      summary: `${d.plantName} ${d.month} 历史仿真完成：发电 ${pv.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} kWh，收益 ${d.tariff.sym}${d.totals.dayRev.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}。`,
      advice: `本报告为${d.completeMonth ? '完整自然月' : '所选90天窗口内时段'}的模型仿真，按 ${d.stepMinutes} 分钟步长将光伏功率累计为发电量。今天仅累计至批次截止时间，不补造未来时段。使用仿真天气及现有设备配置回算，不代表电站当时真实运行或真实收益。` });
  }
  a.events.sort((a, b) => b.createdAt - a.createdAt || String(b.report?.month || '').localeCompare(String(a.report?.month || ''))); a.events = a.events.slice(0, 200);
  return document;
});
console.log(JSON.stringify({ imported: batch.datasets.length, backup, preservedLiveState: true }));
