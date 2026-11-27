(function(global){
 'use strict';
 function create(seen=[]){
  const shown=new Set(seen);
  return {
   update(context,event,now){
    const eligible=context.detailOpen&&!context.chatOpen&&!context.hidden&&!!context.plantId;
    return Boolean(eligible && event?.status==='active' && event.plantId===context.plantId && event.expiresAt>now && !shown.has(event.id));
   },
   mark(id){shown.add(id);return [...shown].slice(-100);},
   has(id){return shown.has(id);}
  };
 }
 global.IntentPolicy=Object.freeze({create});
})(globalThis);
