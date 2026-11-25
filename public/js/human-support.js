(function(global){
 'use strict';
 const el=(t,c,s)=>{const n=document.createElement(t);if(c)n.className=c;if(s!==undefined)n.textContent=s;return n;};
 const btn=(text,fn,c='')=>{const b=el('button',c,text);b.type='button';b.addEventListener('click',fn);return b;};
 let phase='idle',epoch=0,timer=null,service='技术支持',context=null,offerRows=[],queueBox=null;
 const panel=document.getElementById('xiaoyuan'),bar=el('div','hs-bar');bar.hidden=true;panel.querySelector('.xy-top').after(bar);
 function headset(){const icon=el('span','hs-headset');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 13v-2a8 8 0 0 1 16 0v5a4 4 0 0 1-4 4h-3"/><rect x="2" y="10" width="5" height="8" rx="2"/><rect x="17" y="10" width="5" height="8" rx="2"/><path d="M10 20h4"/></svg>';return icon;}
 const time=value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
 function openChat(){openXY();document.getElementById('xy-intro').classList.add('hide');document.getElementById('xy-chat').classList.add('on');}
 function remember(q,a){convo.history.push({role:'user',content:q},{role:'assistant',content:a});}
 function human(text){const row=addMsg('ai','');row.classList.add('hs-human');const bubble=row.querySelector('.bubble');const agent=el('div','hs-agent');agent.append(headset(),el('span','','小李 · 客服工程师（模拟）'));bubble.append(agent,el('div','',text));return row;}
 function updateBar(){bar.replaceChildren();bar.hidden=!['queued','connected','resolved'].includes(phase);if(bar.hidden)return;bar.append(el('span','',phase==='queued'?'◌ 正在接入模拟人工客服':phase==='resolved'?'✓ 本次模拟服务已解决':'小李 · 模拟人工客服已接入'),btn(phase==='queued'?'取消转接':'结束会话',()=>end(phase==='queued'?'已取消转接，小源继续为你服务。':'模拟人工会话已结束，接下来由小源继续为你服务。')));}
 function reset(){epoch++;clearTimeout(timer);timer=null;phase='idle';context=null;service='技术支持';offerRows=[];updateBar();}
 function end(text){if(phase==='queued'&&queueBox?.isConnected)queueBox.replaceChildren(el('strong','','已取消转接'));epoch++;clearTimeout(timer);timer=null;phase='idle';updateBar();for(const item of offerRows)if(item.button.isConnected)item.button.disabled=false;addMsg('ai',text);}
 function latestQuestion(){return [...convo.history].reverse().find(m=>m.role==='user')?.content||lastAsk||'希望获得进一步技术支持';}
 function ensureContext(q){if(!context){const previous=[...convo.history].reverse().find(m=>m.role==='user'&&typeof m.content==='string'&&!/转.*人工|人工.*客服|联系.*客服/.test(m.content))?.content;context={question:/人工|客服/.test(q||'')?(previous||q):(q||previous||latestQuestion()),notes:[],demo:false};}return context;}
 function summary(){const c=ensureContext();return [c.demo?(c.serviceDemo?'售后查询演示样例':'离线演示样例'):'本次咨询',c.plantName?'电站：'+c.plantName:'',c.question?'问题：'+c.question:'',c.snapshotNote||'',...(c.notes||[]).slice(-3)].filter(Boolean).join('\n');}
 function offer(q){openChat();ensureContext(q);if(phase==='connected'||phase==='resolved'){human('我已在当前模拟会话中，可以继续描述你的问题。');return;}if(phase==='queued'){addMsg('ai','正在为你接入模拟客服，问题摘要已带入，无需重复描述。');return;}phase='offered';const row=addMsg('ai',/人工|客服/.test(q||'')?'可以，请选择咨询类型后联系人工客服。':context?.notes?.length?'已准备好本次查询摘要，可以转接人工客服继续处理。':'当前信息还不足以继续定位，我可以为你转接人工客服。'),box=el('section','hs-card');const title=el('div','hs-card-title');title.append(headset(),el('strong','','客服（FS/EO）'));box.append(title,el('p','hs-subtitle','产品咨询 · 技术支持 · 售后服务'),el('span','hs-demo','Demo · 模拟人工接入'));
  const lines=el('div','hs-info');lines.append(el('div','','示例服务时间　每天 08:00–22:00'),el('small','','演示可随时体验，不代表真实客服排班。'));box.append(lines);
  const choices=el('div','hs-choices');for(const name of ['产品咨询','技术支持','售后服务']){const b=btn(name,()=>{service=name;for(const c of choices.children)c.setAttribute('aria-pressed',String(c===b));});b.setAttribute('aria-pressed',String(name===service));choices.append(b);}box.append(choices);
  const detail=el('details','hs-summary');detail.append(el('summary','','将带入的问题摘要'),el('p','',summary()));box.append(detail);
  const connect=btn('联系人工客服（FS/EO）',()=>begin(row),'hs-primary');box.append(connect,el('small','hs-note','本演示不连接真实客服，不向安装商或外部平台发送消息。'));row.querySelector('.bubble').append(box);offerRows.push({row,button:connect});
 }
 function begin(){if(phase==='queued'||phase==='connected'||phase==='resolved'){toast('当前已有模拟客服会话');return;}openChat();ensureContext();phase='queued';epoch++;const ticket=epoch,conversation=convoId;for(const item of offerRows)if(item.button.isConnected)item.button.disabled=true;addMsg('user','转接人工客服 · '+service);const row=addMsg('ai',''),box=el('section','hs-queue');box.append(el('span','hs-spinner'),el('strong','','正在为您接入人工客服…'),el('p','','排队演示 · 约 2 秒后模拟接入'),btn('取消转接',()=>{if(phase!=='queued')return;box.replaceChildren(el('strong','','已取消转接'));end('已取消转接，小源继续为你服务。');}));row.querySelector('.bubble').append(box);queueBox=box;updateBar();
  timer=setTimeout(()=>{if(ticket!==epoch||conversation!==convoId||phase!=='queued'||!row.isConnected)return;phase='connected';box.replaceChildren(el('strong','','✓ 模拟客服已接入'));updateBar();addMsg('ai','客服工程师小李已接入本次演示会话。');const welcome=human('您好，我是客服工程师小李（模拟）。已收到前面的咨询记录：\n'+summary()+'\n\n'+(context?.serviceDemo?'接下来可以继续核对质保服务范围、备件配送情况或服务申请信息。':context?.demo?'接下来先确认：家里的网络是否正常？设备通信灯是否亮起？':'我会结合你提供的信息继续排查。请先补充你目前看到的异常或已做过的检查。'));const actions=el('div','hs-actions');if(context?.serviceDemo)actions.append(btn('核对质保服务范围',()=>customerReply('核对质保服务范围')),btn('咨询备件配送安排',()=>customerReply('咨询备件配送安排')));else actions.append(btn('网络正常，通信灯不亮',()=>customerReply('网络正常，通信灯不亮')),btn('问题已恢复',()=>customerReply('问题已恢复')));welcome.querySelector('.bubble').append(actions);},1800);
 }
 function customerReply(q){if(phase!=='connected'&&phase!=='resolved')return;addMsg('user',q);void reply(q,[]);}
 function resolved(){phase='resolved';updateBar();const row=human('收到，你已确认问题恢复。本次模拟服务已完成；这条结果来自你的反馈，不代表系统已验证真实设备恢复。');const box=el('div','hs-resolution');box.append(el('strong','','✓ 本次问题已解决（演示）'),el('p','','处理记录：已核对网络与通信状态，并记录用户反馈。'),btn('结束服务，返回小源',()=>end('模拟客服服务已结束，小源继续为你服务。'),'hs-primary'));row.querySelector('.bubble').append(box);}
 function mockTicket(){const id='DEMO-'+Date.now().toString(36).toUpperCase(),row=human('已生成模拟技术支持工单，便于展示升级处理流程。'),box=el('div','hs-resolution');box.append(el('strong','','模拟工单 '+id),el('p','',summary()),el('small','hs-note','未实际提交工单、预约人员或发送联系方式。'));row.querySelector('.bubble').append(box);}
 async function reply(q,images){ensureContext();context.notes.push('用户补充：'+(q||'发送附件'));if(/问题.*(恢复|解决)|已经好了|已恢复|解决了|恢复正常/.test(q)){resolved();return;}
  let answer;
  if(images?.length)answer='已在当前演示会话中收到附件。请结合设备指示灯、具体告警码或安装位置继续说明；本模拟客服不会把附件发送给外部服务商。';
  else if(context?.serviceDemo&&/质保|保修|续保/.test(q))answer='已收到，你希望核对质保服务范围。前面的设备SN、服务包和起止日期已带入。当前是演示会话，正式受理前仍需厂家核验SN、服务凭证和合同范围；不能仅凭在保状态承诺所有项目免费。';
  else if(context?.serviceDemo&&/物流|配送|备件|到货/.test(q))answer='备件服务单、RMA单号及当前演示进度已带入。可以继续核对收货地区或配送安排；样例到货日不是实时配送承诺，本演示不会联系承运商或修改配送信息。';
  else if(/通信灯.*(不亮|熄灭|没亮)|采集器.*(离线|不亮)/.test(q))answer='收到，你反馈家庭网络正常，但设备通信灯未亮。下一步应优先核查采集器与逆变器的通信链路，并在 App 查看最后上传时间和具体告警。请安装商按对应型号说明书检查通信供电、线缆及配置；目前不能直接认定硬件损坏。';
  else if(/网络.*正常|路由器.*正常|能上网/.test(q))answer='既然家庭网络正常，接下来需要确认设备侧通信状态。请看一下逆变器或采集器通信指示灯是否亮起，并提供 App 里的具体告警码。';
  else if(/还是|不行|没恢复|无法恢复|上门|报修|工单|更换/.test(q))answer='现有信息仍不足以远程确定根因，可以升级给安装商进一步排查。我可以演示创建支持工单，并把前面的咨询和已完成检查一并带入。';
  else answer='已收到你的补充。我会继续基于这条信息排查：'+q+'。请补充具体告警码、发生时间和目前观察到的设备状态；模拟客服不会把未经核验的原因当成结论。';
  const row=human(answer),actions=el('div','hs-actions');actions.append(btn('演示创建支持工单',mockTicket),btn('已解决',()=>customerReply('问题已恢复')));row.querySelector('.bubble').append(actions);remember(q,'模拟客服小李：'+answer);
 }
 async function offlineQuestion(q,demo=false){openChat();const conversation=convoId;context={question:q,notes:[],demo};const ownContext=context,row=addMsg('ai','正在检查可用的电站运行记录…');
  if(demo){context.plantName='家庭光储电站（演示）';context.snapshotNote='样例设定：离线 1 小时 23 分钟；最后在线 '+time(Date.now()-83*60000)+'。';}
  else try{const result=await WorkspaceClient.request('state',{signal:AbortSignal.timeout(8000)});if(conversation!==convoId||context!==ownContext)return;const p=result.snapshot?.plants?.find(p=>q.includes(p.name))||result.snapshot?.plants?.[0];context.plantName=p?.name||'未选择电站';const age=result.snapshot?.ts?Math.max(0,Math.round((Date.now()-result.snapshot.ts)/1000)):null;context.snapshotNote=result.snapshot?.ts?'服务器最后快照：'+time(result.snapshot.ts)+'；'+(age>30?'数据已停更，不能据此认定设备离线。':p?.closed?'电站在快照中为关闭状态，关闭不等于通信离线。':'最后快照未标记电站关闭，无法据此确认通信离线原因。'):'尚未读取到电站快照。';}catch{if(conversation!==convoId||context!==ownContext)return;context.snapshotNote='运行记录暂时无法读取，不能确认离线时长或根因。';}
  if(conversation!==convoId||context!==ownContext||!row.isConnected)return;const text=(demo?'以下为离线演示场景。\n':'你反馈电站离线，目前可核对的信息如下。\n')+summary()+'\n\n待排查方向：家庭网络或信号异常、采集器与逆变器通信中断、设备供电或硬件异常。现有信息不能直接确定根因；可先查看 App 告警与通信灯状态。';setBubbleText(row,text);remember(q,text);offer(q);
 }
 function transfer(question,notes){if(!['queued','connected','resolved'].includes(phase)){context={question,notes:notes?[notes]:[],demo:true,serviceDemo:true};service='售后服务';}offer(question);}
 function handle(q,images){if(/取消.*转|不[要用].*人工|结束.*(客服|会话)|返回小源|回到小源/.test(q)){if(phase!=='idle')end('已退出模拟客服流程，小源继续为你服务。');else addMsg('ai','当前没有进行中的模拟客服会话。');return true;}
  if(phase==='connected'||phase==='resolved'){void reply(q,images);return true;}
  if(phase==='queued'){ensureContext().notes.push('等待时补充：'+q);addMsg('ai','已补充到本次咨询摘要，正在为你接入模拟客服。');return true;}
  if(!/演示/.test(q)&&/转.*人工|人工.*(客服|服务)|联系.*客服|找.*客服/.test(q)){offer(q);return true;}
  if(!images?.length&&/演示.*(客服|离线)|客服.*演示/.test(q)){addMsg('user','为什么我的电站离线了？');void offlineQuestion('为什么我的电站离线了？',true);return true;}
  if(!images?.length&&/离线|断连|掉线/.test(q)&&/为什么|怎么|原因|排查|解决/.test(q)){void offlineQuestion(q);return true;}
  if(!images?.length&&/还是不行|没解决|解决不了|仍然.*(不行|异常)|无法恢复/.test(q)){ensureContext(latestQuestion());offer(q);return true;}return false;
 }
 function afterAnswer(q,text){if(phase==='idle'&&/无法.*(定位|确定.*原因)|建议.*联系.*(客服|技术支持)|转接人工/.test(text)){context={question:q,notes:['小源此前答复：'+text.slice(0,500)],demo:false};offer(q);}}
 function afterFailure(q){if(phase==='idle'){context={question:q,notes:['小源暂未能完成本次答复。'],demo:false};offer(q);}}
 function launch(){reset();openChat();addMsg('user','为什么我的电站离线了？');void offlineQuestion('为什么我的电站离线了？',true);}
 const menu=el('a');menu.href='#human-support';menu.setAttribute('role','menuitem');menu.textContent='♧ 人工客服转接演示 ›';menu.addEventListener('click',e=>{e.preventDefault();closeAppMenu();launch();});document.getElementById('app-more-menu')?.append(menu);
 global.HumanSupportDemo=Object.freeze({handle,afterAnswer,afterFailure,reset,open:launch,transfer});
})(globalThis);
