import fs from 'node:fs/promises';
import path from 'node:path';
import { gzip } from 'node:zlib';
import { promisify } from 'node:util';
const compress = promisify(gzip);

function acceptsGzip(request) {
  const choices = (request.headers.get('Accept-Encoding') || '').toLowerCase().split(',').map(value => value.trim());
  const choice = choices.find(value => /^gzip(?:\s*;|$)/.test(value)) ?? choices.find(value => /^\*(?:\s*;|$)/.test(value));
  return choice !== undefined && !/;\s*q\s*=\s*0(?:\.0*)?\s*$/.test(choice);
}
const mime = { '.txt': 'text/plain; charset=utf-8', '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2' };
export function createStaticHandler(directory) {
  const root = path.resolve(directory);
  const compressed = new Map();
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
      const type = mime[path.extname(real).toLowerCase()] || 'application/octet-stream';
      const etag = `W/"${stat.size}-${stat.mtimeMs}"`;
      const headers = { 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: etag, 'X-Content-Type-Options': 'nosniff' };
      const negotiable = stat.size >= 1024 && /^(text\/|application\/(javascript|json)|image\/svg)/.test(type);
      if (negotiable) headers.Vary = 'Accept-Encoding';
      const validators = (request.headers.get('If-None-Match') || '').split(',').map(value => value.trim().replace(/^W\//, ''));
      if (validators.includes('*') || validators.includes(etag.slice(2))) return new Response(null, { status: 304, headers });
      if (negotiable && acceptsGzip(request)) {
        let entry = compressed.get(real);
        if (entry?.etag !== etag) {
          const bytes = fs.readFile(real).then(data => compress(data));
          entry = { etag, bytes };
          compressed.set(real, entry);
          bytes.catch(() => { if (compressed.get(real) === entry) compressed.delete(real); });
        }
        const body = await entry.bytes;
        return new Response(request.method === 'HEAD' ? null : body, { headers: { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': String(body.length) } });
      }
      return new Response(request.method === 'HEAD' ? null : await fs.readFile(real), { headers: { ...headers, 'Content-Length': String(stat.size) } });
    } catch (cause) { if (cause.code === 'ENOENT' || cause.code === 'ENOTDIR') return new Response('Not found', { status: 404 }); throw cause; }
  };
}
