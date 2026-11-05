import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createApi } from './server/api.mjs';
import { createStaticHandler } from './server/static.mjs';
import { createWorkspaceApi } from './server/workspace.mjs';
import { createFileWorkspaceStore } from './server/file-store.mjs';
import { ensureWorkspaceSecrets } from './scripts/workspace-secrets.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const envFile = path.join(root, '.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
ensureWorkspaceSecrets(root);

export function createServer(env = process.env, { fetchImpl, workspaceStore } = {}) {
  const handleApi = createApi({ fetchImpl });
  const sharedStore=workspaceStore || createFileWorkspaceStore(env.DATA_DIR || path.join(root,'data'));
  const handleWorkspace=createWorkspaceApi(sharedStore);
  const serveStatic = createStaticHandler(path.join(root, 'public'));
  return http.createServer(async (req, res) => {
    const controller = new AbortController();
    res.on('close', () => { if (!res.writableEnded) controller.abort(); });
    try {
      const localOrigin = 'http://' + (req.headers.host || 'localhost');
      const url = new URL(req.url, localOrigin);
      const request = new Request(url, {
        method: req.method, headers: req.headers, signal: controller.signal,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}),
      });
      const response = url.pathname.startsWith('/api/workspace/') && url.pathname!=='/api/workspace/chat' ? await handleWorkspace(request, env)
        : url.pathname.startsWith('/api/') ? await handleApi(request, env, { clientIp: req.socket.remoteAddress, workspaceStore:sharedStore }) : await serveStatic(request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) await pipeline(Readable.fromWeb(response.body), res);
      else res.end();
    } catch {
      if (controller.signal.aborted) return;
      if (res.headersSent) { res.destroy(); return; }
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ error: { code: 'internal_error', message: '服务异常，请稍后重试' } }));
    }
  });
}

if (process.argv[1] && fs.realpathSync(path.resolve(process.argv[1])) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8788);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 必须为 1–65535 的整数');
  const server = createServer();
  server.on('error', cause => {
    console.error(cause.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，请修改 .env 中的 PORT。` : '服务启动失败：' + cause.message);
    process.exitCode = 1;
  });
  server.listen(port, process.env.HOST || '0.0.0.0', () => {
    console.log(`[solar-monitor] http://localhost:${port}`);
    console.log(`[solar-monitor] APP: http://localhost:${port}/app/`);
    console.log(`[solar-monitor] Manager: http://localhost:${port}/manage/ (MANAGER_TOKEN in .env)`);
    console.log(`[solar-monitor] Model: ${process.env.DEEPSEEK_MODEL || 'deepseek-flash'}; key: ${process.env.DEEPSEEK_API_KEY ? 'configured' : 'not configured'}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => { server.closeAllConnections(); process.exit(0); }, 5000).unref();
  });
}
