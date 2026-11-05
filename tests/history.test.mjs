import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateHistory, rollingWindow } from '../scripts/simulate-history.mjs';
import { createWorkspaceApi } from '../server/workspace.mjs';

test('history integrates power over time, splits calendar boundaries, and conserves daily/monthly energy', async () => {
  const config = { id: 'P1', name: '苏州仿真电站', country: '中国', city: '苏州市', invKw: 100, ratio: 1.2, batKw: 100, batHours: 2.15, seed: 123, type: 'ci', mode: 'surplus' };
  const start = Date.parse('2026-08-31T00:00:00+08:00'), end = Date.parse('2026-09-02T00:00:00+08:00');
  const result = await simulateHistory([config], { start, end });
  assert.equal(result.datasets.length, 2);
  for (const d of result.datasets) {
    assert.equal(d.daily.length, 1); assert.equal(d.hourly.length, 24); assert.equal(d.steps, 288);
    const energy = d.hourly.reduce((s, h) => s + h.pvKwAvg * h.minutes / 60, 0);
    assert.ok(Math.abs(energy - d.totals.dayPv) < .0001);
    assert.ok(Math.abs(d.daily[0].totals.dayPv - d.totals.dayPv) < .0001);
    assert.ok(d.totals.dayPv > 0); assert.ok(d.hourly.every(h => h.socEnd >= 10 && h.socEnd <= 98));
    assert.equal(d.hourly[0].totals.dayPv, 0);
    const used = d.totals.daySelf + d.totals.dayExp;
    assert.ok(used <= d.totals.dayPv + .00001);
  }
  const api = createWorkspaceApi({ read: async key => key === 'history' ? result : null });
  const response = await api(new Request('http://test/api/workspace/history/P1/2026-08.csv'));
  assert.equal(response.status, 200); assert.match(response.headers.get('Content-Type'), /text\/csv/);
  const csv = await response.text(); assert.match(csv, /平均光伏功率kW,光伏发电量kWh/); assert.equal(csv.trim().split('\r\n').length, 25);
  const list = await (await api(new Request('http://test/api/workspace/history'))).json(); assert.equal(list.datasets.length, 2); assert.equal(list.datasets[0].hourly, undefined);
});

test('rolling history includes every one of 90 consecutive local days through today, without future hours or claiming partial months complete', async () => {
  const range = rollingWindow('2026-11-03T13:15:00Z');
  assert.equal(range.window.startDate, '2026-08-06'); assert.equal(range.window.endDate, '2026-11-03');
  const config = { id: 'P1', name: '连续90天', country: '中国', city: '苏州', invKw: 100, ratio: 1.2, batKw: 100, batHours: 2, seed: 12 };
  const result = await simulateHistory([config], range);
  const dates = result.datasets.flatMap(d => d.daily.map(day => day.date));
  assert.equal(dates.length, 90); assert.equal(new Set(dates).size, 90);
  for (let i = 1; i < dates.length; i++) assert.equal(Date.parse(dates[i]) - Date.parse(dates[i - 1]), 86400000);
  assert.equal(dates[0], '2026-08-06'); assert.equal(dates.at(-1), '2026-11-03');
  assert.deepEqual(result.datasets.map(d => d.completeMonth), [false, true, true, false]);
  const last = result.datasets.at(-1); assert.equal(last.daily.at(-1).complete, false);
  assert.equal(last.endUtc, range.end); assert.equal(last.hourly.at(-1).hour, 21); assert.equal(last.hourly.at(-1).minutes, 15);
  assert.ok(last.daily.at(-1).totals.dayPv > 0);
});
