import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { routeAPI, serveMedia } from '../worker/api.mjs';
import { clearAuthCaches, createSessionToken } from '../worker/auth.mjs';
import { createLocalDB } from '../scripts/local-bindings.mjs';
import { renderMarkdown } from '../docs/.vitepress/theme/components/cms-client.js';

const migration = fs
  .readdirSync('drizzle')
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => fs.readFileSync('drizzle/' + f, 'utf8'))
  .join('\n');

const ADMIN_PASSWORD = 'test-strong-password-2026';

async function fixture(options = {}) {
  clearAuthCaches();
  const DB = createLocalDB();
  DB.exec(migration);
  const objects = new Map();
  const env = {
    DB,
    ADMIN_PASSWORD,
    SESSION_SECRET: 'test-session-secret-0123456789',
    SITE_ADMIN_EMAIL: 'owner@site.test',
    ...(options.withBucket === false
      ? {}
      : {
          BUCKET: {
            async put(k, b, o) {
              objects.set(k, { body: new Blob([b]).stream(), bytes: b, options: o });
            },
            async get(k) {
              const v = objects.get(k);
              return v ? { body: new Blob([v.bytes]).stream() } : null;
            },
            async delete(k) {
              objects.delete(k);
            },
          },
        }),
    ...(options.env || {}),
  };
  const sessionToken = await createSessionToken(env);
  env._sessionCookie = `blog_admin_session=${sessionToken}`;
  return env;
}

function req(path, method = 'GET', body, auth = true, origin = 'https://site.test', env = null) {
  const headers = new Headers();
  if (auth && typeof auth === 'string') {
    headers.set('cookie', auth);
  } else if (auth && env?._sessionCookie) {
    headers.set('cookie', env._sessionCookie);
  }
  if (method !== 'GET') {
    headers.set('origin', origin);
    headers.set('content-type', 'application/json');
  }
  return new Request('https://site.test' + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function b64url(input) {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function createAccessFixture() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify']
  );
  const publicJwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'test-kid-1', alg: 'RS256', use: 'sig' };
  const signJwt = async (payload, kid = 'test-kid-1') => {
    const header = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
    const body = b64url(JSON.stringify(payload));
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${header}.${body}`));
    return `${header}.${body}.${b64url(sig)}`;
  };
  const jwksFetcher = async () => Response.json({ keys: [publicJwk] });
  return { signJwt, jwksFetcher };
}

const draft = {
  title: '测试题解',
  content: '## 解题思路\n\n测试正文。',
  category: 'solution',
  status: 'draft',
  tags: ['图论'],
  excerpt: '',
  cover: '',
};

test('password login issues signed HttpOnly cookie, enforces rate limit and supports logout', async () => {
  const env = await fixture({ withBucket: false });
  try {
    const statusBefore = await (await routeAPI(req('/api/auth/status', 'GET', undefined, false), env)).json();
    assert.equal(statusBefore.authenticated, false);
    assert.deepEqual(statusBefore.methods, { password: true, access: false });
    assert.equal(statusBefore.uploadsEnabled, false);

    assert.equal((await routeAPI(req('/api/auth/login', 'POST', { password: ADMIN_PASSWORD }, false, 'https://evil.test'), env)).status, 403);
    assert.equal((await routeAPI(req('/api/auth/login', 'POST', { password: '' }, false), env)).status, 400);
    assert.equal((await routeAPI(req('/api/auth/login', 'POST', { password: 'wrong' }, false), env)).status, 401);

    const loginRes = await routeAPI(req('/api/auth/login', 'POST', { password: ADMIN_PASSWORD }, false), env);
    assert.equal(loginRes.status, 200);
    const setCookie = loginRes.headers.get('set-cookie') || '';
    assert.ok(setCookie.includes('blog_admin_session='));
    assert.ok(setCookie.includes('HttpOnly'));
    assert.ok(setCookie.includes('Secure'));
    assert.ok(setCookie.includes('SameSite=Lax'));

    const cookiePair = setCookie.split(';')[0];
    const statusAfter = await (await routeAPI(req('/api/auth/status', 'GET', undefined, cookiePair), env)).json();
    assert.equal(statusAfter.authenticated, true);
    assert.equal(statusAfter.authMode, 'password');

    const session = await (await routeAPI(req('/api/admin/session', 'GET', undefined, cookiePair), env)).json();
    assert.equal(session.authenticated, true);
    assert.equal(session.authMode, 'password');

    // Tampered cookie is rejected
    assert.equal((await routeAPI(req('/api/admin/posts', 'GET', undefined, cookiePair + 'x'), env)).status, 403);

    // Logout clears cookie
    const logoutRes = await routeAPI(req('/api/auth/logout', 'POST', {}, cookiePair), env);
    assert.equal(logoutRes.status, 200);
    assert.ok((logoutRes.headers.get('set-cookie') || '').includes('Max-Age=0'));

    // Brute-force lockout after 10 failures
    for (let i = 0; i < 10; i++) {
      const r = await routeAPI(req('/api/auth/login', 'POST', { password: 'bad-' + i }, false), env);
      assert.equal(r.status, 401);
    }
    assert.equal((await routeAPI(req('/api/auth/login', 'POST', { password: ADMIN_PASSWORD }, false), env)).status, 429);
  } finally {
    env.DB.close();
  }
});

test('PBKDF2 hashed password works without storing plaintext password', async () => {
  const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode('my-pbkdf2-secret'), 'PBKDF2', false, ['deriveBits']);
  const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, key, 256));
  const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  const env = await fixture({
    withBucket: false,
    env: { ADMIN_PASSWORD: '', ADMIN_PASSWORD_HASH: `pbkdf2$100000$${hex(salt)}$${hex(derived)}` },
  });
  try {
    assert.equal((await routeAPI(req('/api/auth/login', 'POST', { password: 'wrong' }, false), env)).status, 401);
    assert.equal((await routeAPI(req('/api/auth/login', 'POST', { password: 'my-pbkdf2-secret' }, false), env)).status, 200);
  } finally {
    env.DB.close();
  }
});

test('Cloudflare Access JWT verifies RS256 signature, audience, email and rejects spoofed headers', async () => {
  const { signJwt, jwksFetcher } = await createAccessFixture();
  const teamDomain = 'https://naiyael.cloudflareaccess.com';
  const aud = 'aud-tag-123456';
  const env = await fixture({
    withBucket: false,
    env: {
      ADMIN_PASSWORD: '',
      CF_ACCESS_TEAM_DOMAIN: teamDomain,
      CF_ACCESS_AUD: aud,
      SITE_ADMIN_EMAIL: 'owner@site.test',
    },
  });
  try {
    const now = Math.floor(Date.now() / 1000);
    const validJwt = await signJwt({ iss: teamDomain, aud: [aud], email: 'owner@site.test', sub: 'cf-sub-1', exp: now + 600 });

    // Spoofed unsigned headers must always fail
    const spoofed = req('/api/admin/posts', 'GET', undefined, false);
    spoofed.headers.set('oai-authenticated-user-email', 'owner@site.test');
    spoofed.headers.set('cf-access-authenticated-user-email', 'owner@site.test');
    assert.equal((await routeAPI(spoofed, env, { jwksFetcher })).status, 403);

    // Valid Access JWT header passes
    const validReq = req('/api/admin/session', 'GET', undefined, false);
    validReq.headers.set('cf-access-jwt-assertion', validJwt);
    const sessionRes = await routeAPI(validReq, env, { jwksFetcher });
    assert.equal(sessionRes.status, 200);
    const sessionBody = await sessionRes.json();
    assert.equal(sessionBody.authMode, 'access');
    assert.equal(sessionBody.email, 'owner@site.test');

    // Valid CF_Authorization cookie also passes
    const cookieReq = req('/api/admin/posts', 'GET', undefined, `CF_Authorization=${validJwt}`);
    assert.equal((await routeAPI(cookieReq, env, { jwksFetcher })).status, 200);

    // Wrong email, wrong aud, expired token, or tampered signature all fail
    const wrongEmail = await signJwt({ iss: teamDomain, aud: [aud], email: 'other@site.test', exp: now + 600 });
    const wrongAud = await signJwt({ iss: teamDomain, aud: ['other-aud'], email: 'owner@site.test', exp: now + 600 });
    const expired = await signJwt({ iss: teamDomain, aud: [aud], email: 'owner@site.test', exp: now - 300 });
    for (const badJwt of [wrongEmail, wrongAud, expired, validJwt.slice(0, -4) + 'AAAA']) {
      const badReq = req('/api/admin/posts', 'GET', undefined, false);
      badReq.headers.set('cf-access-jwt-assertion', badJwt);
      assert.equal((await routeAPI(badReq, env, { jwksFetcher })).status, 403);
    }
  } finally {
    env.DB.close();
  }
});

test('external https and local /images cover URLs are validated safely when R2 is disabled', async () => {
  const env = await fixture({ withBucket: false });
  try {
    const health = await (await routeAPI(req('/api/health', 'GET', undefined, false), env)).json();
    assert.equal(health.uploads, false);
    assert.equal(health.database, true);

    const httpsPost = await routeAPI(
      req('/api/admin/posts', 'POST', { ...draft, status: 'published', cover: 'https://img.example.com/blog/cover.webp' }, true, 'https://site.test', env),
      env
    );
    assert.equal(httpsPost.status, 201);
    assert.equal((await httpsPost.json()).post.cover, 'https://img.example.com/blog/cover.webp');

    const localPost = await routeAPI(
      req('/api/admin/posts', 'POST', { ...draft, status: 'published', cover: '/images/mountain-lake.jpg' }, true, 'https://site.test', env),
      env
    );
    assert.equal(localPost.status, 201);

    for (const badCover of [
      'http://insecure.example.com/a.jpg',
      'javascript:alert(1)',
      'data:image/png;base64,abc',
      '//evil.test/a.jpg',
      '/images/../secret.txt',
      'https://user:pass@example.com/a.jpg',
    ]) {
      const res = await routeAPI(req('/api/admin/posts', 'POST', { ...draft, cover: badCover }, true, 'https://site.test', env), env);
      assert.equal(res.status, 400);
    }

    // Upload endpoint gracefully reports 503 when BUCKET is not configured
    const uploadRes = await routeAPI(
      new Request('https://site.test/api/admin/uploads', {
        method: 'POST',
        headers: { origin: 'https://site.test', cookie: env._sessionCookie, 'content-type': 'image/jpeg' },
        body: fs.readFileSync('docs/public/images/avatar.jpg'),
      }),
      env
    );
    assert.equal(uploadRes.status, 503);
  } finally {
    env.DB.close();
  }
});

test('editor saves pin with content, preserves other pins and custom order, and never exposes pinned drafts', async () => {
  const env = await fixture();
  try {
    const initial = await (await routeAPI(req('/api/admin/post-order', 'GET', undefined, true, 'https://site.test', env), env)).json();
    const peer = initial.posts[0].id;
    const orderedIds = initial.posts.map((p) => p.id).reverse();
    await routeAPI(req('/api/admin/post-order', 'PUT', { version: 0, orderedIds, pinnedIds: [peer] }, true, 'https://site.test', env), env);
    const created = await routeAPI(req('/api/admin/posts', 'POST', { ...draft, pinned: true }, true, 'https://site.test', env), env);
    assert.equal(created.status, 201);
    let post = (await created.json()).post;
    assert.equal(post.pinned, true);
    assert.equal((await (await routeAPI(req('/api/admin/posts/' + post.id, 'GET', undefined, true, 'https://site.test', env), env)).json()).post.pinned, true);
    assert.ok(!(await (await routeAPI(req('/api/posts', 'GET', undefined, false), env)).json()).posts.some((p) => p.id === post.id));
    post = (await (await routeAPI(req('/api/admin/posts/' + post.id, 'PUT', { ...post, status: 'published' }, true, 'https://site.test', env), env)).json()).post;
    assert.ok((await (await routeAPI(req('/api/posts', 'GET', undefined, false), env)).json()).posts.find((p) => p.id === post.id).pinned);
    let layout = await (await routeAPI(req('/api/admin/post-order', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.deepEqual(layout.orderedIds, orderedIds);
    assert.ok(layout.pinnedIds.includes(peer) && layout.pinnedIds.includes(post.id));
    const sameVersion = layout.version;
    post = (await (await routeAPI(req('/api/admin/posts/' + post.id, 'PUT', { ...post, title: '只改标题' }, true, 'https://site.test', env), env)).json()).post;
    assert.equal((await (await routeAPI(req('/api/admin/post-order', 'GET', undefined, true, 'https://site.test', env), env)).json()).version, sameVersion);
    const { pinned, ...legacy } = post;
    post = (await (await routeAPI(req('/api/admin/posts/' + post.id, 'PUT', { ...legacy, title: '旧客户端修改' }, true, 'https://site.test', env), env)).json()).post;
    assert.equal(post.pinned, true);
    post = (await (await routeAPI(req('/api/admin/posts/' + post.id, 'PUT', { ...post, pinned: false }, true, 'https://site.test', env), env)).json()).post;
    assert.equal(post.pinned, false);
    layout = await (await routeAPI(req('/api/admin/post-order', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.deepEqual(layout.pinnedIds, [peer]);
    assert.deepEqual(layout.orderedIds, orderedIds);
    assert.equal((await routeAPI(req('/api/admin/posts', 'POST', { ...draft, pinned: 'yes' }, true, 'https://site.test', env), env)).status, 400);
  } finally {
    env.DB.close();
  }
});

test('stale editor cannot change pin or overwrite ordering', async () => {
  const env = await fixture();
  try {
    const original = (await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, pinned: false }, true, 'https://site.test', env), env)).json()).post;
    const current = (await (await routeAPI(req('/api/admin/posts/' + original.id, 'PUT', { ...original, title: '较新版本' }, true, 'https://site.test', env), env)).json()).post;
    const before = await (await routeAPI(req('/api/admin/post-order', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.equal((await routeAPI(req('/api/admin/posts/' + original.id, 'PUT', { ...original, pinned: true }, true, 'https://site.test', env), env)).status, 409);
    const after = await (await routeAPI(req('/api/admin/post-order', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.deepEqual(after, before);
    assert.equal((await (await routeAPI(req('/api/admin/posts/' + original.id, 'GET', undefined, true, 'https://site.test', env), env)).json()).post.version, current.version);
  } finally {
    env.DB.close();
  }
});

test('article and pin changes roll back together when a content write fails', async () => {
  const env = await fixture();
  try {
    const post = (await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, pinned: false }, true, 'https://site.test', env), env)).json()).post;
    env.DB.exec("CREATE TRIGGER test_block_update BEFORE UPDATE ON posts BEGIN SELECT RAISE(ABORT,'test write failure'); END;");
    await assert.rejects(routeAPI(req('/api/admin/posts/' + post.id, 'PUT', { ...post, pinned: true, title: '不应保存' }, true, 'https://site.test', env), env), /test write failure/);
    const after = (await (await routeAPI(req('/api/admin/posts/' + post.id, 'GET', undefined, true, 'https://site.test', env), env)).json()).post;
    assert.equal(after.pinned, false);
    assert.equal(after.title, post.title);
    assert.equal(after.version, post.version);
    assert.equal((await (await routeAPI(req('/api/admin/post-order', 'GET', undefined, true, 'https://site.test', env), env)).json()).version, 0);
  } finally {
    env.DB.close();
  }
});

test('post order persists independently, pins precede custom rank across pages and filters, private pins stay private', async () => {
  const env = await fixture();
  try {
    const created = [];
    for (let i = 0; i < 14; i++) {
      created.push((await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, title: '排序测试 ' + i, status: 'published' }, true, 'https://site.test', env), env)).json()).post);
    }
    const secret = (await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, title: '私密置顶草稿' }, true, 'https://site.test', env), env)).json()).post;
    const all = await (await routeAPI(req('/api/admin/post-order', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.equal(all.version, 0);
    const orderedIds = [...created].reverse().map((p) => p.id);
    const pinnedIds = [created[0].id, secret.id];
    const response = await routeAPI(req('/api/admin/post-order', 'PUT', { version: 0, orderedIds, pinnedIds }, true, 'https://site.test', env), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).version, 1);
    const first = await (await routeAPI(req('/api/posts', 'GET', undefined, false), env)).json();
    assert.equal(first.posts[0].id, created[0].id);
    assert.equal(first.posts[0].pinned, true);
    assert.equal(first.posts[1].id, created[13].id);
    assert.equal(first.posts.length, 12);
    assert.ok(!JSON.stringify(first).includes(secret.id));
    const second = await (await routeAPI(req('/api/posts?page=2', 'GET', undefined, false), env)).json();
    assert.equal(new Set([...first.posts, ...second.posts].map((p) => p.id)).size, 17);
    const filtered = await (await routeAPI(req('/api/posts?category=solution&tag=' + encodeURIComponent('图论'), 'GET', undefined, false), env)).json();
    assert.equal(filtered.posts[0].id, created[0].id);
    assert.equal(filtered.posts[1].id, created[13].id);
    const after = (await (await routeAPI(req('/api/admin/posts/' + created[0].id, 'GET', undefined, true, 'https://site.test', env), env)).json()).post;
    assert.equal(after.publishedAt, created[0].publishedAt);
    assert.equal(after.updatedAt, created[0].updatedAt);
    assert.equal(after.version, created[0].version);
    const backup = await (await routeAPI(req('/api/admin/export', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.deepEqual(backup.postOrder.pinnedIds, pinnedIds);
    assert.equal((await routeAPI(req('/api/admin/post-order', 'PUT', { version: 1, orderedIds: [], pinnedIds: [] }, true, 'https://site.test', env), env)).status, 200);
    const reset = await (await routeAPI(req('/api/posts', 'GET', undefined, false), env)).json();
    assert.ok(reset.posts.every((p) => !p.pinned));
  } finally {
    env.DB.close();
  }
});

test('post ordering requires owner and same origin, validates IDs and protects concurrent changes', async () => {
  const env = await fixture();
  try {
    const data = await (await routeAPI(req('/api/admin/post-order', 'GET', undefined, true, 'https://site.test', env), env)).json();
    const body = { version: 0, orderedIds: data.posts.map((p) => p.id), pinnedIds: [data.posts[0].id] };
    assert.equal((await routeAPI(req('/api/admin/post-order', 'GET', undefined, false), env)).status, 403);
    assert.equal((await routeAPI(req('/api/admin/post-order', 'PUT', body, false), env)).status, 403);
    assert.equal((await routeAPI(req('/api/admin/post-order', 'PUT', body, true, 'https://evil.test', env), env)).status, 403);
    assert.equal((await routeAPI(req('/api/admin/post-order', 'PUT', { ...body, orderedIds: [body.orderedIds[0], body.orderedIds[0]] }, true, 'https://site.test', env), env)).status, 400);
    assert.equal((await routeAPI(req('/api/admin/post-order', 'PUT', { ...body, pinnedIds: ['not-an-id'] }, true, 'https://site.test', env), env)).status, 400);
    assert.equal((await routeAPI(req('/api/admin/post-order', 'PUT', { ...body, pinnedIds: ['00000000-0000-4000-8000-000000000000'] }, true, 'https://site.test', env), env)).status, 409);
    assert.equal((await routeAPI(req('/api/admin/post-order', 'PUT', body, true, 'https://site.test', env), env)).status, 200);
    assert.equal((await routeAPI(req('/api/admin/post-order', 'PUT', { ...body, pinnedIds: [] }, true, 'https://site.test', env), env)).status, 409);
    assert.deepEqual((await (await routeAPI(req('/api/admin/post-order', 'GET', undefined, true, 'https://site.test', env), env)).json()).pinnedIds, body.pinnedIds);
  } finally {
    env.DB.close();
  }
});

test('draft privacy, publication, conflict detection and reversible archive', async () => {
  const env = await fixture();
  try {
    const created = await routeAPI(req('/api/admin/posts', 'POST', draft, true, 'https://site.test', env), env);
    assert.equal(created.status, 201);
    const p = (await created.json()).post;
    assert.equal((await (await routeAPI(req('/api/posts', 'GET', undefined, false), env)).json()).total, 3);
    assert.equal((await routeAPI(req('/api/posts/' + p.id, 'GET', undefined, false), env)).status, 404);
    const published = await routeAPI(req('/api/admin/posts/' + p.id, 'PUT', { ...p, status: 'published' }, true, 'https://site.test', env), env);
    assert.equal(published.status, 200);
    const live = (await published.json()).post;
    assert.equal(live.version, 2);
    assert.equal((await (await routeAPI(req('/api/posts/' + p.id, 'GET', undefined, false), env)).json()).post.content, draft.content);
    assert.equal((await routeAPI(req('/api/admin/posts/' + p.id, 'PUT', { ...p, title: 'stale update', status: 'published' }, true, 'https://site.test', env), env)).status, 409);
    const archived = await routeAPI(req('/api/admin/posts/' + p.id, 'PUT', { ...live, status: 'archived' }, true, 'https://site.test', env), env);
    assert.equal(archived.status, 200);
    assert.equal((await routeAPI(req('/api/posts/' + p.id, 'GET', undefined, false), env)).status, 404);
    assert.equal((await (await routeAPI(req('/api/admin/posts/' + p.id, 'GET', undefined, true, 'https://site.test', env), env)).json()).post.content, draft.content);
  } finally {
    env.DB.close();
  }
});

test('admin authorization and cross-origin write rejection', async () => {
  const env = await fixture();
  try {
    assert.equal((await routeAPI(req('/api/admin/posts', 'GET', undefined, false), env)).status, 403);
    assert.equal((await routeAPI(req('/api/admin/posts', 'POST', draft, true, 'https://other.test', env), env)).status, 403);
    assert.equal((await routeAPI(req('/api/admin/posts', 'POST', { ...draft, title: '' }, true, 'https://site.test', env), env)).status, 400);
  } finally {
    env.DB.close();
  }
});

test('image uploads are typed and draft-only media stays private when R2 is bound', async () => {
  const env = await fixture({ withBucket: true });
  try {
    const bytes = fs.readFileSync('docs/public/images/avatar.jpg');
    const headers = { origin: 'https://site.test', 'content-type': 'image/jpeg', cookie: env._sessionCookie };
    const response = await routeAPI(new Request('https://site.test/api/admin/uploads', { method: 'POST', headers, body: bytes }), env);
    assert.equal(response.status, 201);
    const image = (await response.json()).url;
    assert.equal((await serveMedia(req(image, 'GET', undefined, false), env)).status, 404);
    const p = (await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, status: 'published', cover: image }, true, 'https://site.test', env), env)).json()).post;
    assert.ok(p.id);
    const served = await serveMedia(req(image, 'GET', undefined, false), env);
    assert.equal(served.status, 200);
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), bytes);
    const invalid = await routeAPI(
      new Request('https://site.test/api/admin/uploads', { method: 'POST', headers: { ...headers, 'content-type': 'image/svg+xml' }, body: '<svg onload="alert(1)" />' }),
      env
    );
    assert.equal(invalid.status, 400);
  } finally {
    env.DB.close();
  }
});

test('Markdown preview escapes HTML and rejects script links', () => {
  const html = renderMarkdown('<script>alert(1)</script>\n\n[x](javascript:alert(1))');
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('href="javascript:'));
  assert.ok(renderMarkdown('## 标题\n\n**内容**').includes('<h2>标题</h2>'));
});

test('saved content survives reopening the database', async () => {
  fs.mkdirSync('.local-state/tests', { recursive: true });
  const file = '.local-state/tests/' + crypto.randomUUID() + '.sqlite';
  const env = await fixture();
  env.DB.close();
  env.DB = createLocalDB(file);
  env.DB.exec(migration);
  const p = (await (await routeAPI(req('/api/admin/posts', 'POST', draft, true, 'https://site.test', env), env)).json()).post;
  env.DB.close();
  env.DB = createLocalDB(file);
  assert.equal((await (await routeAPI(req('/api/admin/posts/' + p.id, 'GET', undefined, true, 'https://site.test', env), env)).json()).post.title, draft.title);
  env.DB.close();
});

test('existing pages can be edited, trashed, restored and permanently removed without resurrection', async () => {
  const env = await fixture();
  try {
    const list = (await (await routeAPI(req('/api/admin/posts', 'GET', undefined, true, 'https://site.test', env), env)).json()).posts;
    assert.equal(list.length, 3);
    const id = list.find((p) => p.pageKey === 'about').id;
    const original = (await (await routeAPI(req('/api/admin/posts/' + id, 'GET', undefined, true, 'https://site.test', env), env)).json()).post;
    assert.ok(original.content.includes('Naiyael'));
    const edited = await routeAPI(req('/api/admin/posts/' + id, 'PUT', { ...original, title: '新的介绍', content: '## 最近在做什么\n\n学习算法。' }, true, 'https://site.test', env), env);
    assert.equal(edited.status, 200);
    const p = (await edited.json()).post;
    assert.equal((await (await routeAPI(req('/api/pages/about', 'GET', undefined, false), env)).json()).post.title, '新的介绍');
    assert.equal((await routeAPI(req('/api/admin/posts/' + id, 'DELETE', { version: p.version, confirmTitle: p.title }, true, 'https://site.test', env), env)).status, 409);
    const trash = (await (await routeAPI(req('/api/admin/posts/' + id, 'PATCH', { action: 'trash', version: p.version }, true, 'https://site.test', env), env)).json()).post;
    assert.equal(trash.previousStatus, 'published');
    assert.equal(trash.status, 'trash');
    assert.ok(trash.trashedAt);
    assert.equal((await routeAPI(req('/api/pages/about', 'GET', undefined, false), env)).status, 404);
    assert.equal((await routeAPI(req('/api/admin/posts/' + id, 'PUT', { ...p, version: trash.version }, true, 'https://site.test', env), env)).status, 409);
    assert.equal((await routeAPI(req('/api/admin/posts/' + id, 'PATCH', { action: 'restore', version: p.version }, true, 'https://site.test', env), env)).status, 409);
    const restored = (await (await routeAPI(req('/api/admin/posts/' + id, 'PATCH', { action: 'restore', version: trash.version }, true, 'https://site.test', env), env)).json()).post;
    assert.equal(restored.status, 'published');
    assert.equal(restored.trashedAt, null);
    assert.equal((await routeAPI(req('/api/pages/about', 'GET', undefined, false), env)).status, 200);
    const t = (await (await routeAPI(req('/api/admin/posts/' + id, 'PATCH', { action: 'trash', version: restored.version }, true, 'https://site.test', env), env)).json()).post;
    assert.equal((await routeAPI(req('/api/admin/posts/' + id, 'DELETE', { version: t.version, confirmTitle: 'wrong' }, true, 'https://site.test', env), env)).status, 400);
    assert.equal((await routeAPI(req('/api/admin/posts/' + id, 'DELETE', { version: t.version, confirmTitle: t.title }, true, 'https://site.test', env), env)).status, 200);
    assert.equal((await routeAPI(req('/api/admin/posts/' + id, 'GET', undefined, true, 'https://site.test', env), env)).status, 404);
    assert.equal((await routeAPI(req('/api/admin/posts/' + id, 'PUT', { ...original, version: t.version + 1 }, true, 'https://site.test', env), env)).status, 404);
    assert.equal((await routeAPI(req('/api/pages/about', 'GET', undefined, false), env)).status, 404);
    assert.equal((await (await routeAPI(req('/api/posts', 'GET', undefined, false), env)).json()).total, 2);
    const exported = await (await routeAPI(req('/api/admin/export', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.ok(!exported.posts.some((p) => p.id === id));
  } finally {
    env.DB.close();
  }
});

test('ordinary post deletion, search, filters, counts and private content backup', async () => {
  const env = await fixture();
  try {
    const p = (await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, title: '100%_ 图论日记', category: 'daily' }, true, 'https://site.test', env), env)).json()).post;
    const search = await (await routeAPI(req('/api/admin/posts?q=' + encodeURIComponent('%_') + '&category=daily', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.equal(search.total, 1);
    assert.equal(search.posts[0].id, p.id);
    assert.equal(search.counts.draft, 1);
    assert.equal(search.counts.published, 3);
    assert.equal((await (await routeAPI(req('/api/admin/posts?q=' + encodeURIComponent("' OR 1=1 --"), 'GET', undefined, true, 'https://site.test', env), env)).json()).total, 0);
    assert.equal((await (await routeAPI(req('/api/posts?q=' + encodeURIComponent('图论日记'), 'GET', undefined, false), env)).json()).total, 0);
    // Body-content search finds published posts by body keywords while keeping drafts private.
    const pub = (await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, title: '最小生成树笔记', content: '使用 Kruskal 和并查集求解 MST。', excerpt: '图论专题', status: 'published' }, true, 'https://site.test', env), env)).json()).post;
    const bodyMatch = await (await routeAPI(req('/api/posts?q=' + encodeURIComponent('Kruskal'), 'GET', undefined, false), env)).json();
    assert.equal(bodyMatch.total, 1);
    assert.equal(bodyMatch.posts[0].id, pub.id);
    assert.equal((await (await routeAPI(req('/api/posts?q=' + encodeURIComponent('测试正文'), 'GET', undefined, false), env)).json()).total, 0);
    const backup = await (await routeAPI(req('/api/admin/export', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.equal(backup.posts.find((x) => x.id === p.id).content, draft.content);
    assert.equal((await routeAPI(req('/api/admin/export', 'GET', undefined, false), env)).status, 403);
    assert.equal((await routeAPI(req('/api/admin/posts/' + p.id, 'PATCH', { action: 'trash', version: p.version }, true, 'https://other.test', env), env)).status, 403);
    const t = (await (await routeAPI(req('/api/admin/posts/' + p.id, 'PATCH', { action: 'trash', version: p.version }, true, 'https://site.test', env), env)).json()).post;
    assert.equal((await (await routeAPI(req('/api/admin/posts', 'GET', undefined, true, 'https://site.test', env), env)).json()).total, 4);
    assert.equal((await (await routeAPI(req('/api/admin/posts?status=trash', 'GET', undefined, true, 'https://site.test', env), env)).json()).total, 1);
    const restored = (await (await routeAPI(req('/api/admin/posts/' + p.id, 'PATCH', { action: 'restore', version: t.version }, true, 'https://site.test', env), env)).json()).post;
    assert.equal(restored.status, 'draft');
    const t2 = (await (await routeAPI(req('/api/admin/posts/' + p.id, 'PATCH', { action: 'trash', version: restored.version }, true, 'https://site.test', env), env)).json()).post;
    assert.equal((await routeAPI(req('/api/admin/posts/' + p.id, 'DELETE', { version: t2.version, confirmTitle: p.title }, true, 'https://site.test', env), env)).status, 200);
    assert.equal(await env.DB.prepare('SELECT id FROM posts WHERE id=?').bind(p.id).first(), null);
  } finally {
    env.DB.close();
  }
});

test('public taxonomy counts only published content and follows edits, trash and restore', async () => {
  const env = await fixture();
  try {
    const stats = async () => await (await routeAPI(req('/api/content-stats', 'GET', undefined, false), env)).json();
    const initial = await stats();
    assert.equal(initial.total, 3);
    assert.deepEqual(initial.categories, [{ key: 'article', count: 3 }]);
    assert.equal(initial.tags.find((t) => t.name === '图论').count, 1);
    const p = (await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, tags: ['私密草稿标签'] }, true, 'https://site.test', env), env)).json()).post;
    assert.equal((await stats()).total, 3);
    assert.ok(!(await stats()).tags.some((t) => t.name === '私密草稿标签'));
    const published = (await (await routeAPI(req('/api/admin/posts/' + p.id, 'PUT', { ...p, status: 'published', tags: ['图论', '图论', '最短路'] }, true, 'https://site.test', env), env)).json()).post;
    const after = await stats();
    assert.equal(after.total, 4);
    assert.equal(after.categories.find((c) => c.key === 'solution').count, 1);
    assert.equal(after.tags.find((t) => t.name === '图论').count, 2);
    assert.equal(after.tags.find((t) => t.name === '最短路').count, 1);
    const tagged = await (await routeAPI(req('/api/posts?tag=' + encodeURIComponent('图论'), 'GET', undefined, false), env)).json();
    assert.equal(tagged.total, 2);
    const filtered = await (await routeAPI(req('/api/posts?category=solution&tag=' + encodeURIComponent('图论'), 'GET', undefined, false), env)).json();
    assert.equal(filtered.total, 1);
    assert.equal(filtered.posts[0].id, p.id);
    assert.equal((await (await routeAPI(req('/api/posts?tag=' + encodeURIComponent('图'), 'GET', undefined, false), env)).json()).total, 0);
    assert.equal((await (await routeAPI(req('/api/posts?tag=' + encodeURIComponent("' OR 1=1 --"), 'GET', undefined, false), env)).json()).total, 0);
    const trashed = (await (await routeAPI(req('/api/admin/posts/' + p.id, 'PATCH', { action: 'trash', version: published.version }, true, 'https://site.test', env), env)).json()).post;
    assert.equal((await stats()).total, 3);
    assert.ok(!(await stats()).tags.some((t) => t.name === '最短路'));
    const restored = (await (await routeAPI(req('/api/admin/posts/' + p.id, 'PATCH', { action: 'restore', version: trashed.version }, true, 'https://site.test', env), env)).json()).post;
    assert.equal((await stats()).total, 4);
    await routeAPI(req('/api/admin/posts/' + p.id, 'PUT', { ...restored, status: 'archived' }, true, 'https://site.test', env), env);
    assert.equal((await stats()).total, 3);
  } finally {
    env.DB.close();
  }
});

test('custom categories accept free text, retain legacy labels and work in filters and counts', async () => {
  const env = await fixture();
  try {
    const p = (await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, category: '  C++ / STL  ', status: 'published' }, true, 'https://site.test', env), env)).json()).post;
    assert.equal(p.category, 'C++ / STL');
    const listed = await (await routeAPI(req('/api/posts?category=' + encodeURIComponent('C++ / STL'), 'GET', undefined, false), env)).json();
    assert.equal(listed.total, 1);
    assert.equal(listed.posts[0].id, p.id);
    const stats = await (await routeAPI(req('/api/content-stats', 'GET', undefined, false), env)).json();
    assert.equal(stats.categories.find((c) => c.key === 'C++ / STL').count, 1);
    const d = (await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, category: '私密学习记录' }, true, 'https://site.test', env), env)).json()).post;
    const suggestions = await (await routeAPI(req('/api/admin/categories', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.ok(suggestions.categories.some((c) => c.label === '私密学习记录'));
    const publicStats = await (await routeAPI(req('/api/content-stats', 'GET', undefined, false), env)).json();
    assert.ok(!publicStats.categories.some((c) => c.key === d.category));
    assert.equal((await routeAPI(req('/api/admin/categories', 'GET', undefined, false), env)).status, 403);
    const legacy = (await (await routeAPI(req('/api/admin/posts', 'POST', { ...draft, category: '题解' }, true, 'https://site.test', env), env)).json()).post;
    assert.equal(legacy.category, 'solution');
    for (const category of ['', '   ', 'a'.repeat(41), 'test\nname']) {
      assert.equal((await routeAPI(req('/api/admin/posts', 'POST', { ...draft, category }, true, 'https://site.test', env), env)).status, 400);
    }
    assert.equal((await (await routeAPI(req('/api/posts?category=' + encodeURIComponent("' OR 1=1 --"), 'GET', undefined, false), env)).json()).total, 0);
    const updated = (await (await routeAPI(req('/api/admin/posts/' + p.id, 'PUT', { ...p, category: '比赛复盘' }, true, 'https://site.test', env), env)).json()).post;
    assert.equal(updated.category, '比赛复盘');
    assert.equal((await (await routeAPI(req('/api/posts?category=' + encodeURIComponent('C++ / STL'), 'GET', undefined, false), env)).json()).total, 0);
    const labels = await (await routeAPI(req('/api/posts?category=' + encodeURIComponent('文章'), 'GET', undefined, false), env)).json();
    assert.equal(labels.total, 3);
  } finally {
    env.DB.close();
  }
});

test('managed navigation validates links, enforces owner access, filters hidden items and detects conflicts', async () => {
  const env = await fixture();
  try {
    const initial = await (await routeAPI(req('/api/admin/navigation', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.equal(initial.version, 0);
    assert.equal(initial.navigation.length, 6);
    const nav = [
      { id: 'home', text: '我的首页', link: '/', hidden: false, newTab: false },
      {
        id: 'group',
        text: '学习记录',
        hidden: false,
        children: [
          { id: 'shown', text: '算法笔记', link: '/journal.html?category=' + encodeURIComponent('算法笔记'), hidden: false, newTab: false },
          { id: 'secret', text: '未开放页面', link: '/private.html', hidden: true, newTab: false },
        ],
      },
      { id: 'hidden', text: '隐藏入口', link: '/hidden.html', hidden: true, newTab: false },
      { id: 'external', text: 'Codeforces', link: 'https://codeforces.com/profile/qiushan233', hidden: false, newTab: true },
    ];
    const put = (navigation, version = 0, auth = true, origin = 'https://site.test') =>
      routeAPI(req('/api/admin/navigation', 'PUT', { navigation, version }, auth, origin, env), env);
    assert.equal((await routeAPI(req('/api/admin/navigation', 'GET', undefined, false), env)).status, 403);
    assert.equal((await put(nav, 0, false)).status, 403);
    assert.equal((await put(nav, 0, true, 'https://other.test')).status, 403);
    for (const link of ['javascript:alert(1)', 'data:text/html,x', '//evil.test', '/\\evil.test', 'https://user:password@site.test', ' https://site.test']) {
      assert.equal((await put([{ id: 'bad', text: '坏链接', link }])).status, 400);
    }
    assert.equal((await put([{ id: 'dup', text: 'A', link: '/' }, { id: 'dup', text: 'B', link: '/' }])).status, 400);
    assert.equal((await put([{ id: 'empty', text: '空菜单', children: [] }])).status, 400);
    const saved = await put(nav);
    assert.equal(saved.status, 200);
    const settings = await saved.json();
    assert.equal(settings.version, 1);
    assert.deepEqual(settings.navigation, nav);
    const publicNav = await (await routeAPI(req('/api/site-settings', 'GET', undefined, false), env)).json();
    assert.equal(publicNav.navigation.length, 3);
    assert.equal(publicNav.navigation[1].children.length, 1);
    assert.ok(!JSON.stringify(publicNav).includes('隐藏入口'));
    assert.ok(!JSON.stringify(publicNav).includes('未开放页面'));
    assert.equal((await put(nav)).status, 409);
    const changed = structuredClone(nav);
    changed[0].text = '主页';
    assert.equal((await put(changed, 1)).status, 200);
    assert.equal((await put(nav, 1)).status, 409);
    assert.equal((await (await routeAPI(req('/api/site-settings', 'GET', undefined, false), env)).json()).navigation[0].text, '主页');
    const backup = await (await routeAPI(req('/api/admin/export', 'GET', undefined, true, 'https://site.test', env), env)).json();
    assert.equal(backup.siteSettings.navigation[0].text, '主页');
    assert.equal(backup.version, 2);
  } finally {
    env.DB.close();
  }
});

test('backup import restores posts with timestamps and pins without duplicating existing rows', async () => {
  const env = await fixture({ withBucket: false });
  try {
    const payload = {
      format: 'naiyael-content-backup',
      version: 2,
      posts: [
        {
          id: '01ad2093-286b-48fb-9322-ef7b21761834',
          title: '最小生成树(C++实现)',
          content: '## Kruskal\n\n并查集实现。',
          excerpt: '最小生成树笔记',
          category: 'solution',
          status: 'published',
          tags: ['最小生成树', '图论'],
          cover: '',
          createdAt: '2026-11-04T13:00:29.090Z',
          updatedAt: '2026-11-21T09:43:25.994Z',
          publishedAt: '2026-11-04T13:00:29.090Z',
          version: 6,
          pinned: true,
        },
      ],
      postOrder: { orderedIds: ['01ad2093-286b-48fb-9322-ef7b21761834'], pinnedIds: ['01ad2093-286b-48fb-9322-ef7b21761834'] },
    };
    assert.equal((await routeAPI(req('/api/admin/import', 'POST', payload, false), env)).status, 403);
    assert.equal((await routeAPI(req('/api/admin/import', 'POST', payload, true, 'https://evil.test', env), env)).status, 403);
    assert.equal((await routeAPI(req('/api/admin/import', 'POST', { format: 'wrong', posts: [] }, true, 'https://site.test', env), env)).status, 400);

    const first = await (await routeAPI(req('/api/admin/import', 'POST', payload, true, 'https://site.test', env), env)).json();
    assert.deepEqual(first, { imported: 1, skipped: 0 });

    const second = await (await routeAPI(req('/api/admin/import', 'POST', payload, true, 'https://site.test', env), env)).json();
    assert.deepEqual(second, { imported: 0, skipped: 1 });

    const listed = await (await routeAPI(req('/api/posts', 'GET', undefined, false), env)).json();
    assert.equal(listed.posts[0].id, '01ad2093-286b-48fb-9322-ef7b21761834');
    assert.equal(listed.posts[0].pinned, true);
    assert.equal(listed.posts[0].publishedAt, '2026-11-04T13:00:29.090Z');
  } finally {
    env.DB.close();
  }
});
