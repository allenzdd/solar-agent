// Persisted target configuration is authoritative; actual SOC is never rewritten.
export function savedTargetSoc(document,plant){
 const s=document?.targetSocSettings?.[plant?.id];
 if(!s||plant.targetSoc?.commandId===s.commandId)return plant;
 return {...plant,targetSoc:{target:s.target,direction:s.direction,commandId:s.commandId,updatedAt:s.updatedAt},batMode:s.direction==='stop'?'idle':s.direction,strategy:null};
}
export function projectTargetSoc(document,snapshot){
 if(!snapshot||!Object.keys(document?.targetSocSettings||{}).length)return snapshot;
 const signature=Object.values(document.targetSocSettings).map(s=>s.commandId).join(',');
 return {...snapshot,plants:snapshot.plants.map(p=>savedTargetSoc(document,p)),viewRevision:'target-soc:'+signature};
}
