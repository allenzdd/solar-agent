(function(global){
 'use strict';
 const detail=document.getElementById('plant-detail');if(!detail||!global.IntentPolicy)return;
 const key='solar-intent-seen-v1',owner='intent-awareness';let seen=[];
 try{const value=JSON.parse(localStorage.getItem(key)||'[]');if(Array.isArray(value))seen=value.filter(v=>typeof v==='string').slice(-100);}catch{}
 const policy=IntentPolicy.create(seen);let event=null,busy=false,visibleId=null,lastFetch=0;
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 function context(){return {plantId:detail.dataset.plantId,detailOpen:detail.classList.contains('show'),chatOpen:document.getElementById('xiaoyuan')?.classList.contains('open'),hidden:document.hidden};}
 function close(){if(visibleId)global.SolarReminders?.clearContext(owner);visibleId=null;}
 function chatAbout(e){
  close();openXY();document.getElementById('xy-intro').classList.add('hide');document.getElementById('xy-chat').classList.add('on');
  addMsg('user',e.plantName+'今天为什么收益偏低？');
  const row=addMsg('ai',e.explanation+'\n\n'+e.outlook),card=el('section','xr-event');
  card.append(el('h3','','冬季季节性遮挡 · 收益原因'),el('p','','冬季上午 · 晴天 · 设备正常'));
  const metrics=el('div','xr-metrics');
  const money=value=>Number.isFinite(value)?e.evidence.currency+value.toFixed(2):'电价未配置';
  for(const [label,value]of [['今日发电量',Number(e.evidence.shadedPvKwh).toFixed(2)+' kWh'],['今日收益',money(e.evidence.shadedRevenue)],['无遮挡参考发电量',Number(e.evidence.referencePvKwh).toFixed(2)+' kWh'],['无遮挡参考收益',money(e.evidence.referenceRevenue)]]){
   const tile=el('div','',value);tile.append(el('span','',label));metrics.append(tile);
  }
  card.append(metrics,el('p','','场景发电量和收益较无遮挡参考低 '+e.evidence.reductionPercent+'%。建议观察上午到中午的出力变化，并核查南侧遮挡范围。'),el('small','','与电站页共用遮挡场景数据。收益按本电站电价计算；恢复正常后返回原快照，历史记录不改写。'));
  const actions=el('div','xr-actions'),back=el('button','','返回电站查看');back.type='button';back.addEventListener('click',()=>closeXY());actions.append(back);card.append(actions);row.querySelector('.bubble').append(card);
  requestAnimationFrame(()=>row.scrollIntoView({block:'start',behavior:'smooth'}));
 }
 function show(e){
  if(!global.SolarReminders)return;
  visibleId=e.id;
  global.SolarReminders.setContext({owner,kind:'seasonal-shade',anchor:'bottom-right',attention:true,visible:true,actionLabel:'去对话',title:e.title,
   summary:'冬季太阳位置较低，南侧阴影变长，导致上午收益偏低。设备运行正常。',onOpen:()=>chatAbout(e)});
  try{localStorage.setItem(key,JSON.stringify(policy.mark(e.id)));}catch{policy.mark(e.id);}
 }
 function check(){
  const c=context(),active=event?.status==='active'&&event.expiresAt>Date.now()&&event.plantId===c.plantId;
  const due=policy.update(c,event,Date.now());
  if(!c.detailOpen||c.chatOpen||c.hidden||!active||visibleId&&visibleId!==event.id)close();
  if(due&&!visibleId)show(event);
 }
 async function poll(){
  check();if(!context().detailOpen||document.hidden||busy||Date.now()-lastFetch<1400)return;
  busy=true;lastFetch=Date.now();
  try{const result=await WorkspaceClient.request('intent-event',{signal:AbortSignal.timeout(5000)});event=result.event;check();}catch{event=null;check();}finally{busy=false;}
 }
 new MutationObserver(()=>{check();void poll();}).observe(detail,{attributes:true,attributeFilter:['class','data-plant-id']});
 document.addEventListener('visibilitychange',check);setInterval(()=>{void poll();},500);
 global.IntentAwareness=Object.freeze({refresh:poll});
})(globalThis);
