import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createWorkspaceApi, createR2WorkspaceStore } from '../server/workspace.mjs';
import { createFileWorkspaceStore } from '../server/file-store.mjs';
import { createServer } from '../server.mjs';

const env = { MANAGER_TOKEN: 'manager-secret', APP_CONTROL_TOKEN: 'operator-secret' };
function request(route, method = 'GET', data, token) {
  return new Request('https://solar.test/api/workspace/' + route, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(data ? { 'Content-Type': 'application/json' } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
}
function memory() { const data = new Map(); return { async read(key) { return structuredClone(data.get(key) ?? null); }, async update(key, modify) { const updated = modify(structuredClone(data.get(key) ?? null)); data.set(key, structuredClone(updated)); return updated; } }; }
const plant = { id: 'P1', name: '跨设备测试电站', invKw: 100 };
const snapshot = { v: 3, plants: [plant], time: { utc: 1000 }, agg: {}, alarms: [] };

test('anonymous readers see shared snapshot, never manager config or control secrets', async () => {
  const api = createWorkspaceApi(memory());
  assert.equal((await api(request('config'), env)).status, 401);
  assert.equal((await api(request('state', 'PUT', { owner: 'one', snapshot }), env)).status, 401);
  assert.equal((await api(request('lease', 'POST', { owner: 'one' }, env.MANAGER_TOKEN), env)).status, 200);
  assert.equal((await api(request('config', 'PUT', { owner: 'one', plants: [plant] }, env.MANAGER_TOKEN), env)).status, 200);
  assert.equal((await api(request('state', 'PUT', { owner: 'one', snapshot }, env.MANAGER_TOKEN), env)).status, 200);
  const body = await (await api(request('state'), env)).json();
  assert.equal(body.snapshot.plants[0].name, plant.name);
  assert.doesNotMatch(JSON.stringify(body), /manager-secret|operator-secret/);
  assert.equal((await api(request('config', 'PUT', { owner: 'one', plants: [] }, env.MANAGER_TOKEN), env)).status, 200);
  assert.deepEqual((await (await api(request('config', 'GET', null, env.MANAGER_TOKEN), env)).json()).config, []);
});

test('lease takeover fences the old publisher; queued commands are ordered, idempotent and acknowledged', async () => {
  let time = 1000;
  const api = createWorkspaceApi(memory(), { now: () => time });
  await api(request('lease', 'POST', { owner: 'first' }, env.MANAGER_TOKEN), env);
  assert.equal((await api(request('lease', 'POST', { owner: 'second' }, env.MANAGER_TOKEN), env)).status, 409);
  assert.equal((await api(request('lease', 'POST', { owner: 'second', takeover: true }, env.MANAGER_TOKEN), env)).status, 200);
  assert.equal((await api(request('state', 'PUT', { owner: 'first', snapshot }, env.MANAGER_TOKEN), env)).status, 409);
  assert.equal((await api(request('commands', 'POST', { id: 'c1', type: 'soc' }), env)).status, 401);
  for (const id of ['c1', 'c2', 'c1']) assert.equal((await api(request('commands', 'POST', { id, type: 'soc', plantId: 'P1', min: 20, max: 90 }, env.APP_CONTROL_TOKEN), env)).status, 202);
  const commands = (await (await api(request('commands', 'GET', null, env.MANAGER_TOKEN), env)).json()).commands;
  assert.equal(commands.length, 2); assert.ok(commands[1].ts > commands[0].ts);
  assert.equal((await api(request('commands/c1/ack', 'POST', { owner: 'second', ok: true, msg: '已应用' }, env.MANAGER_TOKEN), env)).status, 200);
  const result = (await (await api(request('commands/c1', 'GET', null, env.APP_CONTROL_TOKEN), env)).json()).command;
  assert.equal(result.status, 'done'); assert.equal(result.ok, true);
  time += 31000;
  assert.equal((await api(request('commands', 'POST', { id: 'c3', type: 'soc' }, env.APP_CONTROL_TOKEN), env)).status, 409);
});

test('disk storage survives a new instance and serializes concurrent updates', async () => {
  const temporaryRoot = path.resolve('.test-data');
  await fs.mkdir(temporaryRoot, { recursive: true });
  const directory = await fs.mkdtemp(path.join(temporaryRoot, 'solar-workspace-'));
  try {
    const store = createFileWorkspaceStore(directory);
    await Promise.all(Array.from({ length: 15 }, () => store.update('counter', current => ({ value: (current?.value || 0) + 1 }))));
    assert.equal((await createFileWorkspaceStore(directory).read('counter')).value, 15);
  } finally { assert.ok(directory.startsWith(temporaryRoot + path.sep)); await fs.rm(directory, { recursive: true, force: true }); }
});

test('R2 store retries conditional conflicts without overwriting concurrent changes', async () => {
  let object = null, revision = 0, conflict = true;
  const bucket = {
    async get() { return object ? { etag: String(revision), json: async () => structuredClone(object) } : null; },
    async put(key, text, options) {
      if (conflict) { conflict = false; object = { value: 8 }; revision++; return null; }
      assert.equal(options.onlyIf.etagMatches, String(revision));
      object = JSON.parse(text); revision++; return { etag: String(revision) };
    },
  };
  const store = createR2WorkspaceStore(bucket);
  assert.equal((await store.update('counter', current => ({ value: (current?.value || 0) + 1 }))).value, 9);
});

test('separate management and APP URLs connect through backend without browser storage', async () => {
  const server = createServer(env, { workspaceStore: memory() });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const send = (route, method, data, token) => fetch(base + '/api/workspace/' + route, { method, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(data) });
  try {
    assert.match(await (await fetch(base + '/manage/')).text(), /manager-login-form/);
    const app = await (await fetch(base + '/app/')).text(); assert.match(app, /app-bridge.js/); assert.doesNotMatch(app, /manager-login-form/);
    await send('lease', 'POST', { owner: 'browser-A' }, env.MANAGER_TOKEN);
    await send('state', 'PUT', { owner: 'browser-A', snapshot }, env.MANAGER_TOKEN);
    const otherDevice = await (await fetch(base + '/api/workspace/state')).json();
    assert.equal(otherDevice.snapshot.plants[0].id, 'P1');
    assert.ok((await fetch(base + '/data/workspace.json')).status >= 400);
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
