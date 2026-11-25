(function (global) {
  'use strict';
  async function request(path, { token, method = 'GET', data, signal } = {}) {
    let payload = data ? JSON.stringify(data) : undefined;
    const headers = { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) };
    if (path === 'state' && method === 'POST' && data?.snapshot && payload.length > 12000 && typeof CompressionStream === 'function') {
      payload = await new Response(new Blob([payload]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
      headers['Content-Encoding'] = 'gzip';
    }
    const response = await fetch('/api/workspace/' + path, {
      method, cache: 'no-store', credentials: 'same-origin', signal,
      headers,
      ...(data ? { body: payload } : {}),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(body.error?.message || (response.status === 408 || response.status === 504 ? '上传连接超时，请检查网络后重试' : '共享服务连接失败（HTTP ' + response.status + '）')); error.status = response.status; throw error; }
    return body;
  }
  global.WorkspaceClient = Object.freeze({ request });
})(globalThis);
