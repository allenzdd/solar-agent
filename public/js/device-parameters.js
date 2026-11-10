(function(){
  'use strict';
  const KEY='xy-device-parameters:';
  const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  const button=(text,fn,cls='')=>{const node=el('button',cls,text);node.type='button';node.onclick=fn;return node;};
  const layer=el('section','dp-layer');layer.hidden=true;layer.setAttribute('aria-label','设备参数设置');
  document.querySelector('.screen').append(layer);
  let plant=null,mode='storage',draft={},dismissed='',panel=null,welcome=true;
  function limits(){return mode==='storage'?{charge:plant.batKw||100,discharge:plant.batKw||100,target:Math.min(98,plant.socMax??98)}:{output:plant.invKw||100,reactive:100};}
  function defaults(){return mode==='storage'?{charge:plant.batKw||100,discharge:plant.batKw||100,target:90}:{output:plant.invKw||100,reactive:0};}
  function fields(){return mode==='storage'?[['charge','最大充电功率','kW'],['discharge','最大放电功率','kW'],['target','目标 SOC','%']]:[['output','最大有功功率','kW'],['reactive','无功功率比例','%']];}
  function read(){try{return {...defaults(),...JSON.parse(localStorage.getItem(KEY+plant.id+':'+mode))};}catch{return defaults();}}
  function issues(){
    const max=limits();
    return fields().filter(([key])=>!Number.isFinite(draft[key])||draft[key]<0||draft[key]>max[key]||key==='target'&&draft[key]<(plant.socMin??10)).map(([key,label,unit])=>({
      key,label,unit,limit:max[key],recommended:key==='target'?Math.max(plant.socMin??10,Math.min(90,max[key])):max[key],
      invalid:!Number.isFinite(draft[key])||draft[key]<0||key==='target'&&draft[key]<(plant.socMin??10)
    }));
  }
  function context(){
    if(layer.hidden){SolarReminders.setContext(null);return;}
    const invalid=issues();
    SolarReminders.setContext({
      kind:'device-parameters',anchor:'bottom-right',attention:invalid.length>0&&!panel,
      visible:(welcome||invalid.length>0)&&JSON.stringify(draft)!==dismissed&&!panel&&!document.getElementById('xiaoyuan').classList.contains('open'),
      actionLabel:'去对话',
      title:invalid.length?'发现'+recommendationLabel(invalid[0])+'配置超限':'小源正在陪你设置参数',
      summary:invalid.length?invalid[0].label+'当前 '+(Number.isFinite(draft[invalid[0].key])?draft[invalid[0].key]:'未填写')+' '+invalid[0].unit+'，合理区间 '+(invalid[0].key==='target'?(plant.socMin??10):0)+'–'+invalid[0].limit+' '+invalid[0].unit+'，推荐 '+invalid[0].recommended+' '+invalid[0].unit+'。':'输入参数时，我会即时检查设备限值，并解释异常原因。可点“演示超限提醒”体验。',
      onOpen:ask
    });
  }
  function load(){draft=read();dismissed='';welcome=true;render();}
  function open(pid,deviceMode){
    const candidate=PLANTS.find(p=>p.id===pid)||PLANTS.find(p=>p.name==='苏州仿真电站')||PLANTS[0];
    if(!candidate){toast('请等待仿真管理端发布电站数据');return;}
    closeAppMenu();closeXY();plant=candidate;mode=deviceMode==='inverter'?'inverter':'storage';layer.hidden=false;load();
  }
  function close(){panel?.remove();panel=null;layer.hidden=true;SolarReminders.setContext(null);}
  function row(key,label,unit){
    const field=el('label','dp-field'),input=el('input'),wrap=el('span','dp-value');
    input.type='number';input.min='0';input.step='1';input.value=draft[key];input.setAttribute('aria-label',label);
    const range=el('small','dp-range');
    range.textContent='合理区间 '+(key==='target'?(plant.socMin??10):0)+'–'+limits()[key]+' '+unit;
    const sync=()=>{const issue=issues().some(item=>item.key===key);input.setAttribute('aria-invalid',String(issue));range.classList.toggle('dp-range-warning',issue);};
    input.oninput=()=>{draft[key]=input.value===''?NaN:input.valueAsNumber;welcome=false;sync();context();};
    sync();
    const description=el('span','dp-description');description.append(el('span','',label),range);field.append(description);wrap.append(input,el('span','',unit));field.append(wrap);return field;
  }
  function render(){
    layer.replaceChildren();
    const header=el('header','dp-top');header.append(button('‹',close,'dp-back'),el('span','','设备参数设置'),el('small','',''));
    const body=el('div','dp-body'),station=el('div','dp-station');
    station.append(el('span','dp-station-icon','▥'),el('div','',plant.name),el('small','','运行参数演示'));
    const tabs=el('div','dp-tabs');
    for(const [id,label]of [['storage','储能'],['inverter','逆变器']]){
      const tab=button(label,()=>{mode=id;load();});tab.setAttribute('aria-pressed',String(mode===id));tabs.append(tab);
    }
    const card=el('section','dp-card');
    card.append(el('h3','',mode==='storage'?'储能系统运行参数':'逆变器运行参数'));
    if(mode==='storage'){
      const soc=el('div','dp-soc');soc.append(el('span','','当前 SOC'),el('strong','',Number.isFinite(plant.soc)?Math.round(plant.soc)+'%':'—'));card.append(soc);
    }
    for(const field of fields())card.append(row(...field));
    const max=limits();
    card.append(el('p','dp-muted','设备额定功率 '+(mode==='storage'?max.charge:max.output)+' kW'));
    const hint=el('div','dp-hint');hint.append(el('strong','','小源参数助手'),el('p','','设置超出设备范围时，小源会主动提醒。采用建议后，可返回核对并保存。'));
    const tools=el('div','dp-tools');tools.append(button('问小源',ask),button('演示超限提醒',()=>{
      const key=mode==='storage'?'charge':'output';
      draft[key]=Math.round(limits()[key]*1.5);
      dismissed='';welcome=false;panel?.remove();panel=null;
      closeXY();render();
    }));
    const footer=el('footer','dp-footer');footer.append(button('保存参数',save,'dp-primary'));
    body.append(station,tabs,card,hint,tools);layer.append(header,body,footer);context();
  }
  function recommend(){for(const issue of issues())draft[issue.key]=issue.recommended;panel?.remove();panel=null;dismissed='';welcome=false;render();toast('已回填推荐值，请核对后保存');}
  function save(){
    if(issues().length){diagnose();return;}
    try{localStorage.setItem(KEY+plant.id+':'+mode,JSON.stringify(draft));}
    catch{toast('当前浏览器无法保存参数');return;}
    welcome=false;context();toast('设备参数已保存');
  }
  function recommendationLabel(issue){
    return {charge:'充电功率',discharge:'放电功率',target:'目标 SOC',output:'有功功率',reactive:'无功功率比例'}[issue.key];
  }
  function explanation(issue){
    if(issue.invalid)return '当前数值不在有效范围内，请调整到允许区间。';
    if(issue.key==='target')return '当前目标 SOC 超出设备设置上限，建议调整至允许范围内。';
    if(issue.key==='reactive')return '当前无功比例超出允许范围，建议调整至 100% 以内。';
    return '当前设备额定功率为 '+issue.limit+' '+issue.unit+'，建议'+recommendationLabel(issue)+'不超过设备允许的最大值。';
  }
  function resultCard(invalid,onApply){
    const box=el('section','dp-result');
    box.append(el('p','dp-warning','检测到'+recommendationLabel(invalid[0])+'配置超出设备允许范围'));
    for(const issue of invalid){
      const result=el('div','dp-result-item');
      result.append(el('p','dp-current','当前设置 '+(Number.isFinite(draft[issue.key])?draft[issue.key]:'未填写')+' '+issue.unit),
        el('p','',explanation(issue)));
      const advice=el('section','dp-advice');
      advice.append(el('small','','✓ AI 建议'),el('strong','dp-recommend','推荐'+recommendationLabel(issue)+' '+issue.recommended+' '+issue.unit),
        el('p','dp-muted','原因 '+(issue.invalid?'当前参数数值无效':issue.key==='target'?'当前设备 SOC 上限限制':issue.key==='reactive'?'当前无功功率比例范围限制':'当前设备额定功率限制')),
        el('p','dp-muted','预计影响 '+(issue.invalid?'无效参数将无法保存。':'超限配置可能无法执行，或触发设备保护。')));
      result.append(advice);box.append(result);
    }
    const detail=el('details','dp-detail');
    const summary=el('summary','','查看详细诊断');
    detail.append(summary);
    for(const issue of invalid){
      detail.append(el('p','',issue.label+'允许区间 '+(issue.key==='target'?(plant.socMin??10):0)+'–'+issue.limit+' '+issue.unit+'。建议将当前值调整为 '+issue.recommended+' '+issue.unit+'。'));
    }
    const actions=el('div','dp-actions');
    const detailsButton=button('查看详细诊断',()=>{detail.open=!detail.open;detailsButton.setAttribute('aria-expanded',String(detail.open));});
    detailsButton.setAttribute('aria-expanded','false');
    actions.append(detailsButton,button('采用推荐值',onApply,'dp-primary'));
    box.append(detail,actions);return box;
  }
  function diagnose(){
    const invalid=issues();
    if(!invalid.length){ask();return;}
    panel?.remove();panel=el('div','dp-modal');
    const box=el('section','dp-diagnosis');box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','小源参数诊断');
    const header=el('header'),heading=el('span','dp-result-heading');
    heading.append(el('strong','','✦ AI 参数助手'),el('small','dp-check-status','已结合设备参数检查'));
    header.append(heading,button('×',()=>{dismissed=JSON.stringify(draft);panel.remove();panel=null;context();}));
    box.append(header,resultCard(invalid,recommend));
    panel.append(box);layer.append(panel);context();
  }
  function ask(){
    openXY();document.getElementById('xy-intro').classList.add('hide');document.getElementById('xy-chat').classList.add('on');
    const invalid=issues();
    const reply=addMsg('ai',plant.name+' · '+(mode==='storage'?'储能':'逆变器')+'参数诊断');
    const bubble=reply.querySelector('.bubble');
    if(invalid.length){
      bubble.append(resultCard(invalid,()=>{recommend();closeXY();context();}));
    }else{
      bubble.append(el('p','','当前参数均在设备允许范围内。可以继续设置参数，或返回参数页保存。'));
    }
    const actions=el('div','dp-actions');actions.append(button('返回参数页',()=>{closeXY();context();}));
    bubble.append(actions);context();
  }
  function handle(q){
    if(/打开.*设备参数|设备参数设置演示/.test(q)){open();return true;}
    if(layer.hidden)return false;
    const match=/(最大充电功率|最大放电功率|目标\s*SOC|最大有功功率|无功功率比例).{0,8}?(-?\d+(?:\.\d+)?)/i.exec(q);
    if(match){
      const field=fields().find(([,label])=>label.replace(/\s/g,'').toLowerCase()===match[1].replace(/\s/g,'').toLowerCase());
      if(!field){addMsg('ai','请先切换到相应设备的参数页。');return true;}
      draft[field[0]]=Number(match[2]);dismissed='';render();ask();return true;
    }
    if(/^(采用推荐值|应用推荐值|按推荐值设置)[。！!\s]*$/.test(q)){recommend();addMsg('ai','已将推荐值回填到参数页，请返回核对后保存。');return true;}
    if(/^保存参数[。！!\s]*$/.test(q)){if(issues().length)ask();else{save();addMsg('ai','设备参数已保存。');}return true;}
    if(/这个参数|参数.*(为什么|合理|诊断)|为什么.*(功率|限值)/.test(q)){ask();return true;}
    return false;
  }
  layer.addEventListener('keydown',event=>{if(event.key==='Escape'){if(panel){panel.remove();panel=null;context();}else close();}});
  const entry=el('a','','设备参数设置演示 ›');entry.href='#device-parameters';entry.setAttribute('role','menuitem');
  entry.onclick=event=>{event.preventDefault();open();};document.getElementById('app-more-menu').append(entry);
  globalThis.DeviceParameterDemo=Object.freeze({open,handle,refresh:context});
})();
