(function(){
  'use strict';
  const app=document.getElementById('xiaoyuan'),top=app?.querySelector('.xy-top');if(!top)return;
  const trigger=document.createElement('button');trigger.type='button';trigger.className='xy-more-trigger';trigger.textContent='···';trigger.title='更多';trigger.setAttribute('aria-label','小源更多功能');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-haspopup','menu');
  const menu=document.createElement('div');menu.className='xy-more-menu';menu.id='xy-more-menu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','小源更多功能');trigger.setAttribute('aria-controls',menu.id);
  function close(focus=false){menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(focus)trigger.focus();}
  const entries=[['◷','记忆','查看近期关注与长期常问',()=>globalThis.OwnerMemory?.open()],['⌁','策略优化','调整储能充放电策略',()=>globalThis.StrategyDemo?.open()],['▦','我的订阅','管理报告与异常提醒',()=>globalThis.SubscriptionDemo?.open()]];
  entries.forEach(([icon,title,note,open])=>{const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');const art=document.createElement('span');art.className='xy-more-icon';art.textContent=icon;const copy=document.createElement('span'),name=document.createElement('span'),detail=document.createElement('small');name.textContent=title;detail.textContent=note;copy.append(name,detail);b.append(art,copy);b.addEventListener('click',()=>{close(true);open();});menu.append(b);});
  trigger.addEventListener('click',()=>{if(!menu.hidden){close();return;}menu.hidden=false;trigger.setAttribute('aria-expanded','true');menu.querySelector('button')?.focus();});
  document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!trigger.contains(e.target))close();});
  app.addEventListener('keydown',e=>{if(menu.hidden)return;const buttons=[...menu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);if(e.key==='Escape'){e.preventDefault();close(true);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const i=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[i]?.focus();}else if(e.key==='Tab')close();});
  top.insertBefore(trigger,top.querySelector('.xy-new-chat'));app.append(menu);
  globalThis.XiaoyuanMenu=Object.freeze({close});
})();
