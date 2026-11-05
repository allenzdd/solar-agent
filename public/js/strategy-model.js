(function(global){
 'use strict';
 const presets={backup:{name:'备用电优先策略',income:10,life:15,reserve:75},life:{name:'电池寿命优先策略',income:20,life:65,reserve:15},profit:{name:'收益优先策略',income:70,life:20,reserve:10},arbitrage:{name:'谷充峰放策略',income:80,life:15,reserve:5}};
 const cn=s=>/^\d+$/.test(s)?+s:({'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9,'十':10}[s]);
 function defaults(mode='profit'){return {mode,min:20,max:80,reserveSOC:65,start:10,end:16,criticalKw:10,lowPrice:.3,normalPrice:.65,highPrice:1.2,exportPrice:.35,weights:{...presets[mode]},initialSOC:50};}
 function parse(q,base){
  q=String(q||'');let mode;
  if(/停电|备用电|备电|保供/.test(q)&&/明天|策略|优化|调优|预留|多留|保障|设置/.test(q))mode='backup';
  else if(/电池寿命|寿命优先|延长.*寿命|寿命长|保护电池|保守充放电/.test(q))mode='life';
  else if(/谷充峰放|峰谷套利|削峰填谷|省钱策略|省钱机会/.test(q))mode='arbitrage';
  else if(/收益.*最优|收益优先|收益.*最大|收益.*优化|收益.*最高/.test(q))mode='profit';
  else if(/多目标|策略寻优|策略.*调优|储能.*调优|充放电策略.*优化|(?:优化|调优).*(?:策略|充放电)/.test(q))mode=base?.mode||'profit';
  if(!mode)return null;const p={...defaults(mode),...(base?.mode===mode?base:{}),mode,weights:{...presets[mode]}};
  const range=/(?:SOC|soc)(?:[^\d]{0,12})(\d{1,2})\s*%?\s*[~～\-—–至到]\s*(\d{1,3})\s*%?/.exec(q);if(range){p.min=+range[1];p.max=+range[2];}
  if(mode==='backup'){const h=/(\d{1,2})\s*[:：]?\s*(?:00)?\s*[~～\-—–至到]\s*(\d{1,2})(?:[:：]00)?\s*(?:点|时)?/.exec(q);if(h){p.start=+h[1];p.end=+h[2];}const r=/(?:备用|预留|备电)[^\d]{0,8}(\d{1,2})\s*%/.exec(q);if(r)p.reserveSOC=+r[1];}
  return p;
 }
 function validate(p){const e=[];if(!presets[p.mode])e.push('请选择策略目标');if(!(p.min>=0&&p.max<=100&&p.min<p.max))e.push('SOC下限应小于上限，范围为0%至100%');if(!Number.isFinite(p.initialSOC)||p.initialSOC<p.min||p.initialSOC>p.max)e.push('演示初始SOC应位于工作区间内');if(!(p.lowPrice>=0&&p.normalPrice>=p.lowPrice&&p.highPrice>=p.normalPrice&&p.exportPrice>=0))e.push('请检查演示峰谷电价');if(p.mode==='backup'){if(!(Number.isInteger(p.start)&&Number.isInteger(p.end)&&p.start>=0&&p.end<=24&&p.start<p.end))e.push('停电时段应在0至24点内且结束晚于开始');if(!(p.reserveSOC>=p.min&&p.reserveSOC<=p.max))e.push('备用SOC目标应在工作区间内');if(!(p.criticalKw>0))e.push('重要负载功率应大于0');}const w=p.weights;if(!w||![w.income,w.life,w.reserve].every(v=>Number.isFinite(v)&&v>=0)||w.income+w.life+w.reserve<=0)e.push('至少设置一个目标权重');return e;}
 function weights(w){const total=w.income+w.life+w.reserve;return {income:w.income/total,life:w.life/total,reserve:w.reserve/total};}
 const round=(n,d=2)=>Math.round(n*10**d)/10**d;
 function percentWeights(w){const raw=weights(w),keys=['income','life','reserve'],out=Object.fromEntries(keys.map(k=>[k,Math.floor(raw[k]*100)]));let left=100-keys.reduce((n,k)=>n+out[k],0);keys.sort((a,b)=>(raw[b]*100-out[b])-(raw[a]*100-out[a]));for(let i=0;left>0;i++,left--)out[keys[i%3]]++;return out;}
 function simulate(p,plant,intensity){
  const cap=Math.max(1,plant.batKwh||215),limit=Math.max(.1,plant.batKw||100),pvCap=Math.max(0,plant.pvKwp||120),loadPeak=Math.max(1,plant.loadPeak||70),eff=.96;
  const minE=cap*p.min/100,maxE=cap*p.max/100,initial=cap*p.initialSOC/100;let energy=initial,throughput=0,cost=0,baseCost=0,unserved=0,reserveAtStart=null;
  const productionPeak=p.loadProfile ? Math.max(...p.loadProfile) : 0;
  const rows=[],soc=[{hour:0,value:p.initialSOC}];
  for(let h=0;h<24;h++){
   const outage=p.mode==='backup'&&h>=p.start&&h<p.end;
   if(h===p.start)reserveAtStart=energy/cap*100;
   const price=h<6||h>=22?p.lowPrice:h>=17&&h<21?p.highPrice:p.normalPrice;
   const pv=outage?0:Math.max(0,Math.sin((h+.5-6)/12*Math.PI))*pvCap*.62;
   const load=outage?p.criticalKw:p.loadProfile?.[h]??loadPeak*(.45+(h>=8&&h<18?.25:0)+(h>=17&&h<22?.22:0));
   const before=energy;let charge=0,discharge=0;
   const power=limit*intensity;
   if(outage){discharge=Math.min(power,Math.max(0,load-pv),Math.max(0,energy-minE)*eff);unserved+=Math.max(0,load-pv-discharge);}
   else{
    const backupBefore=p.mode==='backup'&&h<p.start;
    const targetSOC=backupBefore?p.reserveSOC:h>=22?p.initialSOC:p.mode==='life'?Math.min(p.max,p.initialSOC+15):p.max;
    const target=cap*targetSOC/100;
    if(pv>load){const ceiling=backupBefore?Math.min(maxE,target):maxE;charge=Math.min(pv-load,power,Math.max(0,ceiling-energy)/eff);}
    else if((h<6||h>=22||backupBefore&&energy<target)&&energy<target)charge=Math.min(power,(target-energy)/eff,(maxE-energy)/eff);
    else if((h>=17&&h<21)||(productionPeak>0&&h>=8&&h<22&&load>=productionPeak*.8))discharge=Math.min(power,load-pv,Math.max(0,energy-minE)*eff);
   }
   energy=Math.max(minE,Math.min(maxE,energy+charge*eff-discharge/eff));throughput+=Math.abs(energy-before);
   const grid=outage?0:load-pv+charge-discharge,baseline=outage?0:load-pv;
   cost+=grid>=0?grid*price:grid*p.exportPrice;baseCost+=baseline>=0?baseline*price:baseline*p.exportPrice;
   rows.push({hour:h,pv,load,price,charge,discharge,batKw:discharge-charge,grid,soc:energy/cap*100,outage});soc.push({hour:h+1,value:energy/cap*100});
  }
  const finalValue=(energy-initial)*p.lowPrice;
  return {rows,soc,cost,baseCost,saving:baseCost-cost+finalValue,throughput,cycles:throughput/(2*cap),unservedKwh:unserved,reserveAtStart,cap,powerLimit:limit,intensity,finalSOC:energy/cap*100};
 }
 function solve(p,plant){
  const errors=validate(p);if(errors.length)return {errors};const w=weights(p.weights),candidates=[.25,.5,.75,1].map(k=>simulate(p,plant,k));
  for(const c of candidates)c.score=c.saving*w.income-c.throughput*.2*w.life+(p.mode==='backup'?Math.min(c.reserveAtStart||0,p.reserveSOC)/100*c.cap*.5*w.reserve:0)-c.unservedKwh*10000;
  const best=candidates.sort((a,b)=>b.score-a.score)[0],baseline=simulate({...p,mode:'profit'},plant,1);
  return {...best,errors:[],params:p,weights:w,candidateCount:4,saving:round(best.saving),savingPercent:best.baseCost>0?round(best.saving/best.baseCost*100):0,cycles:round(best.cycles),cycleReduction:baseline.cycles>0?Math.max(0,round((1-best.cycles/baseline.cycles)*100)):0,reserveEnergy:round((p.reserveSOC-p.min)/100*best.cap*.96),coverageHours:round((p.reserveSOC-p.min)/100*best.cap*.96/Math.max(.1,p.criticalKw)),feasible:best.unservedKwh<.01&&(p.mode!=='backup'||best.reserveAtStart>=p.reserveSOC-.01),assumptions:['峰谷电价、光伏和负载均为演示假设，非实际电价或天气预测','初始SOC为演示边界内的假设值；不改变电站当前SOC','备电按停电期间光伏不供电保守测算；离网输出能力尚未核验']};
 }
 global.StrategyDemoModel=Object.freeze({presets,defaults,parse,validate,solve,simulate,weights,percentWeights});
})(globalThis);
