(function (global) {
  'use strict';
  async function request(path, { token, method = 'GET', data, signal } = {}) {
    const response = await fetch('/api/workspace/' + path, {
      method, cache: 'no-store', credentials: 'same-origin', signal,
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(body.error?.message || '共享服务连接失败'); error.status = response.status; throw error; }
    return body;
  }
  global.WorkspaceClient = Object.freeze({ request });
})(globalThis);
