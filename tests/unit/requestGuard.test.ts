// lib/security/requestGuard.ts — the shared guard for cookie-authenticated
// writes (hardening item 2). Requests are built the way a browser sends them;
// the cookie values are fake.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

import { GUARDED, checkOrigin, screen, trustedOrigins } from '../../lib/security/requestGuard.ts';

const SITE = 'https://bbe.test';
const FAKE_SESSION = 'sb-test-auth-token=fake-session';

function request(path: string, headers: Record<string, string>, init: RequestInit = {}): Request {
  return new Request(`${SITE}${path}`, { method: 'POST', headers: { cookie: FAKE_SESSION, ...headers }, ...init });
}

function reasonOf(req: Request): string {
  const verdict = checkOrigin(req, []);
  return verdict.ok ? 'ok' : verdict.reason;
}

describe('screen() — CSRF', () => {
  it('refuses a forged cross-origin form POST', async () => {
    const forged = request('/auth/signout', {
      origin: 'https://evil.test',
      referer: 'https://evil.test/page',
      'content-type': 'application/x-www-form-urlencoded',
    });
    const refused = screen(forged, GUARDED.signOut, {});
    assert.equal(refused?.status, 403);
    assert.deepEqual(await refused?.json(), { error: 'forbidden' });
  });

  it('refuses a cross-origin text/plain form carrying a JSON-shaped body', () => {
    const forged = request(
      '/api/agent/extract',
      { origin: 'https://evil.test', 'content-type': 'text/plain' },
      { body: JSON.stringify({ text: 'Do the thing.' }) },
    );
    assert.equal(screen(forged, GUARDED.extract, {})?.status, 403);
  });

  it('lets the page’s own fetch through', () => {
    const own = request('/api/agent/extract', { origin: SITE, 'content-type': 'application/json' }, { body: '{}' });
    assert.equal(screen(own, GUARDED.extract, {}), null);
  });

  it('lets the page’s own sign-out form through', () => {
    const own = request('/auth/signout', { origin: SITE, 'content-type': 'application/x-www-form-urlencoded' });
    assert.equal(screen(own, GUARDED.signOut, {}), null);
  });

  it('lets the page’s own DELETE /api/account through', () => {
    const own = request('/api/account', { origin: SITE }, { method: 'DELETE' });
    assert.equal(screen(own, GUARDED.account, {}), null);
  });

  it('refuses a write that names no origin at all', () => {
    const bare = request('/api/account', {}, { method: 'DELETE' });
    assert.equal(reasonOf(bare), 'origin_missing');
    assert.equal(screen(bare, GUARDED.account, {})?.status, 403);
  });

  it('refuses Origin: null, even beside a same-site Referer', () => {
    const sandboxed = request('/auth/signout', { origin: 'null', referer: `${SITE}/text` });
    assert.equal(reasonOf(sandboxed), 'origin_null');
    assert.equal(screen(sandboxed, GUARDED.signOut, {})?.status, 403);
  });
});

describe('checkOrigin()', () => {
  it('falls back to Referer only when Origin is absent', () => {
    assert.equal(reasonOf(request('/auth/signout', { referer: `${SITE}/text?x=1` })), 'ok');
    assert.equal(reasonOf(request('/auth/signout', { referer: 'https://evil.test/' })), 'referer_mismatch');
    assert.equal(reasonOf(request('/auth/signout', { referer: 'not a url' })), 'referer_invalid');
    assert.equal(reasonOf(request('/auth/signout', { origin: 'https://evil.test', referer: `${SITE}/text` })), 'origin_mismatch');
  });

  it('refuses an Origin that is not an http(s) origin', () => {
    assert.equal(reasonOf(request('/api/account', { origin: 'chrome-extension://abcdef' })), 'origin_invalid');
    assert.equal(reasonOf(request('/api/account', { origin: '' })), 'origin_invalid');
  });

  it('treats another scheme, port, subdomain or look-alike host as another origin', () => {
    for (const origin of ['http://bbe.test', 'https://bbe.test:8443', 'https://sub.bbe.test', 'https://bbe.test.evil.test', 'https://evilbbe.test']) {
      assert.equal(reasonOf(request('/api/account', { origin })), 'origin_mismatch', origin);
    }
  });

  it('matches the host the browser used, not only the one Next resolved', () => {
    // `next start -p 3102` resolves request.url to localhost, whatever the Host.
    const local = new Request('http://localhost:3102/api/account', {
      method: 'DELETE',
      headers: { host: '127.0.0.1:3102', 'x-forwarded-host': '127.0.0.1:3102', 'x-forwarded-proto': 'http', origin: 'http://127.0.0.1:3102' },
    });
    assert.equal(reasonOf(local), 'ok');
    // Vercel: the custom domain arrives as host / x-forwarded-host.
    const vercel = new Request('https://bbe-abc123.vercel.app/api/account', {
      method: 'DELETE',
      headers: { host: 'bbe.example', 'x-forwarded-host': 'bbe.example', 'x-forwarded-proto': 'https', origin: 'https://bbe.example' },
    });
    assert.equal(reasonOf(vercel), 'ok');
  });

  it('adds CSRF_TRUSTED_ORIGINS, dropping anything that is not an http(s) origin', () => {
    const env = { CSRF_TRUSTED_ORIGINS: ' https://admin.bbe.test , *, null, not a url, ftp://files.test, https://other.test/path ,' };
    assert.deepEqual(trustedOrigins(env), ['https://admin.bbe.test', 'https://other.test']);
    const trusted = request('/api/account', { origin: 'https://admin.bbe.test' }, { method: 'DELETE' });
    assert.equal(screen(trusted, GUARDED.account, env), null);
    assert.equal(screen(trusted, GUARDED.account, {})?.status, 403);
    assert.deepEqual(trustedOrigins({}), []);
  });
});

describe('coverage — every cookie-authenticated write is screened', () => {
  const APP = join(import.meta.dirname, '..', '..', 'app');
  const WRITES = /export\s+(?:async\s+function|const)\s+(?:POST|PUT|PATCH|DELETE)\b/;

  /** app/(group)/api/x/route.ts → /api/x */
  const routeOf = (file: string) =>
    '/' +
    file
      .split(sep)
      .slice(0, -1)
      .filter((segment) => !/^\(.*\)$/.test(segment))
      .join('/');

  const writers = (readdirSync(APP, { recursive: true }) as string[])
    .filter((file) => file.endsWith(`${sep}route.ts`) || file === 'route.ts')
    .map((file) => ({ file, route: routeOf(file), source: readFileSync(join(APP, file), 'utf8') }))
    .filter(({ source }) => WRITES.test(source));

  it('GUARDED lists exactly the routes that export POST, PUT, PATCH or DELETE', () => {
    assert.deepEqual(
      writers.map((w) => w.route).sort(),
      Object.values(GUARDED)
        .map((policy) => policy.route)
        .sort(),
    );
  });

  it('each of them screens the request first, under its own policy', () => {
    for (const { route, source } of writers) {
      assert.match(source, /const refused = screen\(request, ROUTE\);\s*if \(refused\) return refused;/, route);
      const key = /const ROUTE = GUARDED\.(\w+);/.exec(source)?.[1] as keyof typeof GUARDED | undefined;
      assert.ok(key, route);
      assert.equal(GUARDED[key].route, route);
    }
  });
});
