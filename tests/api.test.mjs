import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../server/api.mjs';

const env = { DEEPSEEK_API_KEY: 'test-secret', DEEPSEEK_MODEL: 'deepseek-flash' };
const request = (body, options = {}) => new Request('https://solar.test/api/chat', {
  method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://solar.test', ...options.headers },
  body: JSON.stringify(body),
});
const body = { messages: [{ role: 'user', content: 'hello' }], stream: true };
test('configuration never exposes secret; invalid method and malformed input are rejected', async () => {
  const api = createApi({ fetchImpl: () => { throw new Error('must not call provider'); } });
  const config = await (await api(new Request('https://solar.test/api/config'), env)).json();
  assert.deepEqual(config, { service: 'solar-monitor', configured: true, model: 'deepseek-flash' });
  assert.equal((await api(new Request('https://solar.test/api/chat'), env)).status, 405);
  assert.equal((await api(request(body), {})).status, 503);
  for (const messages of [[], [null], [{ role: 'tool', content: 'bad' }], [{ role: 'user', content: [null] }]]) {
    assert.equal((await api(request({ messages }), env)).status, 400);
  }
  assert.equal((await api(new Request('https://solar.test/api/chat', { method: 'POST', body: '{' }), env)).status, 400);
  assert.equal((await api(request(body, { headers: { 'Content-Length': '12000001' } }), env)).status, 413);
});
test('external HTTPS origins and requests without Origin work without deployment-specific configuration', async () => {
  const api = createApi({ fetchImpl: async () => Response.json({ choices: [{ message: { content: 'ok' } }] }) });
  for (const origin of ['https://other.test', 'http://203.0.113.1:8788', 'https://example.trycloudflare.com']) {
    assert.equal((await api(request({ ...body, stream: false }, { headers: { Origin: origin } }), env)).status, 200);
  }
  assert.equal((await api(new Request('https://solar.test/api/chat', { method: 'POST', body: JSON.stringify({ ...body, stream: false }) }), env)).status, 200);
});
test('provider model is server-controlled, images are preserved, stream is forwarded before completion', async () => {
  let captured, push;
  const api = createApi({ fetchImpl: async (url, options) => {
    captured = { url, options };
    return new Response(new ReadableStream({ start(controller) { push = controller; controller.enqueue(new TextEncoder().encode('data: first\n\n')); } }));
  } });
  const input = { ...body, model: 'client-override', messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,AA==' } }] }] };
  const response = await api(request(input), env);
  const reader = response.body.getReader();
  assert.match(new TextDecoder().decode((await reader.read()).value), /first/);
  const payload = JSON.parse(captured.options.body);
  assert.equal(payload.model, 'deepseek-flash');
  assert.deepEqual(payload.messages, input.messages);
  assert.equal(captured.options.headers.Authorization, 'Bearer test-secret');
  push.close(); assert.equal((await reader.read()).done, true);
});
test('upstream errors are redacted and request rate limits reset', async () => {
  let clock = 1000;
  const api = createApi({ now: () => clock, fetchImpl: async () => new Response('test-secret', { status: 401 }) });
  const settings = { ...env, CHAT_RATE_LIMIT: '1' };
  const failure = await api(request(body), settings);
  assert.equal(failure.status, 401); assert.doesNotMatch(await failure.text(), /test-secret/);
  assert.equal((await api(request(body), settings)).status, 429);
  clock += 60001;
  assert.equal((await api(request(body), settings)).status, 401);
});
