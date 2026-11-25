import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const c=vm.createContext({});vm.runInContext(fs.readFileSync(new URL('../public/js/strategy-model.js',import.meta.url),'utf8'),c);const M=c.StrategyDemoModel;
const plant={batKwh:215,batKw:100,pvKwp:120,loadPeak:70};
test('the three screenshot requests map to separate objectives and preserve user SOC bounds',()=>{
 const backup=M.parse('明天10–16点停电，给我多留备用电');assert.equal(backup.mode,'backup');assert.equal(backup.start,10);assert.equal(backup.end,16);
 assert.equal(M.parse('我想电池寿命长一点，你帮我重新设置下充放电策略吧').mode,'life');
 const income=M.parse('我希望维持SOC在20%–80%区间内，收益最优，帮我设置下');assert.equal(income.mode,'profit');assert.equal(income.min,20);assert.equal(income.max,80);
 assert.equal(M.parse('查询济宁当前SOC是多少'),null);assert.equal(M.parse('每月3号发运营报告到邮箱'),null);
});
test('all candidate strategies conserve battery energy and obey SOC and power limits',()=>{
 for(const mode of ['backup','life','profit','arbitrage']){
  const p=M.defaults(mode),r=M.solve(p,plant);assert.equal(r.errors.length,0);assert.equal(r.rows.length,24);assert.equal(r.soc.length,25);
  let energy=plant.batKwh*p.initialSOC/100;
  for(const row of r.rows){assert.ok(row.soc>=p.min-1e-8&&row.soc<=p.max+1e-8);assert.ok(row.charge<=plant.batKw+1e-8);assert.ok(row.discharge<=plant.batKw+1e-8);assert.ok(!(row.charge>0&&row.discharge>0));energy+=row.charge*.96-row.discharge/.96;assert.ok(Math.abs(energy-plant.batKwh*row.soc/100)<1e-7);if(row.outage)assert.equal(row.grid,0);}
  assert.ok(Number.isFinite(r.saving));assert.ok(Math.abs(r.weights.income+r.weights.life+r.weights.reserve-1)<1e-10);
  const shown=M.percentWeights({income:70,life:100,reserve:10});assert.equal(shown.income+shown.life+shown.reserve,100);
 }
});
test('a custom profit range outside the default initial SOC is carried through the schedule',()=>{
 for(const [min,max] of [[65.5,90],[10,35],[0,100]]){
  const p=M.parse(`请在 SOC ${min}%–${max}% 约束内，生成收益优先的充放电策略。`);
  const result=M.solve(p,plant);
  assert.deepEqual([p.min,p.max],[min,max]);
  assert.equal(result.errors.length,0);
  assert.ok(result.soc.every(point=>point.value>=min-1e-7&&point.value<=max+1e-7));
 }
});
test('reserve claims require meeting the deadline and serving critical load; invalid or inadequate plans cannot be adopted',()=>{
 const good=M.solve(M.defaults('backup'),plant);assert.equal(good.feasible,true);assert.ok(good.reserveAtStart>=65-.01);
 assert.equal(M.solve({...M.defaults('backup'),criticalKw:1000},plant).feasible,false);
 assert.equal(M.solve({...M.defaults('backup'),start:0},plant).feasible,false);
 assert.ok(M.solve({...M.defaults(),min:80,max:20},plant).errors.length);
 assert.ok(M.solve({...M.defaults('backup'),start:16,end:10},plant).errors.length);
});
