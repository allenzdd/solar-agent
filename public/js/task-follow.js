(function(){
  'use strict';
  const KEY='xy-follow-task-v1';
  const steps=['日志检查','故障诊断与方案','安装商派单','现场维修','修复效果验证'];
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const button=(text,fn,cls='')=>{const node=el('button',cls,text);node.type='button';node.onclick=fn;return node;};
  let tasks=[];
  try{const stored=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(stored))tasks=stored.filter(task=>task&&typeof task.id==='string'&&Array.isArray(task.events)&&['checking','diagnosing','dispatching','dispatched','onsite','verifying','failed','completed'].includes(task.state)).slice(-10);}catch{}
  let selected=null,timer=null;
  const clock=time=>new Date(time).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
  const current=()=>tasks.find(task=>task.id===selected)||tasks.at(-1);
  function store(next){
    try{localStorage.setItem(KEY,JSON.stringify(next));tasks=next;return true;}
    catch{toast('任务记录暂时无法保存，请检查浏览器存储空间');return false;}
  }
  function stage(task){
    return {checking:0,diagnosing:1,dispatching:2,dispatched:2,onsite:3,verifying:4,failed:4,completed:5}[task.state];
  }
  function status(task){
    return {checking:'正在检查运行日志',diagnosing:'已发现直流侧异常',dispatching:'正在创建维修工单',dispatched:'已通知安装商，等待接单',onsite:'安装商已到场，正在维修',verifying:'维修完成，正在验证恢复情况',failed:'复测未通过，需要继续排查',completed:'设备修复并验证成功'}[task.state];
  }
  function note(task,index){
    return [
      '日志发现 DC_INPUT_ABNORMAL。故障前后输出功率明显下降。',
      '直流组串电流不均衡，安排核查直流连接与组串回路。',
      '工单 '+task.order+' · 属地安装商 · 张工。已发送故障摘要与日志。',
      task.state==='dispatched'?'等待安装商接单并到场。':task.state==='onsite'?'安装商已到场，检查直流连接与组串回路。':'已完成直流连接检查与处理，提交维修记录。',
      task.state==='failed'?'直流电流仍异常，已退回安装商复查。':'复核告警、组串电流及连续发电状态。'
    ][index];
  }
  function advance(id,expected,next,title){
    const task=tasks.find(item=>item.id===id);
    if(!task||task.state!==expected)return false;
    const updated={...task,state:next,read:false,events:[...task.events,{state:next,title,time:Date.now()}]};
    if(!store(tasks.map(item=>item.id===id?updated:item)))return false;
    updateChatCards();
    schedule();return true;
  }
  function schedule(){
    clearTimeout(timer);
    const active=tasks.find(task=>['checking','diagnosing','dispatching','dispatched','onsite','verifying','failed'].includes(task.state));
    if(!active)return;
    const transitions={
      checking:['diagnosing','日志检查完成，发现直流侧发电异常'],
      diagnosing:['dispatching','已生成直流回路核查方案，创建安装商工单'],
      dispatching:['dispatched','维修工单已送达安装商，等待接单'],
      dispatched:['onsite','安装商已接单并到场，开始检查直流回路'],
      onsite:['verifying','安装商已完成维修并提交记录，小源开始验证'],
      failed:['onsite','安装商重新检查直流回路'],
      verifying:['completed','告警、组串电流和连续发电验证通过']
    };
    const [next,title]=transitions[active.state];
    timer=setTimeout(()=>advance(active.id,active.state,next,title),['dispatched','onsite'].includes(active.state)?4000:1800);
  }
  function start(name){
    const p=PLANTS.find(plant=>plant.name===name)||PLANTS.find(plant=>plant.name==='苏州仿真电站')||PLANTS[0];
    if(!p){toast('请等待仿真管理端发布电站');return;}
    const existing=tasks.find(task=>task.pid===p.id&&task.state!=='completed');
    if(existing){selected=existing.id;return existing;}
    const id=globalThis.crypto?.randomUUID?.()||'task-'+Date.now();
    const task={id,pid:p.id,name:p.name,rated:p.invKw||100,order:'WO-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+String(tasks.length+1).padStart(3,'0'),
      state:'checking',read:false,events:[{state:'checking',title:'已接收逆变器故障处理任务，开始检查日志',time:Date.now()}]};
    const next=[...tasks,task];
    if(next.length>10){
      const oldest=next.findIndex(item=>item.state==='completed');
      if(oldest<0){toast('已有 10 个处理中任务，请先完成现有任务');return;}
      next.splice(oldest,1);
    }
    if(!store(next))return;
    selected=id;
    schedule();
    return task;
  }
  function open(id){
    closeAppMenu();selected=id||current()?.id||null;
    const task=current();
    if(task)showChat(task);
    else askAI('为什么我的逆变器现在不工作了？');
  }
  function showChat(task){
    openXY();document.getElementById('xy-intro').classList.add('hide');document.getElementById('xy-chat').classList.add('on');
    const message=task.state==='checking'
      ? '我先帮你检查「'+task.name+'」逆变器的运行日志和告警，确认原因后继续跟进处理。'
      : '「'+task.name+'」'+status(task)+'。下面是最新处理进展。';
    const row=addMsg('ai',message);
    row.querySelector('.bubble').append(card(task));

  }
  function card(task){
    const box=el('section','tf-card');box.dataset.taskId=task.id;
    const header=el('div','tf-card-head');header.append(el('strong','','随任务而行'),el('small','tf-badge','场景演练'));
    box.append(header,el('h3','',status(task)),el('p','tf-muted',task.name+' · 逆变器 '+task.pid+'-INV'));
    const line=el('ol','tf-timeline');
    steps.forEach((title,index)=>{
      const state=stage(task),done=index<state,active=index===state;
      const li=el('li',done?'done':active?'active':'');
      li.append(el('span','tf-step-icon',done?'✓':active?'●':'○'));
      const text=el('div');text.append(el('strong','',title));
      if(index<=state)text.append(el('p','',note(task,index)));
      li.append(text);line.append(li);
    });
    box.append(line);
    if(stage(task)>=1){
      const details=el('details','tf-chat-details');details.dataset.section='diagnosis';
      details.append(el('summary','','查看故障原因与日志'),evidence(task));box.append(details);
    }
    if(stage(task)>=2){
      const order=el('div','tf-chat-order');
      order.append(el('strong','','安装商维修工单'),el('p','',task.order),el('p','tf-muted','属地安装商 · 张工 · '+status(task)));
      box.append(order);
    }
    if(task.state==='completed'){
      const result=el('div','tf-success');
      result.append(el('strong','','设备已恢复正常'),
        el('p','','✓ 直流侧告警已消除'),
        el('p','','✓ 组串电流 0.2 A → 7.5 A'),
        el('p','','✓ 输出功率 '+(task.rated*.12).toFixed(1)+' kW → '+(task.rated*.65).toFixed(1)+' kW'),
        el('p','','✓ 连续发电验证通过'));
      box.append(result);
    }
    const history=el('details','tf-chat-details');history.dataset.section='history';
    history.append(el('summary','','查看完整处理记录'));
    for(const event of task.events)history.append(el('p','tf-muted',clock(event.time)+' · '+event.title));
    box.append(history);
    const actions=el('div','tf-actions');
    if(task.state==='completed'){
      const done=button(task.read?'已确认完成':'确认已恢复',()=>{
        if(!store(tasks.map(item=>item.id===task.id?{...item,read:true}:item)))return;
        updateChatCards();
      },'tf-primary');
      done.disabled=task.read;actions.append(done);
    }else{
      actions.append(button('查看最新进展',()=>{
        const fresh=tasks.find(item=>item.id===task.id);
        if(fresh){updateChatCards();toast(status(fresh));}
      }));
    }
    box.append(actions);
    box.append(el('small','tf-muted','工单、维修反馈与复测数据来自本次演练场景。'));
    return box;
  }
  function updateChatCards(){
    for(const node of document.querySelectorAll('#xy-chat .tf-card[data-task-id]')){
      const task=tasks.find(item=>item.id===node.dataset.taskId);
      if(task){
        const expanded=[...node.querySelectorAll('details[open][data-section]')].map(detail=>detail.dataset.section);
        const next=card(task);
        for(const detail of next.querySelectorAll('details[data-section]'))detail.open=expanded.includes(detail.dataset.section);
        node.replaceWith(next);
      }
    }
  }
  function evidence(task){
    const section=el('section','tf-section');
    section.append(el('h3','','日志与诊断依据'));
    section.append(el('p','tf-muted','本次场景日志'));
    const rated=task.rated;
    for(const text of [
      '14:05 · DC_INPUT_ABNORMAL · 直流输入异常',
      '14:06 · 组串 1 电流 0.2 A，同组其余组串约 7.5 A',
      '14:06 · 输出功率由 '+(rated*.65).toFixed(1)+' kW 降至 '+(rated*.12).toFixed(1)+' kW',
      '判断 · 直流侧回路异常，疑似连接松动或组串回路接触不良，需现场核实。',
      '处理方案 · 安装商检查直流连接与组串回路，维修后复测。'
    ])section.append(el('p','',text));
    return section;
  }
  function handle(q){
    if(/^随任务而行[。！!\s]*$/.test(q)||/查看.*(故障任务|维修任务)|任务进展|任务详情/.test(q)){
      open();return true;
    }
    const ownerQuestion=/逆变器/.test(q)&&/不工作|不运行|不发电|没发电|停止工作|停止运行|停机|故障|异常|坏了|启动不了|没有功率|没反应/.test(q);
    if(ownerQuestion||/随任务而行.*(开始|演示)/.test(q)){
      const named=PLANTS.filter(p=>q.includes(p.name));
      if(named.length>1){addMsg('ai','请指定一个电站处理故障。');return true;}
      const task=start(named[0]?.name);
      if(task)showChat(task);return true;
    }
    if(/修好了吗|修到哪了|处理得怎么样|进展怎么样|恢复了吗|维修进展|安装商.*(到了|来了吗|接单)/.test(q)){
      if(current()){showChat(current());return true;}
    }
    if(/^(好了|已经恢复了|修好了|确认已恢复)[。！!？?\s]*$/.test(q)&&current()?.state==='completed'){
      const task=current();
      if(store(tasks.map(item=>item.id===task.id?{...item,read:true}:item))){updateChatCards();addMsg('ai','已确认设备恢复，本次故障处理已完成。');}
      return true;
    }
    return false;
  }
  const entry=el('a','','随任务而行 ›');entry.href='#task-follow';entry.setAttribute('role','menuitem');entry.onclick=event=>{event.preventDefault();open();};
  document.getElementById('app-more-menu').append(entry);
  globalThis.TaskFollowDemo=Object.freeze({handle,open});
  schedule();
})();
