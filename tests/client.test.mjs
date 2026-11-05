import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function client(chunks) {
  const context = vm.createContext({ TextDecoder, AbortController, fetch: async () => new Response(new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } })) });
  vm.runInContext(fs.readFileSync(new URL('../public/js/api-client.js', import.meta.url), 'utf8'), context);
  return context.SolarApi;
}
test('SSE parser preserves split UTF-8, CRLF boundaries and final event without newline', async () => {
  const data = new TextEncoder().encode(': keepalive\r\n\r\ndata: {"choices":[{"delta":{"content":"你好"}}]}\r\n\r\ndata: [DONE]');
  const chunks = Array.from(data, byte => Uint8Array.of(byte));
  let rendered = '';
  const result = await client(chunks).chat({ messages: [], onDelta: value => { rendered = value; } });
  assert.equal(result, '你好'); assert.equal(rendered, result);
});
test('truncated SSE and upstream event errors are visible instead of silent success', async () => {
  const encode = text => [new TextEncoder().encode(text)];
  await assert.rejects(client(encode('data: {"choices":[{"delta":{"content":"partial"}}]}\n\n')).chat({ messages: [] }), /连接中断/);
  await assert.rejects(client(encode('data: {"error":{"message":"rate limit"}}\n\n')).chat({ messages: [] }), /rate limit/);
});
