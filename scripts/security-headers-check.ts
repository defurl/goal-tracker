/**
 * security:headers — what the edge sends, asserted against a running server.
 *
 *   1. Every kind of response carries the header set in next.config.mjs, and
 *      none says X-Powered-By. sw.js still serves as JavaScript.
 *   2. HSTS on https (the platform's, max-age a year or more), never on http.
 *   3. CORS: no route handler, auth route or dynamic page grants anything to a
 *      foreign origin or to `null`, preflight included. Vercel's `*` on static
 *      build output is tolerated there and only there, never with credentials
 *      and never as a reflected origin (next.config.mjs says why).
 *   4. Directory paths, /.env, /.git/config and source maps end in 403 or 404,
 *      never a listing; /_next/image serves no image.
 *
 * Read-only against any host: no cookies, no credentials, empty bodies, and the
 * state-changing routes (sign-out, account deletion) are only preflighted.
 *
 * Usage: `pnpm build && pnpm start -p 3101`, then `pnpm security:headers`, or
 * `pnpm security:headers https://<deployment>`. Default http://localhost:3101.
 */

const BASE = (process.argv[2] ?? process.env.SECURITY_BASE_URL ?? 'http://localhost:3101').replace(/\/$/, '');
const HTTPS = BASE.startsWith('https:');
const FOREIGN_ORIGINS = ['https://evil.example', 'null'];

const failures: string[] = [];

function check(ok: boolean, what: string, detail = ''): void {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(what);
}

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(BASE + path, { redirect: 'manual', ...init });
}

/** The first hashed script the room's HTML names: a real /_next/static path for this build. */
async function aStaticChunk(): Promise<string> {
  const html = await (await request('/')).text();
  return /\/_next\/static\/chunks\/[^"']+\.js/.exec(html)?.[0] ?? '/_next/static/chunks/missing.js';
}

const EXPECTED: Record<string, (value: string | null) => boolean> = {
  'x-content-type-options': (v) => v === 'nosniff',
  'referrer-policy': (v) => v === 'strict-origin-when-cross-origin',
  'x-frame-options': (v) => v === 'DENY',
  'content-security-policy': (v) => v === "frame-ancestors 'none'",
  'permissions-policy': (v) =>
    ['camera', 'microphone', 'geolocation', 'payment', 'usb'].every((f) => (v ?? '').includes(`${f}=()`)),
};

async function headerSet(chunk: string): Promise<void> {
  console.log('\nheader set');
  const paths = ['/', '/text', '/login', '/privacy', '/no-such-page', '/manifest.webmanifest', '/sw.js', chunk, '/api/cron/seed-challenges'];
  for (const path of paths) {
    const res = await request(path);
    const wrong = Object.entries(EXPECTED)
      .filter(([name, ok]) => !ok(res.headers.get(name)))
      .map(([name]) => `${name}: ${res.headers.get(name) ?? '(none)'}`);
    if (res.headers.has('x-powered-by')) wrong.push(`x-powered-by: ${res.headers.get('x-powered-by')}`);
    check(wrong.length === 0, `${path} (${res.status})`, wrong.join('; '));
  }
  const sw = await request('/sw.js');
  check(/javascript/.test(sw.headers.get('content-type') ?? ''), '/sw.js serves as JavaScript', sw.headers.get('content-type') ?? '(none)');
}

async function hsts(): Promise<void> {
  console.log(`\nHSTS (${HTTPS ? 'https: required' : 'http: must be absent'})`);
  const value = (await request('/text')).headers.get('strict-transport-security');
  if (HTTPS) {
    const maxAge = Number(/max-age=(\d+)/.exec(value ?? '')?.[1] ?? 0);
    check(maxAge >= 31536000, 'Strict-Transport-Security, a year or more', value ?? '(none)');
  } else {
    check(value === null, 'no Strict-Transport-Security over plain http', value ?? '');
  }
}

async function cors(chunk: string): Promise<void> {
  console.log('\nCORS');
  // Function responses: nothing at all for another origin.
  const dynamic: [string, string][] = [
    ['GET', '/login'],
    ['GET', '/api/cron/seed-challenges'],
    ['POST', '/api/agent/extract'],
    ['POST', '/api/agent/reflect'],
    ['GET', '/auth/callback'],
  ];
  const preflights: [string, string][] = [
    ['POST', '/api/agent/extract'],
    ['POST', '/api/agent/reflect'],
    ['DELETE', '/api/account'],
    ['POST', '/auth/signout'],
  ];
  for (const origin of FOREIGN_ORIGINS) {
    for (const [method, path] of dynamic) {
      const res = await request(path, {
        method,
        headers: { Origin: origin, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
        body: method === 'POST' ? '{}' : undefined,
      });
      const granted = [...res.headers.keys()].filter((k) => k.startsWith('access-control-'));
      check(granted.length === 0, `${method} ${path} from ${origin}: no CORS headers (${res.status})`, granted.join(', '));
    }
    for (const [method, path] of preflights) {
      const res = await request(path, {
        method: 'OPTIONS',
        headers: { Origin: origin, 'Access-Control-Request-Method': method, 'Access-Control-Request-Headers': 'content-type' },
      });
      const granted = [...res.headers.keys()].filter((k) => k.startsWith('access-control-'));
      check(granted.length === 0, `preflight ${method} ${path} from ${origin}: nothing granted (${res.status})`, granted.join(', '));
    }
  }
  // Static build output: Vercel's `*` is tolerated; a reflected origin or credentials never are.
  for (const path of ['/', '/text', '/signup', '/privacy', '/manifest.webmanifest', '/sw.js', '/icon.svg', chunk]) {
    const res = await request(path, { headers: { Origin: 'https://evil.example' } });
    const acao = res.headers.get('access-control-allow-origin');
    const creds = res.headers.get('access-control-allow-credentials');
    check((acao === null || acao === '*') && creds === null, `${path}: static, at most \`*\` and no credentials`, `${acao ?? '-'} / ${creds ?? '-'}`);
  }
}

async function noListings(chunk: string): Promise<void> {
  console.log('\nno listings, no secrets');
  const paths = ['/fonts/', '/_next/', '/_next/static/', '/_next/static/chunks/', '/api/', '/public/', '/.git/', '/.env', '/.env.local', '/.git/config', '/sw.js.map', `${chunk}.map`];
  for (const path of paths) {
    const res = await fetch(BASE + path, { redirect: 'follow' });
    const body = await res.text();
    const listing = /index of|directory listing|parent directory/i.test(body);
    check([403, 404].includes(res.status) && !listing, `${path} ends in 403/404`, `${res.status}${listing ? ', looks like a listing' : ''}`);
  }
  const image = await request('/_next/image?url=%2Fapple-touch-icon.png&w=64&q=75');
  const type = image.headers.get('content-type') ?? '';
  check(!type.startsWith('image/'), '/_next/image serves no image', `${image.status} ${type}`);
}

async function main(): Promise<void> {
  console.log(`security:headers  (${BASE})`);
  const chunk = await aStaticChunk();
  await headerSet(chunk);
  await hsts();
  await cors(chunk);
  await noListings(chunk);

  if (failures.length > 0) {
    console.error(`\nsecurity:headers: ${failures.length} failure(s).`);
    process.exit(1);
  }
  console.log('\nsecurity:headers: the edge says what it should.');
}

main().catch((err) => {
  console.error(`\nsecurity:headers failed: ${(err as Error).message}\n`);
  console.error('Is the server running? `pnpm build && pnpm start -p 3101`.');
  process.exit(1);
});
