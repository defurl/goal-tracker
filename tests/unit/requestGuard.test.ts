// lib/security/requestGuard.ts — the shared guard for cookie-authenticated
// writes (hardening item 2). Requests are built the way a browser sends them;
// the cookie values are fake.

import { after, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

import { ExtractInput } from '../../lib/agents/extract.ts';
import { ReflectInput } from '../../lib/agents/reflect.ts';
import { MAX_ENTRY_CHARS, MOOD_KEYS, TOPIC_TAGS } from '../../lib/journal/moods.ts';
import {
  DEFAULT_BODY_LIMITS,
  EXTRACT_TEXT_MAX_CHARS,
  EXTRACT_URL_MAX_CHARS,
  bodyLimit,
} from '../../lib/security/limits.ts';
import {
  GUARDED,
  checkOrigin,
  isJsonContentType,
  readJson,
  screen,
  trustedOrigins,
} from '../../lib/security/requestGuard.ts';

// Every refusal writes a security event with console.log: collected here, not printed.
const logged: string[] = [];
before(() => mock.method(console, 'log', (line: string) => void logged.push(line)));
after(() => mock.restoreAll());
beforeEach(() => void logged.splice(0));

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

describe('screen() — a JSON route takes only JSON', () => {
  it('refuses a same-origin text/plain body shaped like JSON with 415', async () => {
    const smuggled = request(
      '/api/agent/reflect',
      { origin: SITE, 'content-type': 'text/plain' },
      { body: JSON.stringify({ entry_text: 'x', mood: 'calm', tags: [] }) },
    );
    const refused = screen(smuggled, GUARDED.reflect, {});
    assert.equal(refused?.status, 415);
    assert.deepEqual(await refused?.json(), { error: 'unsupported_media_type' });
  });

  it('refuses the other form encodings, and a body with no type', () => {
    for (const type of ['application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', null]) {
      const headers: Record<string, string> = { origin: SITE };
      if (type) headers['content-type'] = type;
      assert.equal(screen(request('/api/agent/extract', headers, { body: '{}' }), GUARDED.extract, {})?.status, 415, String(type));
    }
  });

  it('reads the media type the way a browser writes it', () => {
    assert.ok(isJsonContentType('application/json'));
    assert.ok(isJsonContentType('Application/JSON; charset=UTF-8'));
    assert.ok(isJsonContentType('application/json;charset="utf-8"'));
    assert.ok(!isJsonContentType('application/json; charset=iso-8859-1'));
    assert.ok(!isJsonContentType('application/jsonx'));
    assert.ok(!isJsonContentType('text/json'));
    assert.ok(!isJsonContentType(''));
    assert.ok(!isJsonContentType(null));
  });

  it('asks for no content type where no body is read', () => {
    assert.equal(screen(request('/api/account', { origin: SITE }, { method: 'DELETE' }), GUARDED.account, {}), null);
    const form = request('/auth/signout', { origin: SITE, 'content-type': 'application/x-www-form-urlencoded' });
    assert.equal(screen(form, GUARDED.signOut, {}), null);
  });
});

const bytesOf = (text: string) => new TextEncoder().encode(text).byteLength;

/** `{"text":"aaa…"}` of exactly `bytes` bytes. */
function jsonOfBytes(bytes: number): string {
  const [head, tail] = ['{"text":"', '"}'];
  return head + 'a'.repeat(bytes - head.length - tail.length) + tail;
}

interface Tap {
  pulls: number;
  cancelled: boolean;
}

/** A chunked body that never ends: 1 KB a pull, pulled only when read. */
function endless(tap: Tap): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        tap.pulls++;
        controller.enqueue(new Uint8Array(1024).fill(0x61));
      },
      cancel() {
        tap.cancelled = true;
      },
    },
    { highWaterMark: 0 },
  );
}

/** `text` as a chunked body, with no Content-Length. */
function chunked(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        if (offset >= bytes.byteLength) return controller.close();
        controller.enqueue(bytes.slice(offset, offset + 512));
        offset += 512;
      },
    },
    { highWaterMark: 0 },
  );
}

function jsonPost(headers: Record<string, string>, body: BodyInit): Request {
  // `duplex` is required for a stream body; the DOM's RequestInit type lacks it.
  return new Request(`${SITE}/api/agent/extract`, {
    method: 'POST',
    headers: { origin: SITE, 'content-type': 'application/json', ...headers },
    body,
    duplex: 'half',
  } as RequestInit);
}

/** Runs `read` with JSON.parse watched; returns how often it ran. */
async function parsesDuring(read: () => Promise<unknown>): Promise<number> {
  const parse = mock.method(JSON, 'parse');
  try {
    await read();
    return parse.mock.callCount();
  } finally {
    parse.mock.restore();
  }
}

describe('body caps — derived from the schemas they guard', () => {
  it('mirrors ExtractInput’s maxima', () => {
    assert.ok(ExtractInput.safeParse({ text: 'a'.repeat(EXTRACT_TEXT_MAX_CHARS) }).success);
    assert.ok(!ExtractInput.safeParse({ text: 'a'.repeat(EXTRACT_TEXT_MAX_CHARS + 1) }).success);
    // The schema takes only a real http(s) URL, so pad a valid one to the length under test.
    const urlOf = (length: number) => {
      const base = 'https://example.com/';
      return base + 'a'.repeat(length - base.length);
    };
    assert.ok(ExtractInput.safeParse({ url: urlOf(EXTRACT_URL_MAX_CHARS) }).success);
    assert.ok(!ExtractInput.safeParse({ url: urlOf(EXTRACT_URL_MAX_CHARS + 1) }).success);
  });

  it('never refuses a body its schema accepts, even one of six-byte escapes', () => {
    // JSON.stringify writes a control character as \u0001: six bytes for one character.
    const extract = JSON.stringify({ text: '\u0001'.repeat(EXTRACT_TEXT_MAX_CHARS) });
    assert.ok(ExtractInput.safeParse(JSON.parse(extract)).success);
    assert.ok(bytesOf(extract) <= DEFAULT_BODY_LIMITS.extract);

    const longestMood = [...MOOD_KEYS].sort((a, b) => b.length - a.length)[0];
    const reflect = JSON.stringify({ entry_text: '\u0001'.repeat(MAX_ENTRY_CHARS), mood: longestMood, tags: [...TOPIC_TAGS] });
    assert.ok(ReflectInput.safeParse(JSON.parse(reflect)).success);
    assert.ok(bytesOf(reflect) <= DEFAULT_BODY_LIMITS.reflect);
  });

  it('holds the numbers its comments state', () => {
    assert.equal(DEFAULT_BODY_LIMITS.extract, 313_312);
    assert.equal(DEFAULT_BODY_LIMITS.reflect, 13_408);
    assert.equal(DEFAULT_BODY_LIMITS.other, 1024);
  });

  it('takes an override from the environment, and ignores one that is not a positive integer', () => {
    assert.equal(bodyLimit('extract', { BODY_LIMIT_EXTRACT_BYTES: '5000' }), 5000);
    assert.equal(bodyLimit('other', { BODY_LIMIT_DEFAULT_BYTES: ' 2048 ' }), 2048);
    for (const bad of ['0', '-1', 'abc', '1e6', '12.5', '', ' ', '99999999999999999999']) {
      assert.equal(bodyLimit('reflect', { BODY_LIMIT_REFLECT_BYTES: bad }), DEFAULT_BODY_LIMITS.reflect, bad);
    }
    assert.equal(bodyLimit('other', {}), 1024);
  });
});

describe('the byte cap — refused before the parser runs', () => {
  const LIMIT = 4096;
  const env = { BODY_LIMIT_EXTRACT_BYTES: String(LIMIT) };

  it('screen() refuses a declared Content-Length over the cap with 413, reading nothing', async () => {
    const tap: Tap = { pulls: 0, cancelled: false };
    const oversized = jsonPost({ 'content-length': String(LIMIT + 1) }, endless(tap));
    const refused = screen(oversized, GUARDED.extract, env);
    assert.equal(refused?.status, 413);
    assert.deepEqual(await refused?.json(), { error: 'too_large' });
    assert.equal(tap.pulls, 0);
  });

  it('screen() holds a body-less route to the small default cap', () => {
    const own = { origin: SITE, 'content-length': String(DEFAULT_BODY_LIMITS.other + 1) };
    assert.equal(screen(request('/auth/signout', own), GUARDED.signOut, {})?.status, 413);
    assert.equal(screen(request('/auth/signout', { origin: SITE, 'content-length': '0' }), GUARDED.signOut, {}), null);
  });

  it('readJson() refuses a declared length over the cap without reading or parsing', async () => {
    const tap: Tap = { pulls: 0, cancelled: false };
    let status = 0;
    const parses = await parsesDuring(async () => {
      const read = await readJson(jsonPost({ 'content-length': String(LIMIT + 1) }, endless(tap)), GUARDED.extract, null, env);
      status = read.ok ? 200 : read.response.status;
    });
    assert.equal(status, 413);
    assert.equal(parses, 0);
    assert.equal(tap.pulls, 0);
  });

  it('readJson() refuses a chunked body (no Content-Length) once it passes the cap, stops reading, and never parses', async () => {
    const tap: Tap = { pulls: 0, cancelled: false };
    const endlessBody = jsonPost({}, endless(tap));
    assert.equal(endlessBody.headers.get('content-length'), null);
    let status = 0;
    const parses = await parsesDuring(async () => {
      const read = await readJson(endlessBody, GUARDED.extract, null, env);
      status = read.ok ? 200 : read.response.status;
    });
    assert.equal(status, 413);
    assert.equal(parses, 0);
    assert.ok(tap.cancelled, 'the stream is cancelled');
    assert.ok(tap.pulls <= LIMIT / 1024 + 2, `read ${tap.pulls} KB of a ${LIMIT / 1024} KB cap`);
  });

  it('readJson() catches a body longer than its Content-Length claims', async () => {
    const tap: Tap = { pulls: 0, cancelled: false };
    const read = await readJson(jsonPost({ 'content-length': '10' }, endless(tap)), GUARDED.extract, null, env);
    assert.equal(read.ok ? 200 : read.response.status, 413);
  });

  it('readJson() accepts a body of exactly the cap, declared or chunked, and parses it', async () => {
    const atCap = jsonOfBytes(LIMIT);
    assert.equal(bytesOf(atCap), LIMIT);
    const declared = await readJson(jsonPost({ 'content-length': String(LIMIT) }, atCap), GUARDED.extract, null, env);
    assert.deepEqual(declared, { ok: true, value: JSON.parse(atCap) });
    const streamed = await readJson(jsonPost({}, chunked(atCap)), GUARDED.extract, null, env);
    assert.deepEqual(streamed, { ok: true, value: JSON.parse(atCap) });
    // The control for the "never parses" checks above: the watch does see a parse.
    assert.equal(await parsesDuring(() => readJson(jsonPost({}, chunked(atCap)), GUARDED.extract, null, env)), 1);

    const overCap = await readJson(jsonPost({}, chunked(jsonOfBytes(LIMIT + 1))), GUARDED.extract, null, env);
    assert.equal(overCap.ok ? 200 : overCap.response.status, 413);
  });

  it('readJson() reads a body that is not JSON, or none, as undefined for the schema to refuse', async () => {
    assert.deepEqual(await readJson(jsonPost({}, 'not json'), GUARDED.extract, null, env), { ok: true, value: undefined });
    assert.deepEqual(await readJson(jsonPost({}, ''), GUARDED.extract, null, env), { ok: true, value: undefined });
  });
});

describe('security events — one line per refusal, nothing from the request but four headers', () => {
  const only = () => {
    assert.equal(logged.length, 1, logged.join('\n'));
    return JSON.parse(logged[0] ?? '') as Record<string, unknown>;
  };

  it('logs a forged origin, a wrong content type and both kinds of oversized body, once each', async () => {
    screen(request('/auth/signout', { origin: 'https://evil.test' }), GUARDED.signOut, {});
    assert.deepEqual(
      [only().event, only().reason, only().status, only().route],
      ['csrf.refused', 'origin_mismatch', 403, '/auth/signout'],
    );

    logged.splice(0);
    screen(request('/api/agent/reflect', { origin: SITE, 'content-type': 'text/plain' }, { body: '{}' }), GUARDED.reflect, {});
    assert.deepEqual([only().event, only().reason, only().status], ['request.unsupported_media_type', 'content_type', 415]);

    logged.splice(0);
    screen(jsonPost({ 'content-length': '999999999' }, '{}'), GUARDED.extract, {});
    assert.deepEqual([only().event, only().reason, only().status], ['request.too_large', 'declared_length', 413]);

    logged.splice(0);
    const tap: Tap = { pulls: 0, cancelled: false };
    await readJson(jsonPost({}, endless(tap)), GUARDED.extract, 'user-1', { BODY_LIMIT_EXTRACT_BYTES: '2048' });
    assert.deepEqual([only().event, only().reason, only().user_id], ['request.too_large', 'body_length', 'user-1']);
  });

  it('logs nothing for a request that passes', async () => {
    assert.equal(screen(request('/api/account', { origin: SITE }, { method: 'DELETE' }), GUARDED.account, {}), null);
    await readJson(jsonPost({}, '{"text":"fine"}'), GUARDED.extract, 'user-1', {});
    assert.equal(logged.length, 0);
  });

  it('writes no cookie, Authorization header, query string, body or body length — on the journal route too', async () => {
    const MARKERS = ['COOKIE_MARKER_7f3a', 'AUTH_MARKER_91c2', 'QUERY_MARKER_55e1', 'BODY_MARKER_d00d'];
    const reflectEnv = { BODY_LIMIT_REFLECT_BYTES: '256' };
    const body = JSON.stringify({ entry_text: `BODY_MARKER_d00d ${'x'.repeat(400)}`, mood: 'calm', tags: [] });
    const marked = (origin: string, init: { contentLength?: boolean; stream?: boolean } = {}) =>
      new Request(`${SITE}/api/agent/reflect?token=QUERY_MARKER_55e1`, {
        method: 'POST',
        headers: {
          origin,
          cookie: 'sb-test-auth-token=COOKIE_MARKER_7f3a',
          authorization: 'Bearer AUTH_MARKER_91c2',
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0',
          ...(init.contentLength ? { 'content-length': String(bytesOf(body)) } : {}),
        },
        body: init.stream ? chunked(body) : body,
        duplex: 'half',
      } as RequestInit);

    screen(marked('https://evil.test'), GUARDED.reflect, reflectEnv); // 403
    screen(marked(SITE, { contentLength: true }), GUARDED.reflect, reflectEnv); // 413, declared
    await readJson(marked(SITE, { stream: true }), GUARDED.reflect, 'user-1', reflectEnv); // 413, counted

    assert.equal(logged.length, 3);
    const output = logged.join('\n');
    for (const marker of MARKERS) assert.ok(!output.includes(marker), marker);
    assert.ok(!output.includes(String(bytesOf(body))), 'the body length');
    assert.ok(!output.includes('calm'), 'the mood');
    for (const line of logged) assert.doesNotThrow(() => JSON.parse(line));
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
