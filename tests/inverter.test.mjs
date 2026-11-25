import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
function engine(){const s=fs.readFileSync(root+'public/js/simulator.js','utf8');const c=vm.createContext({HIST_LEN:200});vm.runInContext(s.slice(0,s.indexOf('function simEvent('))+'\nglobalThis.e={makePlant,simStepPlant,inverterTemperature,SIMTIME}',c);return c.e;}
test('rising temperature is based on simulated elapsed time, survives recreation and caps safely',()=>{
 const e=engine(), start=Date.UTC(2026,10,4,3);
 const cfg={country:'中国',invKw:100,ratio:1.2,batKw:100,batHours:2.15,inverterThermal:{mode:'rising',startUtc:start,baseC:35,rateCPerMinute:.25,maxC:85,untilUtc:start+86400000,expiresAt:Date.now()+3600000}};
 const p=e.makePlant(cfg);p.pv=40;
 assert.deepEqual([0,20,60,200,300].map(m=>e.inverterTemperature(p,start+m*60000)),[35,40,50,85,85]);
 assert.equal(e.inverterTemperature(e.makePlant(cfg),start+60*60000),50);
 for(const m of [0,20,60]){e.simStepPlant(p,5,true,start+m*60000);assert.equal(p.invTemp,35+m*.25);assert.equal(p.hist.at(-1).invTemp,p.invTemp);}
 const normal=e.makePlant({...cfg,inverterThermal:null});for(let h=0;h<24;h++){normal.pv=100;const t=e.inverterTemperature(normal,start+h*3600000);assert.ok(t>=26&&t<=54);}
});
