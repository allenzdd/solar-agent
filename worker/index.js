import { createApi } from '../server/api.mjs';
const handleApi = createApi();
import { createWorkspaceApi, createR2WorkspaceStore } from '../server/workspace.mjs';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/workspace/') && url.pathname!=='/api/workspace/chat') return createWorkspaceApi(env.BUCKET ? createR2WorkspaceStore(env.BUCKET) : null)(request, env);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, { clientIp: request.headers.get('CF-Connecting-IP') || 'unknown',workspaceStore:env.BUCKET?createR2WorkspaceStore(env.BUCKET):null });
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    let pathname;
    try { pathname = decodeURIComponent(url.pathname); } catch { return new Response('Bad request', { status: 400 }); }
    if (pathname === '/' || pathname === '/app' || pathname === '/app/') pathname = '/index.html';
    if (pathname === '/manage' || pathname === '/manage/') pathname = '/simulator.html';
    const asset = Object.hasOwn(ASSETS, pathname) ? ASSETS[pathname] : null;
    if (!asset) return new Response('Not found', { status: 404 });
    const headers = { 'Content-Type': asset.type, ETag: asset.etag, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' };
    const validators = (request.headers.get('If-None-Match') || '').split(',').map(value => value.trim().replace(/^W\//, ''));
    if (validators.includes('*') || validators.includes(asset.etag)) return new Response(null, { status: 304, headers });
    const body = request.method === 'HEAD' ? null : Uint8Array.from(atob(asset.body), char => char.charCodeAt(0));
    return new Response(body, { headers });
  },
};
