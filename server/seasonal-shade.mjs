// A reversible read-time scenario projection shared by APP telemetry and agent tools.
// Raw telemetry and historical datasets are never overwritten by this projection.
export function intentEventFor(document,now=Date.now()){
 const event=document?.intentEvent;if(event?.status!=='active'||event.expiresAt<=now)return null;
 const config=document.config?.find(p=>p.id===event.plantId),plant=document.snapshot?.plants?.find(p=>p.id===event.plantId);
 if(!config&&!plant||plant?.closed||config?.closed)return null;
 const tariff={...plant?.tariff,...config?.tariff},capacity=Number.isFinite(config?.invKw)?config.invKw:Number.isFinite(plant?.invKw)?plant.invKw:100;
 const referencePvKwh=Math.max(1,capacity)*2,shadedPvKwh=referencePvKwh*.4,selfUseRatio=.8;
 const revenue=pv=>Number.isFinite(tariff.retail)&&Number.isFinite(tariff.fit)?pv*selfUseRatio*tariff.retail+pv*(1-selfUseRatio)*tariff.fit:null;
 return {...event,evidence:{...event.evidence,period:'冬季上午',weather:'晴天',equipment:'正常',cause:'季节性遮挡',
  shadedPvKwh,referencePvKwh,shadedRevenue:revenue(shadedPvKwh),referenceRevenue:revenue(referencePvKwh),selfUseRatio,
  referencePowerKw:Math.max(1,capacity)*.3,shadedPowerKw:Math.max(1,capacity)*.3*.4,
  reductionPercent:60,currency:tariff.sym||tariff.cur||'¥',retail:tariff.retail??null,fit:tariff.fit??null,
  reference:'发电量、收益与功率为季节性遮挡场景的统一数据；收益按本电站购电价、上网价和80%自用比例计算。恢复后返回原快照，历史记录不改写。'}};
}
export function applySeasonalShade(document,snapshot,now=Date.now()){
 const event=intentEventFor(document,now);if(!event||!snapshot)return snapshot;
 const e=event.evidence;
 const plants=snapshot.plants.map(original=>{
  if(original.id!==event.plantId)return original;
  const p={...original},delta=e.shadedPvKwh-(Number(p.dayPv)||0);
  p.pv=e.shadedPowerKw;p.bat=0;p.load=Math.max(Number(p.load)||0,p.pv);p.demand=p.load;p.grid=p.load-p.pv;p.shed=0;p.curtail=0;
  p.dayPv=e.shadedPvKwh;p.daySelf=p.dayPv*e.selfUseRatio;p.dayExp=p.dayPv-p.daySelf;
  p.dayLoad=e.referencePvKwh;p.dayImp=p.dayLoad-p.daySelf;p.dayChg=0;p.dayDis=0;p.dayRev=e.shadedRevenue;
  const hours=Array.from({length:24},(_,i)=>Math.max(0,Number(original.hourly?.[i])||0)),total=hours.reduce((s,n)=>s+n,0);
  p.hourly=hours.map(n=>total>0?n/total*p.dayPv:0);if(!total)p.hourly[9]=p.dayPv;
  if(p.energyTotals){p.energyTotals={...p.energyTotals};for(const key of ['monthPvKwh','yearPvKwh','knownPvKwh'])if(Number.isFinite(p.energyTotals[key]))p.energyTotals[key]+=delta;}
  p.intentScenario={eventId:event.id,type:event.type,demo:true,...e};
  return p;
 });
 const agg={...snapshot.agg,hourly:Array(24).fill(0)};
 for(const key of ['pv','load','bat','grid','dayPv','dayLoad','dayImp','dayExp','dayChg','dayDis','daySelf'])agg[key]=plants.reduce((s,p)=>s+(Number(p[key])||0),0);
 agg.dayRev=plants.some(p=>p.dayRev===null)?null:plants.reduce((s,p)=>s+(Number(p.dayRev)||0),0);agg.revenue=agg.dayRev;
 agg.totalRev=agg.dayRev===null?null:plants.reduce((s,p)=>s+(Number(p.totalRev)||0)+(Number(p.dayRev)||0),0);
 agg.totalKwh=plants.reduce((s,p)=>s+(Number(p.totalBase)||0)+(Number(p.dayPv)||0),0);
 for(const p of plants)for(let i=0;i<24;i++)agg.hourly[i]+=Number(p.hourly?.[i])||0;
 return {...snapshot,plants,agg,viewRevision:(snapshot.viewRevision||'')+':seasonal-shade:'+event.id+':'+e.retail+':'+e.fit,intentEvent:event};
}
