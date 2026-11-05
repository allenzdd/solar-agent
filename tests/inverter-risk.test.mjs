import test from 'node:test';
import assert from 'node:assert/strict';
import { inverterRisk } from '../server/inverter-risk.mjs';
import { evaluateReminders, setReminderScenario } from '../server/reminders.mjs';
const start=Date.UTC(2026,10,4), minute=60000;
test('risk requires sustained rise; forecasts use simulated time and duplicate samples do not count',()=>{
 const ps={},p={id:'P3',invTemp:35};assert.equal(inverterRisk(ps,p,start),null);
 p.invTemp=45;assert.equal(inverterRisk(ps,p,start+20*minute),null);
 assert.equal(inverterRisk(ps,p,start+20*minute),null);
 p.invTemp=55;const r=inverterRisk(ps,p,start+40*minute);assert.equal(r.etaMinutes,30);assert.equal(r.sampleCount,3);assert.equal(r.rateCPerMinute,.5);
 assert.equal(inverterRisk({}, {...p,invTemp:35},start),null);
 assert.equal(inverterRisk(ps,{...p,invTemp:35},start-1000),null);
});
test('closed/missing telemetry cannot generate a risk and real threshold can trigger without fabricated forecast',()=>{
 assert.equal(inverterRisk({}, {closed:true,invTemp:85},start),null);
 assert.equal(inverterRisk({}, {},start),null);
 const r=inverterRisk({}, {invTemp:85},start);assert.equal(r.etaMinutes,null);assert.equal(r.forecastUtc,null);
});
test('ordinary simulation never creates inverter drill notifications',()=>{
 const doc={snapshot:{time:{utc:start},ts:1,plants:[{id:'P3',name:'济宁',invTemp:85,tz:'Asia/Shanghai'}]}};
 evaluateReminders(doc,doc.snapshot,100);
 assert.equal(doc.assistant.events.filter(e=>e.type==='inverter-risk'&&e.status==='active').length,0);
});
