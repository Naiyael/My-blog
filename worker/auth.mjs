const SESSION_COOKIE = 'blog_admin_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 10;

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const jwksCache = new Map();
const loginFailures = new Map();

function base64UrlEncode(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlDecode(str) {
  if (typeof str !== 'string' || !/^[A-Za-z0-9_-]+$/.test(str)) return null;
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  try {
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function timingSafeEqualBytes(a, b) {
  if (a.byteLength !== b.byteLength) return false;
  if (typeof crypto.subtle?.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(a, b);
  }
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function hexToBytes(hex) {
  if (typeof hex !== 'string' || hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function parseCookies(request) {
  const map = new Map();
  const raw = request.headers.get('cookie');
  if (!raw) return map;
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key && !map.has(key)) map.set(key, value);
  }
  return map;
}

export function normalizeTeamDomain(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  const trimmed = value.trim().replace(/\/+$/, '');
  const candidate = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    return url.origin;
  } catch {
    return '';
  }
}

export function hasPasswordAuth(env) {
  return Boolean(
    (typeof env?.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length > 0) ||
      (typeof env?.ADMIN_PASSWORD_HASH === 'string' && env.ADMIN_PASSWORD_HASH.length > 0)
  );
}

export function hasAccessAuth(env) {
  return Boolean(
    normalizeTeamDomain(env?.CF_ACCESS_TEAM_DOMAIN) &&
      typeof env?.CF_ACCESS_AUD === 'string' &&
      env.CF_ACCESS_AUD.trim().length > 0
  );
}

async function constantTimeEqualText(a, b) {
  const [hashA, hashB] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  return timingSafeEqualBytes(new Uint8Array(hashA), new Uint8Array(hashB));
}

export async function verifyAdminPassword(password, env) {
  if (typeof password !== 'string' || !password || password.length > 256) return false;
  if (typeof env?.ADMIN_PASSWORD_HASH === 'string' && env.ADMIN_PASSWORD_HASH.trim()) {
    const stored = env.ADMIN_PASSWORD_HASH.trim();
    if (stored.startsWith('pbkdf2$')) {
      const parts = stored.split('$');
      if (parts.length !== 4) return false;
      const iterations = Number.parseInt(parts[1], 10);
      const salt = hexToBytes(parts[2]);
      const expected = hexToBytes(parts[3]);
      if (!Number.isInteger(iterations) || iterations < 10000 || iterations > 600000 || !salt || !expected) {
        return false;
      }
      const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
      const derived = new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, expected.byteLength * 8)
      );
      return timingSafeEqualBytes(derived, expected);
    }
    if (stored.startsWith('sha256$')) {
      const expected = hexToBytes(stored.slice('sha256$'.length));
      if (!expected || expected.byteLength !== 32) return false;
      const actual = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(password)));
      return timingSafeEqualBytes(actual, expected);
    }
    return false;
  }
  if (typeof env?.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length > 0) {
    return constantTimeEqualText(password, env.ADMIN_PASSWORD);
  }
  return false;
}

async function getSessionKey(env) {
  const rawSecret =
    (typeof env?.SESSION_SECRET === 'string' && env.SESSION_SECRET.trim()) ||
    (typeof env?.ADMIN_PASSWORD_HASH === 'string' && env.ADMIN_PASSWORD_HASH.trim()
      ? `naiyael-session-v1:${env.ADMIN_PASSWORD_HASH.trim()}`
      : typeof env?.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length > 0
        ? `naiyael-session-v1:${env.ADMIN_PASSWORD}`
        : '');
  if (!rawSecret) return null;
  const keyBytes = await crypto.subtle.digest('SHA-256', encoder.encode(rawSecret));
  return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function createSessionToken(env, nowSec = Math.floor(Date.now() / 1000)) {
  const key = await getSessionKey(env);
  if (!key) throw new Error('Session signing key is not configured');
  const payload = { v: 1, sub: 'owner', iat: nowSec, exp: nowSec + SESSION_TTL_SECONDS };
  const encodedPayload = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload)));
  return `${encodedPayload}.${base64UrlEncode(signature)}`;
}

export function sessionCookieHeader(token, request, clear = false) {
  const secure = new URL(request.url).protocol === 'https:';
  return `${SESSION_COOKIE}=${clear ? '' : token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_TTL_SECONDS}${secure ? '; Secure' : ''}`;
}

export async function verifySessionCookie(request, env, nowSec = Math.floor(Date.now() / 1000)) {
  if (!hasPasswordAuth(env)) return null;
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, encodedSig] = parts;
  const providedSig = base64UrlDecode(encodedSig);
  const payloadBytes = base64UrlDecode(encodedPayload);
  if (!providedSig || !payloadBytes) return null;
  const key = await getSessionKey(env);
  if (!key) return null;
  const expectedSig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(encodedPayload)));
  if (!timingSafeEqualBytes(providedSig, expectedSig)) return null;
  let payload;
  try {
    payload = JSON.parse(decoder.decode(payloadBytes));
  } catch {
    return null;
  }
  if (
    payload?.v !== 1 ||
    payload?.sub !== 'owner' ||
    typeof payload?.iat !== 'number' ||
    typeof payload?.exp !== 'number' ||
    payload.exp <= nowSec ||
    payload.iat > nowSec + 60
  ) {
    return null;
  }
  return {
    mode: 'password',
    userId: 'owner',
    email: typeof env?.SITE_ADMIN_EMAIL === 'string' ? env.SITE_ADMIN_EMAIL.trim() : '',
  };
}

async function loadAccessJWKS(teamDomain, forceRefresh, fetcher = fetch) {
  const cached = jwksCache.get(teamDomain);
  const now = Date.now();
  if (!forceRefresh && cached && now - cached.fetchedAt < JWKS_CACHE_TTL_MS) {
    return cached.keys;
  }
  const response = await fetcher(`${teamDomain}/cdn-cgi/access/certs`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) return null;
  const body = await response.json();
  if (!Array.isArray(body?.keys)) return null;
  if (jwksCache.size > 20) jwksCache.clear();
  jwksCache.set(teamDomain, { keys: body.keys, fetchedAt: now });
  return body.keys;
}

export async function verifyAccessJWT(request, env, options = {}) {
  const teamDomain = normalizeTeamDomain(env?.CF_ACCESS_TEAM_DOMAIN);
  const expectedAud = typeof env?.CF_ACCESS_AUD === 'string' ? env.CF_ACCESS_AUD.trim() : '';
  if (!teamDomain || !expectedAud) return null;

  const token =
    request.headers.get('cf-access-jwt-assertion')?.trim() ||
    parseCookies(request).get('CF_Authorization')?.trim() ||
    '';
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const headerBytes = base64UrlDecode(headerB64);
  const payloadBytes = base64UrlDecode(payloadB64);
  const sigBytes = base64UrlDecode(sigB64);
  if (!headerBytes || !payloadBytes || !sigBytes) return null;

  let header;
  let payload;
  try {
    header = JSON.parse(decoder.decode(headerBytes));
    payload = JSON.parse(decoder.decode(payloadBytes));
  } catch {
    return null;
  }

  if (header?.alg !== 'RS256' || typeof header?.kid !== 'string' || !header.kid) return null;
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const audList = Array.isArray(payload?.aud) ? payload.aud : typeof payload?.aud === 'string' ? [payload.aud] : [];
  if (
    payload?.iss !== teamDomain ||
    !audList.includes(expectedAud) ||
    typeof payload?.exp !== 'number' ||
    payload.exp + 60 <= nowSec ||
    (typeof payload?.nbf === 'number' && payload.nbf - 60 > nowSec)
  ) {
    return null;
  }

  const email = typeof payload?.email === 'string' ? payload.email.trim() : '';
  const allowedEmail = typeof env?.SITE_ADMIN_EMAIL === 'string' ? env.SITE_ADMIN_EMAIL.trim() : '';
  if (allowedEmail && email.toLowerCase() !== allowedEmail.toLowerCase()) {
    return null;
  }

  const fetcher = options.jwksFetcher ?? fetch;
  let keys = await loadAccessJWKS(teamDomain, false, fetcher);
  let jwk = keys?.find((key) => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) {
    keys = await loadAccessJWKS(teamDomain, true, fetcher);
    jwk = keys?.find((key) => key.kid === header.kid && key.kty === 'RSA');
  }
  if (!jwk) return null;

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const verified = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      sigBytes,
      encoder.encode(`${headerB64}.${payloadB64}`)
    );
    if (!verified) return null;
  } catch {
    return null;
  }

  return {
    mode: 'access',
    userId: String(payload.sub || email || 'access-owner'),
    email,
  };
}

export async function authenticateAdmin(request, env, options = {}) {
  const accessAuth = await verifyAccessJWT(request, env, options);
  if (accessAuth) return accessAuth;
  const sessionAuth = await verifySessionCookie(request, env, options.nowSec);
  if (sessionAuth) return sessionAuth;
  return null;
}

export async function authStatus(request, env, options = {}) {
  const auth = await authenticateAdmin(request, env, options);
  return {
    authenticated: !!auth,
    authMode: auth?.mode ?? null,
    methods: {
      password: hasPasswordAuth(env),
      access: hasAccessAuth(env),
    },
    uploadsEnabled: !!env?.BUCKET,
    ...(auth ? { name: 'Naiyael', ...(auth.email ? { email: auth.email } : {}) } : {}),
  };
}

function clientKey(request) {
  return request.headers.get('cf-connecting-ip') || 'local';
}

export function isLoginRateLimited(request, now = Date.now()) {
  const key = clientKey(request);
  const record = loginFailures.get(key);
  if (!record) return false;
  if (now - record.windowStart > LOGIN_WINDOW_MS) {
    loginFailures.delete(key);
    return false;
  }
  return record.count >= MAX_LOGIN_FAILURES;
}

export function recordLoginFailure(request, now = Date.now()) {
  if (loginFailures.size > 500) loginFailures.clear();
  const key = clientKey(request);
  const record = loginFailures.get(key);
  if (!record || now - record.windowStart > LOGIN_WINDOW_MS) {
    loginFailures.set(key, { count: 1, windowStart: now });
  } else {
    record.count += 1;
  }
}

export function clearLoginFailures(request) {
  loginFailures.delete(clientKey(request));
}

export function clearAuthCaches() {
  jwksCache.clear();
  loginFailures.clear();
}
