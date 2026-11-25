(function(global){
 'use strict';
 const M=global.EssSocModel,screen=document.querySelector('.screen');if(!M||!screen)return;
 const owner='ess-soc-settings',el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
 const page=el('section','ess-soc-page');page.hidden=true;page.setAttribute('role','region');page.setAttribute('aria-label','储能SOC参数设置');screen.append(page);
 let plant=null,draft={},revision=0,suppress='',pending=null,sending=false,status='';
 const livePlant=()=>{try{return PLANTS.find(p=>p.id===plant?.id)||plant;}catch{return plant;}};
 function clearBubble(){global.SolarReminders?.clearContext(owner);}
 function syncAdvice(){const a=plant&&M.advice(draft,livePlant());if(page.hidden||!a||suppress===revision||document.getElementById('xiaoyuan')?.classList.contains('open')){clearBubble();return;}global.SolarReminders?.setContext({owner,kind:'soc-longevity',anchor:'bottom-right',attention:true,visible:true,actionLabel:'去对话',title:a.title,summary:a.summary,onOpen:explain});}
 function close(){page.hidden=true;clearBubble();}
 function open(pid,initial){let candidate;try{candidate=PLANTS.find(p=>p.id===pid)||PLANTS.find(p=>p.name==='苏州仿真电站')||PLANTS[0];}catch{}if(!candidate){toast('请先等待电站数据加载');return;}if(pending&&candidate.id!==plant?.id){toast('当前电站正在设置，请先完成当前操作');return;}plant=candidate;if(!pending){const saved=candidate.targetSoc;draft={target:initial?.target??saved?.target??Math.min(candidate.socMax??100,90),direction:saved?.direction||'stop'};}revision++;suppress='';status=pending?'正在执行目标SOC设置…':'';closeAppMenu();closeXY();page.hidden=false;render();}
 function render(){
  page.replaceChildren();const head=el('header','ess-soc-top');head.append(button('‹',close),el('strong','','参数设置'));
  const body=el('div','ess-soc-body');body.append(el('p','',plant.name+' · 储能单元'));
  const group=el('section','ess-soc-group'),row=(label,control)=>{const r=el('div','ess-soc-row');r.append(el('span','',label),control);group.append(r);};
  const direction=el('select');direction.setAttribute('aria-label','充放电选择');for(const [value,label]of [['stop','停止'],['charge','充电'],['discharge','放电']]){const o=el('option','',label);o.value=value;direction.append(o);}direction.value=draft.direction;direction.disabled=!!pending||sending;direction.addEventListener('change',()=>{draft.direction=direction.value;revision++;suppress='';syncAdvice();});row('充放电选择',direction);
  row('设置方式',el('span','ess-soc-static','电量'));
  const input=el('input');input.type='number';input.min='0';input.max='100';input.step='1';input.value=draft.target;input.disabled=!!pending||sending;input.setAttribute('aria-label','目标SOC(%)');input.addEventListener('input',()=>{draft.target=input.value===''?NaN:input.valueAsNumber;revision++;suppress='';status='';syncAdvice();});row('目标SOC(%)',input);
  const live=livePlant();row('已充电电量(kWh)',el('output','',Number(live.dayChg||0).toFixed(3)));row('已放电电量(kWh)',el('output','',Number(live.dayDis||0).toFixed(3)));
  const b=M.bounds(live);body.append(group,el('p','ess-soc-status','当前设备允许 '+b.min+'%–'+b.max+'%。目标SOC是本次充放电的停止目标，不会直接改写当前电量。提交后替换当前手动设置，并取消该站已有充放电策略，避免调度冲突。'));
  const message=el('p','ess-soc-status',status);message.setAttribute('role','status');body.append(message);
  const foot=el('footer','ess-soc-foot'),cancel=button('取消',close),confirm=button(sending||pending?'正在执行…':'确定',()=>submit(false),'ess-confirm');confirm.disabled=!!pending||sending;foot.append(cancel,confirm);page.append(head,body,foot);syncAdvice();
 }
 function explain(){
  if(!plant||!M.advice(draft,livePlant()))return;const a=M.advice(draft,livePlant()),pid=plant.id,version=revision;
  clearBubble();openXY();document.getElementById('xy-intro').classList.add('hide');document.getElementById('xy-chat').classList.add('on');
  addMsg('user',plant.name+'目标SOC设置为100%，是否合适？');
  const row=addMsg('ai','日常使用可以先考虑 '+a.recommended+'%。长期保持很高的SOC可能增加部分锂离子电池的日历老化，温度较高时更应留意；这不代表偶尔充到100%就会损坏电池。'),card=el('section','ess-setting-card');
  card.append(el('h3','','目标SOC设置建议'),el('p','','当前草稿 100% → 日常参考 '+a.recommended+'%'));
  const details=el('details'),summary=el('summary','','为什么建议留出余量？');
  details.append(summary,el('p','','高SOC停留时间、温度、充放电强度和电芯化学体系都会影响老化。把日常目标暂设为85%左右，可在可用电量与减少满电停留之间做折中，不承诺具体寿命提升比例。'),el('p','','85%是本演示的日常参考，不是所有设备的统一要求。临时停电备电、厂家要求的均衡或SOC校准可能需要100%；应优先遵循对应设备手册和BMS限制。'),el('p','','本电站当前允许 '+a.bounds.min+'%–'+a.bounds.max+'%，建议值已限制在该范围内。'));
  const source=el('p');for(const [label,url]of [['电池老化资料','https://www.energy.gov/sites/default/files/2022-10/Chapter_4-Technology.pdf'],['厂家校准示例','https://www.tesla.com/support/energy/powerwall/own/powerwall-calibration']]){const link=el('a','',label+' ');link.href=url;link.target='_blank';link.rel='noopener noreferrer';source.append(link);}details.append(source);card.append(details);
  const label=el('label'),input=el('input');input.type='number';input.min=a.bounds.min;input.max=a.bounds.max;input.step='1';input.value=a.recommended;input.setAttribute('aria-label','建议目标SOC(%)');label.append(el('span','','建议目标SOC(%)'),input);card.append(label);
  const error=el('p');error.setAttribute('role','status');card.append(error);const actions=el('div','ess-actions');
  actions.append(button('暂不调整',()=>{suppress=revision;closeXY();render();}),button('采用建议并执行',async()=>{
   if(page.hidden||plant?.id!==pid||revision!==version){error.textContent='参数页已变化，请重新获取建议。';return;}
   const next={...draft,target:input.value===''?NaN:Number(input.value)},invalid=M.validate(next,livePlant());if(invalid){error.textContent=invalid;return;}
   draft=next;revision++;suppress='';closeXY();await submit(true);
  },'ess-confirm'));card.append(actions,el('small','','点击“采用建议并执行”后自动完成设置，并显示执行结果。'));
  if(!M.validate(draft,livePlant()))card.append(button('保留100%并确认下达',()=>{if(plant?.id!==pid||revision!==version){error.textContent='参数已变化，请重新确认。';return;}suppress=revision;closeXY();void submit(true);}));
  row.querySelector('.bubble').append(card);requestAnimationFrame(()=>row.scrollIntoView({block:'start',behavior:'smooth'}));
 }
 async function submit(confirmed){
  if(pending||sending)return;const invalid=M.validate(draft,livePlant());
  if(M.advice(draft,livePlant())&&!confirmed){explain();return;}if(invalid){status=invalid;render();return;}
  const id=global.crypto?.randomUUID?.()||'soc-'+Date.now()+'-'+Math.random().toString(36).slice(2);sending=true;status='';render();
  try{const result=await global.AppBridge.command({id,type:'target-soc',plantId:plant.id,target:draft.target,direction:draft.direction});if(finish(result.command))return;pending={id:result.command.id,startedAt:Date.now()};status='正在执行目标SOC设置…';await poll();}
  catch(e){status=e.status||/口令/.test(e.message)?'设置指令未下达：'+e.message:'暂未收到下达确认，请先查询执行结果，避免重复提交。';if(!e.status&&!/口令/.test(e.message))pending={id,startedAt:Date.now()};toast(status);}
  finally{sending=false;render();}
 }
 function finish(c){if(c?.status!=='done'&&c?.status!=='expired')return false;pending=null;status=c.status==='done'?(c.ok?'目标 SOC 已设置为 '+draft.target+'%':'设置执行失败：'+c.msg):'设置已超时，请重新核对目标SOC后重试。';if(c.ok&&plant){plant.targetSoc={target:c.target??draft.target,direction:c.direction??draft.direction,commandId:c.id};}if(!page.hidden)render();toast(status);return true;}
 function stopUnknown(message){pending=null;status=message;if(!page.hidden)render();toast(status);}
 let polling=false;async function poll(){if(!pending||polling)return;polling=true;try{const c=await global.AppBridge.acknowledgment(pending.id);if(finish(c))return;if(pending&&Date.now()-pending.startedAt>15000)stopUnknown('连接异常，无法确认本次设置；请重新打开参数页核对服务器已保存的目标SOC。');}catch(e){if(e.status===404)stopUnknown('本次设置未提交成功，请重试。');else if(e.status===401)stopUnknown('控制权限未配置或已失效，请重新确认设置。');else if(pending&&Date.now()-pending.startedAt>15000)stopUnknown('连接异常，请重新打开参数页核对已保存的目标SOC。');}finally{polling=false;}}
 setInterval(()=>{syncAdvice();void poll();},1500);
 const entry=el('a','','储能 SOC 设置 ›');entry.href='#ess-soc';entry.setAttribute('role','menuitem');entry.addEventListener('click',e=>{e.preventDefault();open();});document.getElementById('app-more-menu').append(entry);
 global.EssSocSettings=Object.freeze({open,explain,refresh:syncAdvice});
})(globalThis);
