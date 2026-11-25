/* Manager session, durable configuration, publisher lease and command acknowledgments. */
(function (global) {
  'use strict';
  let token = '', owner = '', ready = false, session = null, uploading = false, configBusy = false;
  let pendingSnapshot = null, pendingConfig = null, lastSnapshotAt = 0, pollBusy = false;
  let nextSnapshotAttemptAt = 0, snapshotFailures = 0;
  const seen = new Set(), pendingAcks = new Map();
  try {
    token = sessionStorage.getItem('solar_manager_token') || '';
    owner = sessionStorage.getItem('solar_manager_owner') || '';
  } catch {}
  if(!owner) owner=globalThis.crypto?.randomUUID?.() || 'manager-'+Date.now()+'-'+Math.random().toString(36).slice(2);
  try {sessionStorage.setItem('solar_manager_owner',owner);} catch {}
  const status = message => { document.getElementById('manager-sync').textContent = message; };
  const loginMessage = message => { document.getElementById('manager-login-message').textContent = message; };
  async function send(path, method, data) { return WorkspaceClient.request(path, { token, method, data, signal: AbortSignal.timeout(12000) }); }
  function loseLease(cause) {
    if (cause.status === 409 && ready) {
      ready = false;
      location.reload(); // Re-enter as a viewer if another manager has taken over.
      return;
    }
    if (cause.status === 401 || cause.status === 409) {
      ready = false; status(cause.message);
      document.getElementById('manager-access').hidden = false;
      document.body.removeAttribute('data-manager-ready'); loginMessage(cause.message);
    } else status('同步失败，将自动重试：' + cause.message);
  }
  function backupLocal() {
    try { const old = localStorage.getItem('fs_sim_plants_v2'); if (old && !localStorage.getItem('fs_sim_plants_v2_before_server')) localStorage.setItem('fs_sim_plants_v2_before_server', old); } catch {}
  }
  function restoreRuntime(snapshot) {
    if (!snapshot?.plants || !snapshot.time) return;
    SIMTIME.utc = snapshot.time.utc; SIMTIME.speed = snapshot.time.speed; SIMTIME.running = snapshot.time.running; SIMTIME.anchored = true;
    const fields = ['invTemp','soc','batTemp','dayPv','dayLoad','dayImp','dayExp','dayChg','dayDis','dayRev','daySelf','totalBase','pv','load','bat','grid','demand','shed','curtail'];
    PLANTS.forEach(plant => {
      const saved = snapshot.plants.find(p => p.id === plant.id); if (!saved) return;
      for (const field of fields) if (Number.isFinite(saved[field])) plant[field] = saved[field];
      // The clock was restored too: keep its local day key, not the seed's initial day.
      plant.local = localTime(plant.tz, SIMTIME.utc); plant.dayKey = plant.local.dayKey;
      plant.inverterThermal=saved.inverterThermal||null;
      if(saved.targetSoc){plant.targetSoc={...saved.targetSoc};plant.batMode=saved.batMode||'idle';}
      if (saved.geo && Number.isFinite(saved.geo.lat) && Number.isFinite(saved.geo.lng)) plant.geo = { ...saved.geo };
      if (Number.isFinite(saved.totalRev)) plant.totalRev = saved.totalRev - (saved.dayRev || 0);
      if (saved.hourly?.length === 24) plant.hourly = saved.hourly.slice();
      if (Array.isArray(saved.hist)) plant.hist = saved.hist.slice(-HIST_LEN);
      if (Array.isArray(saved.events)) plant.events = saved.events.slice();
    });
    lastTickWall = Date.now();
  }
  let initialized = false;
  let viewer = false, loading = false, reading = false;
  function showViewer(snapshot) {
    const lines = (snapshot?.plants || []).map(p => p.name + '　光伏 ' + (p.pv ?? '—') + ' kW　储能 SOC ' + (p.soc ?? '—') + '%');
    document.getElementById('viewer-stations').textContent = lines.join('\n') || '等待电站快照';
    status('已登录 · 共享查看' + (snapshot?.ts ? ' · 最新快照 ' + new Date(snapshot.ts).toLocaleTimeString() : ''));
  }
  setInterval(async () => {
    if (!viewer || reading || loading) return;
    reading = true;
    try { const data = await send('state','GET'); if (viewer) showViewer(data.snapshot); }
    catch (cause) { if (viewer) status('读取快照失败：' + cause.message); }
    finally { reading = false; }
  }, 3000);
  async function login(takeover = false, automatic = false) {
    if (loading) return;
    loading = true;
    try {
      const entered = document.getElementById('manager-token').value.trim(); if (entered) token = entered;
      loginMessage('正在连接共享服务…');
      if(token) {
        session=await send('session','POST',{remember:document.getElementById('manager-remember').checked});
        token='';
        try {sessionStorage.removeItem('solar_manager_token');} catch {}
      } else session=await send('session','GET');
      const [running, { snapshot }] = await Promise.all([
        send('lease', 'POST', { owner, takeover }).then(() => true, cause => {
          if (!takeover && cause.status === 409) return false;
          throw cause;
        }),
        WorkspaceClient.request('state', {signal: AbortSignal.timeout(12000)})
      ]);
      backupLocal();
      if (session.config) { try { localStorage.setItem('fs_sim_plants_v2', JSON.stringify(session.config)); } catch {} }
      document.getElementById('manager-access').hidden = true;
      document.body.dataset.managerReady = 'true';
      document.getElementById('manager-token').value = '';
      document.getElementById('manager-control-code').value = session.appControlToken;
      viewer = !running;
      document.body.dataset.managerMode = viewer ? 'viewer' : 'runner';
      document.getElementById('manager-viewer').hidden = !viewer;
      if (viewer) { showViewer(snapshot); return; }
      if (initialized) { location.reload(); return; }
      if (!initialized) { simInit(snapshot); initialized = true; restoreRuntime(snapshot); }
      ready = true;
      savePlantCfg(); simRender();
      status('已连接共享服务，APP 可在其他设备查看');
    } catch (cause) {
      if(cause.status===401) {token='';try{sessionStorage.removeItem('solar_manager_token');}catch{}}
      loginMessage(automatic && cause.status===401?'请输入管理口令，登录后可记住 30 天。':cause.message);
      if (viewer) status(cause.message);
    } finally { loading = false; }
  }
  async function flushConfig() {
    if (!ready || configBusy || !pendingConfig) return;
    configBusy = true; const plants = pendingConfig; pendingConfig = null;
    try { await send('config', 'PUT', { owner, plants }); }
    catch (cause) { if (!pendingConfig) pendingConfig = plants; loseLease(cause); }
    finally { configBusy = false; }
  }
  async function flushSnapshot() {
    if (!ready || uploading || !pendingSnapshot || Date.now() - lastSnapshotAt < 2500 || Date.now() < nextSnapshotAttemptAt) return;
    uploading = true; const snapshot = pendingSnapshot; pendingSnapshot = null;
    try {
      try { await send('state', 'POST', { owner, snapshot }); }
      catch (cause) {
        if (cause.status !== 409) throw cause;
        // Renew an expired lease without taking it from another active management page.
        await send('lease', 'POST', { owner });
        await send('state', 'POST', { owner, snapshot });
      }
      lastSnapshotAt = Date.now(); snapshotFailures = 0; nextSnapshotAttemptAt = 0;
      status('共享数据已更新 · ' + new Date().toLocaleTimeString());
    }
    catch (cause) {
      if (!pendingSnapshot) pendingSnapshot = snapshot;
      snapshotFailures++; nextSnapshotAttemptAt = Date.now() + Math.min(30000, 3000 * 2 ** Math.min(snapshotFailures - 1, 4));
      loseLease(cause);
    }
    finally { uploading = false; }
  }
  async function commands() {
    if (!ready || pollBusy) return;
    pollBusy = true;
    try {
      const result = await send('commands', 'GET');
      applyThermal(result.thermal);
      let targetChanged=false;
      for(const setting of result.targetSocSettings||[])targetChanged=applyServerTargetSoc(setting)||targetChanged;
      if(targetChanged){savePlantCfg();simRender();publishState();}
      for (const command of result.commands) {
        if (seen.has(command.id)) continue;
        seen.add(command.id); if (seen.size > 1000) seen.delete(seen.values().next().value);
        pollCmd(command);
      }
    } catch (cause) { loseLease(cause); }
    finally { pollBusy = false; }
  }
  global.ManagerBridge = Object.freeze({
    login,
    get serverConfig() { return session?.config ?? null; },
    saveConfig(plants) { pendingConfig = plants; void flushConfig(); },
    publish(snapshot) { if (!ready) return; pendingSnapshot = snapshot; void flushSnapshot(); },
    ack(command, ok, msg) { if (ready) { pendingAcks.set(command.id, { owner, ok, msg }); void flushAcks(); } },
  });
  let ackBusy = false;
  async function flushAcks() {
    if (!ready || ackBusy) return;
    ackBusy = true;
    try { for (const [id, data] of pendingAcks) { await send('commands/' + encodeURIComponent(id) + '/ack', 'POST', data); pendingAcks.delete(id); } }
    catch (cause) { loseLease(cause); }
    finally { ackBusy = false; }
  }
  document.getElementById('manager-login-form').addEventListener('submit', event => { event.preventDefault(); void login(); });
  document.getElementById('manager-takeover').addEventListener('click', () => { void login(true); });
  document.getElementById('viewer-takeover').addEventListener('click', () => { void login(true); });
  document.getElementById('manager-logout').addEventListener('click', async () => {
    ready=false;
    try {await send('session','DELETE');token='';try{sessionStorage.removeItem('solar_manager_token');sessionStorage.removeItem('solar_manager_owner');}catch{}location.reload();}
    catch(cause){status('退出失败，请恢复连接后重试：'+cause.message);}
  });
  document.getElementById('manager-show-code').addEventListener('click', () => { const input = document.getElementById('manager-control-code'); input.type = input.type === 'password' ? 'text' : 'password'; });
  function applyThermal(plants) {
    if(!Array.isArray(plants))return;
    for(const data of plants){const p=PLANTS.find(p=>p.id===data.id);if(!p)continue;p.inverterThermal=data.inverterThermal||null;if(Number.isFinite(data.invTemp))p.invTemp=data.invTemp;}
  }
  const lab = document.getElementById('reminder-plant');
  for(const button of document.querySelectorAll('[data-intent-action]'))button.addEventListener('click',async()=>{
    const message=document.getElementById('intent-lab-status');
    if(!ready){message.textContent='请先登录管理端。';return;}
    button.disabled=true;
    try{const result=await send('intent-event','POST',{action:button.dataset.intentAction});message.textContent=result.message;}
    catch(cause){message.textContent=cause.message;}
    finally{button.disabled=false;}
  });
  let labPlants = '';
  function refreshLab() {
    if (!ready) return;
    const signature = JSON.stringify(PLANTS.map(p => [p.id, p.name]));
    if (signature === labPlants) return;
    labPlants = signature; const previous = lab.value; lab.replaceChildren();
    for (const p of PLANTS) { const option = document.createElement('option'); option.value = p.id; option.textContent = p.name; lab.append(option); }
    if (PLANTS.some(p => p.id === previous)) lab.value = previous;
  }
  for (const button of document.querySelectorAll('[data-reminder-scenario]')) button.addEventListener('click', async () => {
    const message = document.getElementById('reminder-lab-status');
    if (!ready || !lab.value) { message.textContent = '请先登录并创建电站。'; return; }
    button.disabled = true;
    try {
      const result=await send('reminders/scenario', 'POST', { plantId: lab.value, type: button.dataset.reminderScenario });
      applyThermal(result.snapshot?.plants);simRender();
      message.textContent=button.dataset.reminderScenario==='clear'?'所选电站全部演练已结束，逆变器温度已恢复正常。':button.dataset.reminderScenario==='inverter_heat'?'升温演练已启动：45℃起，每个仿真分钟升高0.25℃；趋势形成后自动生成过热风险提醒。':`“${button.textContent}”提醒已生成，请打开 APP 查看小源提醒（约5秒同步）。可点击“去对话”继续演示；再次点击可重放。`;
    } catch (cause) { message.textContent = cause.message; }
    finally { button.disabled = false; }
  });
  setInterval(refreshLab, 1500);
  document.getElementById('reminder-reset').addEventListener('click', async event => {
    const button = event.currentTarget, message = document.getElementById('reminder-lab-status');
    if (!ready) { message.textContent = '请先登录管理端。'; return; }
    button.disabled = true;
    try {
      const result = await send('reminders/reset', 'POST', {});
      applyThermal(result.snapshot?.plants);simRender();
      message.textContent = `已结束全部演练，逆变器温度恢复正常，收起 ${result.archived} 条当前提醒。APP 约5秒内同步；再次点击演练才会升温。`;
    } catch (cause) { message.textContent = cause.message; }
    finally { button.disabled = false; }
  });
  setInterval(() => { void flushConfig(); void flushSnapshot(); void commands(); void flushAcks(); }, 1500);
  void login(false, true);
})(globalThis);
