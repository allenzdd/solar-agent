import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createServer } from '../server.mjs';

const publicRoot = new URL('../public/', import.meta.url);
test('page scripts compile together; local asset references exist; retired integration is absent', () => {
  for (const page of ['index.html', 'simulator.html']) {
    const html = fs.readFileSync(new URL(page, publicRoot), 'utf8');
    const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(match => fs.readFileSync(new URL(match[1], publicRoot), 'utf8'));
    new vm.Script(scripts.join('\n'));
    for (const match of html.matchAll(/(?:src|href)="((?:js|css|vendor)\/[^"?#]+)"/g)) assert.ok(fs.existsSync(new URL(match[1], publicRoot)), match[1]);
  }
  function scan(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(filename);
    else if (/\.(js|html|css)$/.test(filename)) assert.doesNotMatch(fs.readFileSync(filename, 'utf8'), /workbuddy|wbpk_|oauthRelay|cloudReady|ownKey/i);
  } }
  scan(fileURLToPath(publicRoot));
});
test('Node serves latest assets, config, validation errors and protects secrets', async () => {
  const server = createServer({ DEEPSEEK_API_KEY: 'private-test-key', DEEPSEEK_MODEL: 'deepseek-flash' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    for (const route of ['/', '/simulator.html', '/js/monitor.js', '/css/monitor.css']) assert.equal((await fetch(base + route)).status, 200);
    const config = await (await fetch(base + '/api/config')).text();
    assert.match(config, /deepseek-flash/); assert.doesNotMatch(config, /private-test-key/);
    for (const route of ['/.env', '/..%5c.env', '/server/api.mjs']) assert.ok((await fetch(base + route)).status >= 400);
    const bad = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"messages":[null]}' });
    assert.equal(bad.status, 400);
    const good = await fetch(base + '/api/health'); assert.equal(good.status, 200);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
test('Node HTTP adapter delivers the first model chunk before the upstream stream closes', async () => {
  let upstream;
  const server = createServer({ DEEPSEEK_API_KEY: 'test' }, { fetchImpl: async () => new Response(new ReadableStream({ start(controller) {
    upstream = controller;
    controller.enqueue(new TextEncoder().encode('data: first\n\n'));
  } })) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://public-proxy.example' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }], stream: true }),
      signal: AbortSignal.timeout(3000),
    });
    const reader = response.body.getReader();
    assert.match(new TextDecoder().decode((await reader.read()).value), /first/);
    upstream.close(); assert.equal((await reader.read()).done, true);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
