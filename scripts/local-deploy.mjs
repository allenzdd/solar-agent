import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function fail(message) { console.error(message); process.exit(1); }
if (typeof process.loadEnvFile !== 'function') fail('需要 Node.js 20.12 或更新版本。');
const config = path.join(root, '.env');
if (!fs.existsSync(config)) {
  fs.copyFileSync(path.join(root, '.env.example'), config);
  fail('已创建 .env，请填写 DEEPSEEK_API_KEY 后重新启动。');
}
try { process.loadEnvFile(config); } catch { fail('无法读取 .env，请检查文件格式和访问权限。'); }
if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY === 'your_deepseek_api_key') fail('请在 .env 中填写 DEEPSEEK_API_KEY。');
const port = Number(process.env.PORT || 8788);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail('.env 中的 PORT 必须为 1–65535 的整数。');
for (const file of ['public/index.html', 'public/simulator.html', 'server.mjs']) {
  if (!fs.existsSync(path.join(root, file))) fail('缺少项目文件：' + file);
}
console.log('本地部署：无需安装依赖，也无需构建。');
console.log('模型：' + (process.env.DEEPSEEK_MODEL || 'deepseek-flash'));
console.log('APP 使用端：http://localhost:' + port + '/app/');
console.log('仿真管理端：http://localhost:' + port + '/manage/');
console.log('管理口令与 APP 控制口令保存在 .env；首次启动会自动生成。');
console.log('保持本窗口打开；按 Ctrl+C 停止服务。');
const child = spawn(process.execPath, [path.join(root, 'server.mjs')], { cwd: root, env: process.env, stdio: 'inherit', windowsHide: true });
child.on('error', () => fail('无法启动 Node.js 服务。'));
child.on('exit', code => { process.exitCode = code ?? 1; });
process.on('SIGINT', () => { child.kill('SIGINT'); });
process.on('SIGTERM', () => { child.kill('SIGTERM'); });
