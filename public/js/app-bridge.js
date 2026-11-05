// The APP reads server snapshots only; browser storage is used solely for preferences and operator credentials.
(function (global) {
  'use strict';
  let token = '', busy = false, lastPoll = 0, cached = null;
  try { token = sessionStorage.getItem('solar_app_control') || ''; } catch {}
  let ackBusy = false, connectionError = '';
  function configureControl() {
    const value = global.prompt('请输入管理端提供的 APP 控制口令。只查看电站和对话无需填写。');
    if (value === null) return false;
    token = value.trim();
    try { if (token) sessionStorage.setItem('solar_app_control', token); else sessionStorage.removeItem('solar_app_control'); } catch {}
    return Boolean(token);
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
    if (!token && !configureControl()) throw new Error('尚未配置 APP 控制口令');
    try { return await WorkspaceClient.request('commands', { method: 'POST', token, data: input }); }
    catch (cause) { if (cause.status === 401) { token = ''; try { sessionStorage.removeItem('solar_app_control'); } catch {} } throw cause; }
  }
  async function acknowledgment(id) {
    if (!token || ackBusy) return null;
    ackBusy = true;
    try { const result = await WorkspaceClient.request('commands/' + encodeURIComponent(id), { token }); return result.command; }
    finally { ackBusy = false; }
  }
  global.AppBridge = Object.freeze({ state, command, acknowledgment, configureControl, get connectionError() { return connectionError; } });
})(globalThis);
