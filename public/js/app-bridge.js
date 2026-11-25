// The APP reads server snapshots only; browser storage is used solely for preferences and operator credentials.
(function (global) {
  'use strict';
  let token = '', busy = false, lastPoll = 0, cached = null;
  try { token = sessionStorage.getItem('solar_app_control') || ''; } catch {}
  let ackBusy = false, connectionError = '';
  let controlDialog=null;
  function configureControl() {
    if(controlDialog)return controlDialog;
    controlDialog=new Promise(resolve=>{
      const mask=document.createElement('div'),form=document.createElement('form'),title=document.createElement('h3'),label=document.createElement('label'),input=document.createElement('input'),help=document.createElement('p'),actions=document.createElement('div'),cancel=document.createElement('button'),submit=document.createElement('button');
      mask.className='app-control-mask';form.className='app-control-dialog';form.setAttribute('role','dialog');form.setAttribute('aria-modal','true');form.setAttribute('aria-label','APP控制权限');title.textContent='APP 控制权限';label.textContent='请输入管理端提供的 APP 控制口令';input.type='password';input.autocomplete='current-password';input.setAttribute('aria-label','APP控制口令');help.textContent='只查看电站和对话无需口令。控制权限仅在本次浏览器会话中保存。';cancel.type='button';cancel.textContent='取消';submit.type='submit';submit.textContent='确认并继续';actions.append(cancel,submit);label.append(input);form.append(title,label,help,actions);mask.append(form);(document.querySelector('.screen')||document.body).append(mask);
      const finish=value=>{mask.remove();controlDialog=null;resolve(value);};
      cancel.addEventListener('click',()=>finish(false));form.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish(false);}});
      form.addEventListener('submit',e=>{e.preventDefault();token=input.value.trim();if(!token){input.focus();return;}try{sessionStorage.setItem('solar_app_control',token);}catch{}finish(true);});input.focus();
    });return controlDialog;
  }
  async function state() {
    if (busy || Date.now() - lastPoll < 1800) return cached;
    busy = true; lastPoll = Date.now();
    try { const result = await WorkspaceClient.request('state', { signal: AbortSignal.timeout(10000) }); cached = result.snapshot; connectionError = ''; }
    catch (cause) { connectionError = cause.message; throw cause; }
    finally { busy = false; }
    return cached;
  }
  async function command(input) {
    const send=()=>WorkspaceClient.request('commands',{method:'POST',token,data:input,signal:AbortSignal.timeout(12000)});
    try{const result=await send();lastPoll=0;return result;}
    catch(cause){
      if(cause.status!==401)throw cause;
      token='';try{sessionStorage.removeItem('solar_app_control');}catch{}
      if(!await configureControl())throw Object.assign(new Error('已取消设置，尚未获得APP控制权限'),{status:401,stage:'before_submit'});
      try{const result=await send();lastPoll=0;return result;}catch(error){if(error.status===401){token='';try{sessionStorage.removeItem('solar_app_control');}catch{}}throw error;}
    }
  }
  async function acknowledgment(id) {
    if (ackBusy) return null;
    ackBusy = true;
    try { const result = await WorkspaceClient.request('commands/' + encodeURIComponent(id), { token,signal:AbortSignal.timeout(10000) }); return result.command; }
    finally { ackBusy = false; }
  }
  global.AppBridge = Object.freeze({ state, command, acknowledgment, configureControl, get connectionError() { return connectionError; } });
})(globalThis);
