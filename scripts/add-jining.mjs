// Run once while solar-monitor is stopped. No credentials are read or printed.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { simulateHistory } from './simulate-history.mjs';
const directory=process.argv[2]; if(!directory) throw Error('DATA_DIR required');
const file=directory+'/workspace.json', historyFile=directory+'/history.json';
const w=JSON.parse(await fs.readFile(file,'utf8')), h=JSON.parse(await fs.readFile(historyFile,'utf8'));
if(w.config.some(p=>p.city?.includes('济宁'))) throw Error('Jining already exists; migration not repeated');
const startUtc=w.snapshot.time.utc;
const cfg={...structuredClone(w.config.find(p=>p.id==='P1')),id:'P'+(Math.max(...w.config.map(p=>Number(p.id.slice(1))))+1),name:'山东济宁光储电站',city:'济宁',geo:{lat:35.41,lng:116.59},seed:354111659,created:'2026/11/04',start:{mo:11,dd:4,hh:10},inverterThermal:{mode:'rising',startUtc,baseC:35,rateCPerMinute:.25,maxC:85}};
const batch=await simulateHistory([cfg],{start:h.start,end:h.end,stepMinutes:5});
const source=await fs.readFile(new URL('../public/js/simulator.js',import.meta.url),'utf8');
const bridge=await fs.readFile(new URL('../public/js/manager-bridge.js',import.meta.url),'utf8');
const c=vm.createContext({window:{addEventListener(){}},localStorage:{setItem(){}},snapshot:w.snapshot,configs:w.config,newConfig:cfg,ManagerBridge:{publish(s){c.result=JSON.parse(JSON.stringify(s));}}});
vm.runInContext(source,c);
vm.runInContext(bridge.slice(bridge.indexOf('function restoreRuntime('),bridge.indexOf('let initialized = false')),c);
vm.runInContext(`SIMTIME.utc=snapshot.time.utc; configs.forEach(o=>{const p=makePlant(o);p.id=o.id;p.seed=o.seed;PLANTS.push(p);});restoreRuntime(snapshot); PLANTS.forEach(p=>p.invTemp=inverterTemperature(p,SIMTIME.utc)); const np=makePlant(newConfig);np.id=newConfig.id;np.seed=newConfig.seed;seedPlant(np);PLANTS.push(np);SIM=PLANTS[0];publishState();`,c);
const added=c.result.plants.find(p=>p.id===cfg.id);added.totalBase=batch.datasets.reduce((sum,d)=>sum+d.totals.dayPv,0);added.totalRev+=batch.datasets.reduce((sum,d)=>sum+d.totals.dayRev,0);
// Preserve every existing plant's saved runtime exactly, adding only inverter telemetry.
w.snapshot.plants=w.snapshot.plants.map(p=>({...p,invTemp:c.result.plants.find(n=>n.id===p.id).invTemp,inverterThermal:null}));
w.snapshot.plants.push(added);w.snapshot.ts=Date.now();
for(const key of ['pv','dayPv','dayLoad','dayImp','dayExp','dayChg','dayDis']) w.snapshot.agg[key]=(w.snapshot.agg[key]||0)+(added[key]||0);
w.snapshot.agg.hourly=w.snapshot.agg.hourly.map((v,i)=>v+added.hourly[i]);
w.snapshot.agg.soc=w.snapshot.plants.reduce((s,p)=>s+p.soc,0)/w.snapshot.plants.length;
w.snapshot.agg.totalKwh=(w.snapshot.agg.totalKwh||0)+added.totalBase+added.dayPv;
w.snapshot.agg.revenue=(w.snapshot.agg.revenue||0)+added.dayRev;
w.snapshot.agg.totalRev=(w.snapshot.agg.totalRev||0)+added.totalRev;
w.config.push(cfg);w.revision=(w.revision||0)+1;
const a=w.assistant ||= {version:1,events:[],plants:{},scenarios:{}};
for(const d of batch.datasets){const pv=d.totals.dayPv;a.events.push({id:`month:${cfg.id}:${d.month}`,createdAt:Date.now(),updatedAt:Date.now(),status:'active',plantId:cfg.id,plantName:cfg.name,type:'monthly',level:'info',simulation:true,simUtc:d.endUtc,title:d.month+' 运营报告',summary:cfg.name+' 历史模型仿真完成',advice:'模型仿真数据，非真实历史观测。逆变器渐升温演练自新增时刻开始。',report:{month:d.month,observedFrom:d.startUtc,observedUntil:d.endUtc-1,samples:d.steps,totals:d.totals,selfUsePercent:pv?Math.round(d.totals.daySelf/pv*10000)/100:0,currency:d.tariff.sym,partial:!d.completeMonth,historical:true,window:h.window,stepMinutes:5,daily:d.daily,method:d.method}});}
h.datasets.push(...batch.datasets);
await fs.writeFile(historyFile+'.new',JSON.stringify(h),{mode:0o600});await fs.writeFile(file+'.new',JSON.stringify(w),{mode:0o600});
await fs.rename(historyFile+'.new',historyFile);await fs.rename(file+'.new',file);
console.log(JSON.stringify({added:cfg.name,id:cfg.id,historyMonths:batch.datasets.length,dailyRows:batch.datasets.reduce((s,d)=>s+d.daily.length,0),hourlyRows:batch.datasets.reduce((s,d)=>s+d.hourly.length,0),temperature:added.invTemp,thermal:cfg.inverterThermal}));
