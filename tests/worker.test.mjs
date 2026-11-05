import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../dist/server/index.js';
test('built Worker serves extracted assets and shared API without bundled secrets', async () => {
  for (const pathname of ['/', '/simulator.html', '/js/monitor-ai.js', '/css/simulator.css']) {
    assert.equal((await worker.fetch(new Request('https://solar.test' + pathname), {})).status, 200);
  }
  const config = await (await worker.fetch(new Request('https://solar.test/api/config'), { DEEPSEEK_MODEL: 'custom-model' })).json();
  assert.equal(config.model, 'custom-model'); assert.equal(config.configured, false);
  for (const pathname of ['/.env', '/server.mjs', '/constructor', '/vendor/workbuddy-cloud-sdk.global.js']) {
    assert.equal((await worker.fetch(new Request('https://solar.test' + pathname), {})).status, 404);
  }
});
