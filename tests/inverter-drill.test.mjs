import test from 'node:test';
import assert from 'node:assert/strict';
import {applyInverterDrill} from '../server/inverter-drill.mjs';
import {evaluateReminders,setReminderScenario,resetReminders} from '../server/reminders.mjs';
const start=Date.UTC(2026,10,4),minute=60000;
const fresh=()=>({config:[{id:'P3',inverterThermal:{mode:'rising'}}],snapshot:{time:{utc:start},plants:[{id:'P3',name:'济宁',invKw:100,pv:50,invTemp:85,inverterThermal:{mode:'rising'},hist:[],tz:'Asia/Shanghai'}]}});
test('click activates changing telemetry, generates trend alert, and reset returns to normal without re-alerting',()=>{
 const w=fresh();w.snapshot=applyInverterDrill(w,w.snapshot,100);assert.equal(w.snapshot.plants[0].invTemp,41);assert.equal(w.snapshot.plants[0].inverterThermal,null);
 setReminderScenario(w,{plantId:'P3',type:'inverter_heat'},100);assert.equal(w.snapshot.plants[0].invTemp,45);
 for(const m of [5,10,15]){w.snapshot.time.utc=start+m*minute;w.snapshot=applyInverterDrill(w,w.snapshot,100+m);evaluateReminders(w,w.snapshot,100+m);}
 assert.equal(w.snapshot.plants[0].invTemp,48.8);
 const active=()=>w.assistant.events.filter(e=>e.status==='active'&&e.type==='inverter-risk');assert.equal(active().length,1);assert.equal(active()[0].demo,true);
 resetReminders(w,200);assert.equal(active().length,0);assert.equal(w.snapshot.plants[0].invTemp,41);assert.equal(w.config[0].inverterThermal,null);
 // An already-open old page may still try to publish 85C. The server owns activation.
 w.snapshot.plants[0].invTemp=85;w.snapshot.plants[0].inverterThermal={mode:'rising'};w.snapshot.time.utc+=minute;
 w.snapshot=applyInverterDrill(w,w.snapshot,201);evaluateReminders(w,w.snapshot,201);assert.equal(w.snapshot.plants[0].invTemp,41);assert.equal(active().length,0);
});
test('clear, clock rewind and timeout stop drill telemetry; unaffected plants remain normal',()=>{
 for(const mode of ['clear','expiry','rewind']){
  const w=fresh();w.snapshot.plants.push({id:'P1',invKw:100,pv:20,invTemp:35,hist:[]});setReminderScenario(w,{plantId:'P3',type:'inverter_heat'},100);
  if(mode==='clear')setReminderScenario(w,{plantId:'P3',type:'clear'},101);
  if(mode==='rewind')w.snapshot.time.utc=start-minute;
  w.snapshot=applyInverterDrill(w,w.snapshot,mode==='expiry'?1800101:101);
  assert.equal(w.snapshot.plants[0].invTemp,41);assert.equal(w.snapshot.plants[0].inverterThermal,null);assert.equal(w.snapshot.plants[1].invTemp,34.4);
 }
});
