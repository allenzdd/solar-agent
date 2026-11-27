import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { createStaticHandler } from '../server/static.mjs';
import { fileURLToPath } from 'node:url';

const root = new URL('../wechat/', import.meta.url);
const read = path => readFile(new URL(path, root), 'utf8');
const project = JSON.parse(await read('project.config.json'));
const app = JSON.parse(await read(project.miniprogramRoot + 'app.json'));
const page = project.miniprogramRoot + app.pages[0];
const script = await read(page + '.js');

function launch(serviceOrigin, platform, envVersion) {
  let controller;
  vm.runInNewContext(script, {
    require: () => ({ serviceOrigin, deviceDebugOrigin: 'http://fssolarhw.online' }),
    wx: {
      getSystemInfoSync: () => ({ platform }),
      getAccountInfoSync: () => ({ miniProgram: { envVersion } }),
    },
    Page(options) {
      controller = { ...options, setData(values) { Object.assign(this.data, values); } };
    },
  });
  controller.onLoad();
  return controller;
}

test('小程序从固定用户端入口加载，网络错误后可重新连接', async () => {
  const controller = launch('https://solar.example.com/', 'ios', 'release');
  const url = controller.data.src;
  assert.equal(url, 'https://solar.example.com/wechat/index.html');
  const serve = createStaticHandler(fileURLToPath(new URL('../public', import.meta.url)));
  const response = await serve(new Request(url));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /id="page-home"/);
  assert.match(await read(page + '.wxml'), /binderror="onLoadError"/);
  controller.onLoadError({ detail: { errMsg: 'load failed' } });
  assert.ok(controller.data.detail.includes('load failed'));
  assert.equal(controller.data.src, '');
  assert.equal(controller.data.retryable, true);
  controller.openMonitor();
  assert.equal(controller.data.src, url);
});

test('开发版模拟器和手机使用同一 ECS 地址，发布配置不接受管理路径或 HTTP', () => {
  assert.equal(launch('', 'devtools', 'develop').data.src, 'http://fssolarhw.online/wechat/index.html');
  assert.equal(launch('', 'ios', 'develop').data.src, 'http://fssolarhw.online/wechat/index.html');
  for (const args of [
    ['', 'ios', 'trial'], ['', 'ios', 'release'], ['', 'devtools', 'release'],
    ['http://solar.example.com', 'android', 'release'],
    ['https://solar.example.com/manage/', 'ios', 'release'],
  ]) assert.equal(launch(...args).data.src, '');
});
