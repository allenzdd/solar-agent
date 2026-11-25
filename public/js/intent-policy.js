(function(global){
 'use strict';
 function create(seen=[]){
  const shown=new Set(seen);let plantId=null,enteredAt=0,eventId=null,noticedAt=0;
  return {
   update(context,event,now){
    const eligible=context.detailOpen&&!context.chatOpen&&!context.hidden&&!!context.plantId;
    if(!eligible){plantId=null;eventId=null;return false;}
    if(plantId!==context.plantId){plantId=context.plantId;enteredAt=now;eventId=null;}
    if(!event||event.status!=='active'||event.plantId!==plantId||event.expiresAt<=now){eventId=null;return false;}
    if(eventId!==event.id){eventId=event.id;noticedAt=now;}
    return !shown.has(event.id)&&now-Math.max(enteredAt,noticedAt)>=3000;
   },
   mark(id){shown.add(id);return [...shown].slice(-100);},
   has(id){return shown.has(id);}
  };
 }
 global.IntentPolicy=Object.freeze({create});
})(globalThis);
