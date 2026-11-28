import { routeAPI, serveMedia } from './api.mjs';
import { fetchCodeforces, fetchLuogu } from './platforms.mjs';
import cfSeed from '../src/data/codeforces.json' with { type: 'json' };
import luoguSeed from '../src/data/luogu-live.json' with { type: 'json' };

const SEEDS = { cf: cfSeed, luogu: luoguSeed };
const memory = new Map();
const pending = new Map();

async function platformData(name, request, ctx) {
  const key = new Request(new URL('/__platform-cache-v3/' + name, request.url));
  let saved = memory.get(name);
  if (!saved && typeof caches !== 'undefined') {
    try {
      const cached = await caches.default.match(key);
      if (cached) saved = await cached.json();
    } catch {}
  }
  if (saved && Date.now() - Date.parse(saved.syncedAt) < 60000) return saved;
  if (pending.has(name)) return pending.get(name);
  const operation = (async () => {
    try {
      const fresh = await (name === 'cf' ? fetchCodeforces() : fetchLuogu());
      memory.set(name, fresh);
      if (typeof caches !== 'undefined') {
        const task = caches.default.put(
          key,
          new Response(JSON.stringify(fresh), {
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public,max-age=2592000' },
          })
        );
        if (ctx?.waitUntil) ctx.waitUntil(task);
        else await task;
      }
      return fresh;
    } catch {
      return { ...(saved ?? SEEDS[name]), syncState: 'delayed' };
    } finally {
      pending.delete(name);
    }
  })();
  pending.set(name, operation);
  return operation;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/platforms/cf' || url.pathname === '/api/platforms/luogu') {
        if (request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
        return Response.json(
          await platformData(url.pathname.endsWith('/cf') ? 'cf' : 'luogu', request, ctx),
          { headers: { 'Cache-Control': 'no-store' } }
        );
      }
      if (url.pathname.startsWith('/api/')) return await routeAPI(request, env);
      if (url.pathname.startsWith('/media/')) return await serveMedia(request, env);
      if (env.ASSETS) return await env.ASSETS.fetch(request);
      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error(
        JSON.stringify({
          message: 'Site request failed',
          method: request.method,
          path: url.pathname,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      return Response.json(
        { error: '服务暂时不可用，请稍后重试' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  },
};
