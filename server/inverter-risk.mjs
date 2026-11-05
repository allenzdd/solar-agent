// Demonstration thresholds; replace with the manufacturer's limits for real equipment.
const minute=60000, finite=Number.isFinite, r=n=>Math.round(n*100)/100;
export function inverterRisk(ps,p,utc,demo=false){
  let samples=ps.inverterSamples ||= [];
  if(ps.inverterDemo && !demo) samples=[];
  ps.inverterDemo=demo;
  if(samples.length && (utc<samples.at(-1).utc || utc-samples.at(-1).utc>120*minute)) samples=[];
  if(demo) samples=[0,1,2,3,4].map(i=>({utc:utc-(4-i)*15*minute,temperature:35+i*5}));
  else {
    const incoming=[...(p.hist || []).map(h=>({utc:h.utc,temperature:h.invTemp})),{utc,temperature:p.invTemp}];
    const map=new Map(samples.map(s=>[s.utc,s]));
    for(const s of incoming) if(finite(s.utc)&&finite(s.temperature)&&s.utc<=utc&&s.utc>=utc-180*minute) map.set(s.utc,s);
    samples=[...map.values()].sort((a,b)=>a.utc-b.utc).slice(-120);
  }
  samples=samples.filter(s=>s.utc>=utc-180*minute);ps.inverterSamples=samples;
  if(p.closed || !finite(p.invTemp) && !demo) return null;
  const current=demo?55:p.invTemp, first=samples[0], last=samples.at(-1);
  const span=first&&last?(last.utc-first.utc)/minute:0;
  // Require several distinct timestamps and a sustained net rise, not one hot/noisy sample.
  const increasing=samples.slice(1).filter((s,i)=>s.temperature>=samples[i].temperature).length;
  const slope=span>=10&&samples.length>=3&&increasing>=.8*(samples.length-1)?(last.temperature-first.temperature)/span:0;
  const threshold=70, eta=slope>=.1&&current<threshold?(threshold-current)/slope:null;
  if(current<threshold && !(current>=40&&eta>0&&eta<=120)) return null;
  return {currentC:r(current),thresholdC:threshold,rateCPerMinute:slope>0?r(slope):null,observedMinutes:r(span),sampleCount:samples.length,
    etaMinutes:eta===null?null:Math.ceil(eta),forecastUtc:eta===null?null:utc+eta*minute,
    points:samples.map(s=>({utc:s.utc,temperature:r(s.temperature)})),demo,
    method:'最近最多180个仿真分钟的温度采样，按首末温差线性外推；不代表设备故障诊断或真实寿命预测。'};
}
