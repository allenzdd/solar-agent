/* Browser transport. UI and station rules belong to monitor modules. */
(function (global) {
  'use strict';
  async function checked(response) {
    if (response.ok) return response;
    const payload = await response.json().catch(() => ({}));
    const error = new Error(payload.error?.message || '服务调用失败，请稍后重试'); error.status = response.status; throw error;
  }
  async function config() { return (await checked(await fetch('/api/config', { cache: 'no-store' }))).json(); }
  async function chat({ messages, signal, onDelta, stream = true, maxTokens, onSource }) {
    const response = await checked(await fetch('/api/workspace/chat', {
      credentials:'same-origin',
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, stream, ...(maxTokens ? { max_tokens: maxTokens } : {}) }), signal,
    }));
    if(onSource) onSource(response.headers.get('X-Solar-Data-Source'));
    if (!stream) return response.json();
    if (!response.body) throw new Error('模型未返回内容');
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let buffer = '', text = '', doneEvent = false;
    function event(block) {
      const data = block.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data) return;
      if (data === '[DONE]') { doneEvent = true; return; }
      const payload = JSON.parse(data);
      if (payload.error) throw new Error(payload.error.message || '模型生成中断');
      const delta = payload.choices?.[0]?.delta?.content;
      if (typeof delta === 'string' && delta) { text += delta; if (onDelta) onDelta(text); }
    }
    try {
      while (true) {
        const { value, done } = await reader.read();
        buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
        let boundary;
        while ((boundary = /\r?\n\r?\n/.exec(buffer))) { event(buffer.slice(0, boundary.index)); buffer = buffer.slice(boundary.index + boundary[0].length); }
        if (doneEvent || done) break;
      }
      if (buffer.trim() && !doneEvent) event(buffer);
      if (!doneEvent) throw new Error('模型连接中断，请重试');
      return text;
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  global.SolarApi = Object.freeze({ config, chat });
})(globalThis);
