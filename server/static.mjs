import fs from 'node:fs/promises';
import path from 'node:path';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };
export function createStaticHandler(directory) {
  const root = path.resolve(directory);
  return async function serveStatic(request) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url).pathname); } catch { return new Response('Bad request', { status: 400 }); }
    if (pathname === '/' || pathname === '/app' || pathname === '/app/') pathname = '/index.html';
    if (pathname === '/manage' || pathname === '/manage/') pathname = '/simulator.html';
    if (pathname.includes('\\') || pathname.split('/').some(part => part.startsWith('.'))) return new Response('Forbidden', { status: 403 });
    const filename = path.resolve(root, '.' + pathname);
    if (!filename.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    try {
      const real = await fs.realpath(filename);
      if (!real.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
      const stat = await fs.stat(real);
      if (!stat.isFile()) return new Response('Not found', { status: 404 });
      return new Response(request.method === 'HEAD' ? null : await fs.readFile(real), { headers: {
        'Content-Type': mime[path.extname(real).toLowerCase()] || 'application/octet-stream', 'Content-Length': String(stat.size), 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff',
      } });
    } catch (cause) { if (cause.code === 'ENOENT' || cause.code === 'ENOTDIR') return new Response('Not found', { status: 404 }); throw cause; }
  };
}
