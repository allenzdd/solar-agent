import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { enrichEnergySnapshot } from '../server/energy.mjs';
test('night-time detail uses accumulated PV energy, never instantaneous power or battery discharge', () => {
  const hour = Date.parse('2026-11-03T12:00:00Z');
  const history = { start: 0, end: hour + 3600000, window: { startDate: '2026-08-06' }, datasets: [{ plantId: 'P1', daily: [{ date: '2026-10-31', totals: { dayPv: 100 } }, { date: '2026-11-02', totals: { dayPv: 200 } }], hourly: [{ date: '2026-11-03', hour: 20, utc: hour, minutes: 60, totals: { dayPv: 300 } }, { date: '2026-11-03', hour: 22, utc: hour + 7200000, minutes: 60, totals: { dayPv: 1000 } }] }] };
  const snapshot = { time: { utc: hour + 3600000 }, plants: [{ id: 'P1', tz: 'Asia/Shanghai', pv: 0, bat: 99, dayPv: 0, totalBase: 300, hourly: new Array(24).fill(0) }], agg: {} };
  const result = enrichEnergySnapshot(snapshot, history);
  assert.equal(result.plants[0].pv, 0); assert.equal(result.plants[0].dayPv, 300);
  assert.equal(result.plants[0].energyTotals.monthPvKwh, 500); assert.equal(result.plants[0].energyTotals.yearPvKwh, 600);
  assert.equal(result.agg.dayPv, 300); assert.equal(result.agg.hourly[20], 300); assert.equal(result.agg.hourly[22], 0);
  assert.equal(snapshot.plants[0].dayPv, 0);
  snapshot.plants[0].dayPv = 350; assert.equal(enrichEnergySnapshot(snapshot, history).plants[0].dayPv, 350);
  snapshot.plants[0].hourly[20] = 300.1;
  assert.equal(enrichEnergySnapshot(snapshot, history).plants[0].hourly[20], 300);
});
test('management restore aligns local day key with restored clock so the next step cannot wipe the restored daily counters', () => {
  const source = fs.readFileSync(new URL('../public/js/manager-bridge.js', import.meta.url), 'utf8');
  const chunk = source.slice(source.indexOf('function restoreRuntime('), source.indexOf('let initialized = false'));
  const context = vm.createContext({ PLANTS: [{ id: 'P1', dayKey: 20261102, dayPv: 0, tz: 'Asia/Shanghai' }], SIMTIME: {}, HIST_LEN: 10,
    localTime: () => ({ dayKey: 20261103, date: '2026/11/03' }), snapshot: { time: { utc: Date.parse('2026-11-03T13:00:00Z'), speed: 1, running: true }, plants: [{ id: 'P1', dayPv: 325, dayRev: 200, totalRev: 1000, geo: { lat: 31.3, lng: 120.6 }, hourly: new Array(24).fill(0) }] } });
  vm.runInContext(chunk + '\nrestoreRuntime(snapshot)', context);
  assert.equal(context.PLANTS[0].dayKey, 20261103); assert.equal(context.PLANTS[0].dayPv, 325);
  assert.equal(context.PLANTS[0].totalRev, 800); assert.equal(context.PLANTS[0].local.date, '2026/11/03');
});
