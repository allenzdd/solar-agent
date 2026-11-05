// The server owns drill activation. Browser-supplied persistent thermal flags cannot enable it.
export function applyInverterDrill(document,snapshot,now=Date.now()) {
  if(!snapshot?.plants || !Number.isFinite(snapshot.time?.utc)) return snapshot;
  const utc=snapshot.time.utc;
  const normal=p=>p.closed?29:30+22*Math.min(1,Math.max(0,(p.pv||0)/Math.max(1,p.invKw||p.cfg?.invKw||100)));
  return {...snapshot,plants:snapshot.plants.map(p=>{
    const s=document.assistant?.scenarios?.[p.id];
    const active=s?.type==='inverter_heat'&&now<=s.expiresAt&&utc>=s.startUtc&&utc<=s.untilUtc&&!p.closed;
    const profile=active?{mode:'rising',startUtc:s.startUtc,baseC:45,rateCPerMinute:.25,maxC:85,untilUtc:s.untilUtc,expiresAt:s.expiresAt}:null;
    const temperature=(sample,at)=>profile&&at>=profile.startUtc?Math.min(85,45+(at-profile.startUtc)/60000*.25):normal(sample);
    return {...p,inverterThermal:profile,invTemp:Math.round(temperature(p,utc)*10)/10,
      hist:(p.hist||[]).map(h=>({...h,invTemp:Number.isFinite(h.utc)?Math.round(temperature({...p,pv:h.pv},h.utc)*10)/10:null}))};
  })};
}
