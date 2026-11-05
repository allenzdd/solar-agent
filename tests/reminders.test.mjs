import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateReminders, reminderFeed, setReminderScenario, resetReminders } from '../server/reminders.mjs';
import { createWorkspaceApi } from '../server/workspace.mjs';
import { renderMonthlyReport } from '../server/report.mjs';
const plant = { id: 'P1', name: '三亚仿真电站', tz: 'Asia/Shanghai', invKw: 8000, tariff: { sym: '¥' }, batTemp: 30, soc: 50 };
const snapshot = (utc, patch = {}) => ({ v: 3, ts: 1000, plants: [{ ...plant, ...patch }], time: { utc }, agg: {} });

test('manual recommendation cases persist across accelerated snapshots, replay with new IDs, and reset stays cleared', () => {
  const now=Date.UTC(2026,10,4),utc=Date.UTC(2026,10,4),doc={snapshot:snapshot(utc)};
  for(const type of ['saving','monthly_report','storage_upgrade','weather_backup'])setReminderScenario(doc,{plantId:'P1',type},now);
  assert.equal(doc.assistant.events.filter(e=>e.status==='active').length,4);
  assert.equal(doc.commands,undefined);
  const first=doc.assistant.events.find(e=>e.type==='saving-opportunity');
  setReminderScenario(doc,{plantId:'P1',type:'saving'},now+1);
  const active=doc.assistant.events.filter(e=>e.type==='saving-opportunity'&&e.status==='active');
  assert.equal(active.length,1);assert.notEqual(active[0].id,first.id);
  doc.snapshot=snapshot(utc+2*86400000);evaluateReminders(doc,doc.snapshot,now+1000);
  for(const type of ['saving-opportunity','storage-upgrade','weather-backup'])assert.ok(doc.assistant.events.some(e=>e.type===type&&e.status==='active'));
  resetReminders(doc,now+2000);evaluateReminders(doc,doc.snapshot,now+3000);
  assert.equal(doc.assistant.events.filter(e=>e.status==='active').length,0);
  assert.ok(doc.assistant.events.some(e=>e.report));
});

test('monthly demo uses saved previous real month and labels any fallback as a fixed example',()=>{
  const now=Date.UTC(2026,10,4),doc={snapshot:snapshot(now)};
  const d={plantId:'P1',month:'2026-10',startUtc:Date.UTC(2026,9,1),endUtc:Date.UTC(2026,10,1),steps:100,completeMonth:true,totals:{dayPv:100,daySelf:70,dayRev:25},tariff:{sym:'¥'},daily:[]};
  setReminderScenario(doc,{plantId:'P1',type:'monthly_report'},now,{datasets:[d]});
  let e=doc.assistant.events.find(e=>e.report);assert.equal(e.report.totals.dayPv,100);assert.equal(e.report.selfUsePercent,70);assert.equal(e.report.month,'2026-10');assert.ok(!e.report.demoFixture);
  const fallback={snapshot:snapshot(now)};setReminderScenario(fallback,{plantId:'P1',type:'monthly_report'},now);
  e=fallback.assistant.events.find(e=>e.report);assert.equal(e.report.demoFixture,true);assert.match(renderMonthlyReport(e),/固定演示样例 · 非历史统计/);
});
test('temperature requires continuous simulated duration; merges, escalates and recovers with hysteresis', () => {
  const doc = {}, start = Date.UTC(2026, 0, 1);
  const sample = (minutes, temp) => evaluateReminders(doc, snapshot(start + minutes * 60000, { batTemp: temp }), 1000 + minutes);
  sample(0, 39); sample(9, 39); assert.equal(doc.assistant.events.length, 0);
  sample(10, 37); sample(11, 39); sample(20, 39); assert.equal(doc.assistant.events.length, 0);
  sample(21, 39); assert.equal(doc.assistant.events.length, 1);
  sample(22, 41); assert.equal(doc.assistant.events.length, 1);
  sample(23, 46); assert.equal(doc.assistant.events[0].level, 'urgent');
  sample(24, 37); assert.equal(doc.assistant.events[0].status, 'active');
  sample(25, 35); assert.equal(doc.assistant.events[0].status, 'recovered');
  sample(26, 46); assert.equal(doc.assistant.events.length, 2);
});
test('local calendar month rollover yields one partial observed report, never double counts identical samples or rewinds', () => {
  const doc = {}, start = Date.UTC(2026, 0, 31, 15, 30);
  evaluateReminders(doc, snapshot(start, { dayPv: 100, dayRev: 20 }), 1);
  evaluateReminders(doc, snapshot(start + 600000, { dayPv: 120, dayRev: 24 }), 2);
  evaluateReminders(doc, snapshot(start + 600000, { dayPv: 120, dayRev: 24 }), 3);
  evaluateReminders(doc, snapshot(start + 3600000, { dayPv: 10, dayRev: 2 }), 4);
  let events = doc.assistant.events.filter(e => e.type === 'monthly');
  assert.equal(events.length, 1); assert.equal(events[0].report.month, '2026-01');
  assert.equal(events[0].report.totals.dayPv, 20); assert.equal(events[0].report.totals.dayRev, 4);
  assert.equal(events[0].report.partial, true); assert.equal(events[0].report.samples, 2);
  evaluateReminders(doc, snapshot(start + 3700000, { dayPv: 11 }), 5);
  evaluateReminders(doc, snapshot(start, { dayPv: 100 }), 6);
  assert.equal(doc.assistant.events.filter(e => e.type === 'monthly').length, 1);
  evaluateReminders(doc, snapshot(start + 3600000, { dayPv: 10 }), 7);
  assert.equal(doc.assistant.events.filter(e => e.type === 'monthly').length, 1);
});
test('demo weather is explicitly labeled, expires by simulated or wall clock time, and does not control equipment', () => {
  const doc = { snapshot: snapshot(Date.UTC(2026, 0, 1)) };
  setReminderScenario(doc, { plantId: 'P1', type: 'typhoon' }, 1000);
  assert.equal(doc.assistant.events[0].demo, true);
  assert.match(doc.assistant.events[0].advice, /不是真实气象预报/);
  assert.equal(doc.commands, undefined);
  assert.equal(reminderFeed(doc, 1001).stale, false);
  assert.equal(reminderFeed(doc, 32000).stale, true);
  assert.equal(reminderFeed(doc, 1801001).events[0].status, 'recovered');
  doc.snapshot = snapshot(doc.snapshot.time.utc + 86400001);
  evaluateReminders(doc, doc.snapshot, 2000);
  assert.equal(doc.assistant.events[0].status, 'recovered');
  setReminderScenario(doc, { plantId: 'P1', type: 'heat' }, 3000);
  assert.equal(doc.assistant.events.find(e => e.type === 'temperature').status, 'active');
  setReminderScenario(doc, { plantId: 'P1', type: 'clear' }, 4000);
  assert.equal(doc.assistant.events.find(e => e.type === 'temperature').status, 'recovered');
  assert.equal(doc.snapshot.plants[0].batTemp, 30);
});
test('reminder endpoints require manager permission for scenarios; feed is public and survives a new API instance', async () => {
  let document;
  const store = { read: async () => structuredClone(document || null), update: async (_, change) => (document = change(structuredClone(document || null))) };
  const env = { MANAGER_TOKEN: 'private', APP_CONTROL_TOKEN: 'operator' };
  const req = (route, method = 'GET', body, token) => new Request('http://test/api/workspace/' + route, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const api = createWorkspaceApi(store, { now: () => 1000 });
  assert.equal((await api(req('reminders/scenario', 'POST', { type: 'heat', plantId: 'P1' }), env)).status, 401);
  await api(req('lease', 'POST', { owner: 'one' }, 'private'), env);
  await api(req('state', 'PUT', { owner: 'one', snapshot: snapshot(Date.UTC(2026, 0, 1)) }, 'private'), env);
  assert.equal((await api(req('reminders/scenario', 'POST', { type: 'heat', plantId: 'missing' }, 'private'), env)).status, 400);
  assert.equal((await api(req('reminders/scenario', 'POST', { type: 'heat', plantId: 'P1' }, 'private'), env)).status, 200);
  const response = await createWorkspaceApi(store)(req('reminders'), env);
  assert.equal(response.status, 200);
  const text = await response.text(); assert.doesNotMatch(text, /private|operator/);
  assert.equal(JSON.parse(text).events[0].type, 'temperature');
});

test('monthly HTML attachment uses persisted values, escapes station names and rejects missing or non-report events', async () => {
  const event = { id: 'month:P1:2026-01', type: 'monthly', plantName: '<script>alert(1)</script>', summary: '观测汇总', advice: '查看数据范围', simUtc: Date.UTC(2026, 1, 1), report: { month: '2026-01', totals: { dayPv: 1234, dayRev: 62 }, currency: '¥', samples: 20, observedFrom: Date.UTC(2026, 0, 1), observedUntil: Date.UTC(2026, 0, 31), selfUsePercent: 50 } };
  const html = renderMonthlyReport(event);
  assert.match(html, /1,234/); assert.match(html, /非完整自然月统计/); assert.match(html, /window.print\(\)/);
  assert.doesNotMatch(html, /<script>alert/); assert.match(html, /&lt;script&gt;/);
  const api = createWorkspaceApi({ read: async () => ({ assistant: { events: [event, { id: 'heat', type: 'temperature' }] } }) });
  const response = await api(new Request('http://test/api/workspace/reports/' + encodeURIComponent(event.id)));
  assert.equal(response.status, 200); assert.match(response.headers.get('Content-Type'), /text\/html/);
  assert.match(response.headers.get('Content-Disposition'), /solar-report-2026-01.html/);
  assert.match(response.headers.get('Content-Security-Policy'), /default-src 'none'/);
  for (const id of ['missing', 'heat']) assert.equal((await api(new Request('http://test/api/workspace/reports/' + id))).status, 404);
});

test('reset archives all current bubbles across plants while preserving reports, month baselines and running data', async () => {
  const doc = { snapshot: snapshot(Date.UTC(2026, 0, 1)) };
  setReminderScenario(doc, { plantId: 'P1', type: 'heat' }, 1000);
  const report = { month: '2025-12', totals: { dayPv: 100 } };
  doc.assistant.events.push({ id: 'month:P2:2025-12', plantId: 'P2', type: 'monthly', status: 'active', report });
  const before = structuredClone(doc.snapshot), baseline = structuredClone(doc.assistant.plants.P1.previous);
  assert.equal(resetReminders(doc, 2000), 2);
  assert.deepEqual(doc.snapshot, before); assert.deepEqual(doc.assistant.plants.P1.previous, baseline);
  assert.deepEqual(doc.assistant.scenarios, {}); assert.deepEqual(doc.assistant.events[1].report, report);
  assert.ok(reminderFeed(doc, 2001).events.every(e => e.status === 'archived'));
  assert.equal(resetReminders(doc, 3000), 0);
  setReminderScenario(doc, { plantId: 'P1', type: 'heat' }, 4000);
  assert.equal(doc.assistant.events.filter(e => e.status === 'active').length, 1);
  let stored = doc;
  const store = { read: async () => stored, update: async (_, modify) => (stored = modify(stored)) };
  const api = createWorkspaceApi(store), env = { MANAGER_TOKEN: 'manager', APP_CONTROL_TOKEN: 'operator' };
  const req = token => new Request('http://test/api/workspace/reminders/reset', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
  assert.equal((await api(req('operator'), env)).status, 401);
  assert.equal((await api(req('manager'), env)).status, 200);
  assert.equal((await (await createWorkspaceApi(store)(new Request('http://test/api/workspace/reminders'), env)).json()).events.filter(e => e.status === 'active').length, 0);
});
