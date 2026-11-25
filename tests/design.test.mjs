import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const context=vm.createContext({});vm.runInContext(fs.readFileSync('public/js/design-model.js','utf8'),context);const M=context.SolarDesignModel;
test('Chinese query preserves 10 million annual load and 10 thousand roof area',()=>{const p=M.parse('上海青浦有1万平厂房，年度负载1000万度，给我个设计报告');assert.equal(p.area,10000);assert.equal(p.annualLoad,10000000);assert.equal(p.location,'上海青浦');assert.equal(M.parse('青浦屋顶10,000平方米，年用电量1亿度').annualLoad,100000000);});
test('rounded equipment and all financial flows reconcile',()=>{const r=M.calculate();assert.equal(r.modules,2241);assert.equal(r.pvKw,1299.78);assert.equal(r.generation,r.pvKw*1000);assert.equal(r.selfKwh+r.exportKwh,r.generation);assert.equal(r.pvNet,r.selfKwh*.65+r.exportKwh*.3-r.pvOm);assert.equal(r.pvPayback,r.pvInvestment/r.pvNet);assert.equal(r.storageGross,r.storageDischarge*.95-r.storageCharge*.35);assert.equal(r.totalNet,r.pvNet+r.storageNet);assert.ok(r.invKw>0);});
test('annual consumption cap prevents impossible energy coverage',()=>{const r=M.calculate({annualLoad:10000});assert.equal(r.selfKwh,10000);assert.equal(r.coverage,100);assert.equal(r.exportKwh,r.generation-10000);});
test('negative arbitrage, no storage and invalid inputs are explicit',()=>{const r=M.calculate({peak:.2,valley:.5});assert.ok(r.storageNet<0);assert.equal(r.storagePayback,null);assert.equal(M.calculate({storageCount:0}).storageInvestment,0);for(const p of [{area:0},{annualLoad:NaN},{usable:101},{efficiency:0},{storageCount:1.5}])assert.throws(()=>M.calculate(p));});

test('monthly energy balances reconcile with the report under different loads', () => {
  const close = (a,b) => assert.ok(Math.abs(a-b) < 1e-6, a+' vs '+b);
  for (const p of [{},{annualLoad:1100000},{selfUse:100},{selfUse:0},{area:10,usable:1}]) {
    const r = M.calculate(p);
    assert.equal(r.monthly.length,12);
    for (const [i,m] of r.monthly.entries()) {
      assert.equal(m.month,i+1);
      assert.ok(m.self >= 0 && m.imported >= 0 && m.exported >= 0);
      close(m.self + m.exported,m.pv);
      close(m.self + m.imported,m.load);
    }
    for (const [key,annual] of Object.entries({pv:r.generation,load:r.p.annualLoad,self:r.selfKwh,exported:r.exportKwh,imported:r.gridKwh})) {
      close(r.monthly.reduce((sum,m)=>sum+m[key],0),annual);
    }
  }
});
test('equipment quantities follow roof area and optional storage settings', () => {
  for (const p of [{},{area:5000,storageCount:0},{area:10,usable:1}]) {
    const r = M.calculate(p);
    const quantities = Object.fromEntries(r.equipment.map(item=>[item.name,item.count]));
    assert.deepEqual(quantities,{'光伏组件':r.modules,'组串式逆变器':r.invCount,'通信网关':r.invCount?1:0,'组件优化器':0,'储能柜':r.p.storageCount});
  }
});

test('selected manufacturer ratings drive sizing while custom equipment retains its entered ratings', () => {
  const base = M.calculate();
  const equipment = Object.fromEntries(base.equipment.map(item=>[item.name,item]));
  assert.equal(equipment['光伏组件'].model,'LR5-72HTH-580M');
  assert.equal(equipment['组串式逆变器'].model,'SUN2000-100KTL-M2');
  assert.equal(equipment['通信网关'].model,'SmartLogger3000A');
  assert.equal(equipment['储能柜'].model,'LUNA2000-241-2S1-CN');
  assert.equal(base.storageKw,540);
  assert.equal(base.storageKwh,1205);
  assert.equal(base.storageInvestment,1205*base.p.storageCost);
  const custom=M.calculate({moduleW:600,storageKw:125,storageKwh:261});
  assert.equal(custom.equipment.find(item=>item.name==='储能柜').brand,undefined);
  assert.equal(custom.equipment.find(item=>item.name==='光伏组件').brand,undefined);
  assert.equal(custom.storageKwh,1305);
});
