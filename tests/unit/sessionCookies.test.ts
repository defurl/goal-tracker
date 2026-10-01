// lib/supabase/cookies.ts — the flags on every cookie the app sets (security
// item 19). The last group drives the real @supabase/ssr clients against an
// injected fetch: no network, no database, and every credential is a
// placeholder made up for the run.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import {
  createBrowserClient,
  createChunks,
  createServerClient,
  stringFromBase64URL,
  stringToBase64URL,
  type CookieOptions,
} from '@supabase/ssr';

import {
  FLOW_MAX_AGE_SECONDS,
  ROOM_MAX_AGE_SECONDS,
  SESSION_IDLE_DAYS_DEFAULT,
  SESSION_IDLE_SECONDS,
  isHttps,
  roomCookieOptions,
  sessionCookieOptions,
  sessionCookieWrites,
  sessionIdleDays,
  type CookieWrite,
} from '../../lib/supabase/cookies.ts';

const DAY = 24 * 60 * 60;
const IDLE = 7 * DAY;
const KEY = 'sb-127-auth-token';
const LIBRARY_DEFAULT = { path: '/', sameSite: 'lax' as const, httpOnly: false, maxAge: 400 * DAY };

const policy = (secure: boolean) => ({ path: '/', sameSite: 'lax', secure, httpOnly: false, maxAge: IDLE });

describe('sessionIdleDays() — NEXT_PUBLIC_SESSION_IDLE_DAYS', () => {
  it('defaults to 30 days when unset or blank', () => {
    assert.equal(SESSION_IDLE_DAYS_DEFAULT, 30);
    for (const raw of [undefined, '', '   ']) assert.equal(sessionIdleDays(raw), 30);
  });

  it('takes a whole number of days from 1 to 400', () => {
    assert.equal(sessionIdleDays('1'), 1);
    assert.equal(sessionIdleDays('7'), 7);
    assert.equal(sessionIdleDays(' 14 '), 14);
    assert.equal(sessionIdleDays('400'), 400);
  });

  it('falls back to the default on anything else', () => {
    for (const raw of ['0', '401', '1.5', '-3', '30d', '1e2', '0x1e', 'thirty']) {
      assert.equal(sessionIdleDays(raw), 30, raw);
    }
  });

  it('sets the window in seconds', { skip: process.env.NEXT_PUBLIC_SESSION_IDLE_DAYS !== undefined }, () => {
    assert.equal(SESSION_IDLE_SECONDS, 30 * DAY);
  });
});

describe('isHttps()', () => {
  it('trusts the first X-Forwarded-Proto hop', () => {
    assert.ok(isHttps({ forwardedProto: 'https' }));
    assert.ok(isHttps({ forwardedProto: 'HTTPS' }));
    assert.ok(isHttps({ forwardedProto: 'https, http' }));
    assert.ok(!isHttps({ forwardedProto: 'http, https' }));
  });

  it('trusts the URL when it says https', () => {
    assert.ok(isHttps({ protocol: 'https:' }));
    assert.ok(isHttps({ forwardedProto: 'http', protocol: 'https:' }));
  });

  it('is false for plain http — next start, CI, the review captures', () => {
    assert.ok(!isHttps({ forwardedProto: 'http', protocol: 'http:' }));
    assert.ok(!isHttps({ protocol: 'http:' }));
    assert.ok(!isHttps({ forwardedProto: null, protocol: null }));
    assert.ok(!isHttps({}));
  });
});

describe('sessionCookieOptions()', () => {
  const chunk: CookieWrite = { name: `${KEY}.0`, value: 'base64-abc', options: LIBRARY_DEFAULT };

  it('replaces the library default with Secure and the idle window', () => {
    assert.deepEqual(sessionCookieOptions(chunk, { secure: true, idleSeconds: IDLE }), policy(true));
  });

  it('leaves Secure off on plain http, where the browser would refuse it', () => {
    assert.deepEqual(sessionCookieOptions(chunk, { secure: false, idleSeconds: IDLE }), policy(false));
  });

  it('defaults to SESSION_IDLE_SECONDS', () => {
    assert.equal(sessionCookieOptions(chunk, { secure: true }).maxAge, SESSION_IDLE_SECONDS);
  });

  it('keeps a deletion a deletion', () => {
    const removal = { name: `${KEY}.1`, value: '', options: { ...LIBRARY_DEFAULT, maxAge: 0 } };
    assert.deepEqual(sessionCookieOptions(removal, { secure: true, idleSeconds: IDLE }), { ...policy(true), maxAge: 0 });
  });

  it('gives the three PKCE verifier cookies an hour', () => {
    for (const name of [`${KEY}-code-verifier`, `${KEY}-flow-0123456789abcdef-code-verifier`, `${KEY}-flows-code-verifier`]) {
      const write = { name, value: 'base64-xyz', options: LIBRARY_DEFAULT };
      assert.deepEqual(sessionCookieOptions(write, { secure: true, idleSeconds: IDLE }), {
        ...policy(true),
        maxAge: FLOW_MAX_AGE_SECONDS,
      }, name);
    }
    assert.equal(FLOW_MAX_AGE_SECONDS, 3600);
  });

  it('builds the flags fresh, whatever it is handed', () => {
    const loose = { ...chunk, options: { domain: 'example.com', path: '/x', sameSite: 'none' as const, httpOnly: true } };
    assert.deepEqual(sessionCookieOptions(loose, { secure: true, idleSeconds: IDLE }), policy(true));
  });
});

describe('sessionCookieWrites()', () => {
  const write = (name: string, value: string, maxAge = LIBRARY_DEFAULT.maxAge): CookieWrite => ({
    name,
    value,
    options: { ...LIBRARY_DEFAULT, maxAge },
  });

  it('re-arms the unchanged chunk of a session it rewrites', () => {
    const out = sessionCookieWrites(
      [write(`${KEY}.0`, 'new-head')],
      [{ name: `${KEY}.0`, value: 'old-head' }, { name: `${KEY}.1`, value: 'same-tail' }],
      { secure: true, idleSeconds: IDLE },
    );
    assert.deepEqual(out, [
      { name: `${KEY}.0`, value: 'new-head', options: policy(true) },
      { name: `${KEY}.1`, value: 'same-tail', options: policy(true) },
    ]);
  });

  it('still deletes the old chunks when the session shrinks to one cookie', () => {
    const out = sessionCookieWrites(
      [write(KEY, 'whole'), write(`${KEY}.0`, '', 0), write(`${KEY}.1`, '', 0)],
      [{ name: `${KEY}.0`, value: 'a' }, { name: `${KEY}.1`, value: 'b' }],
      { secure: false, idleSeconds: IDLE },
    );
    assert.deepEqual(out.map((c) => [c.name, c.options.maxAge]), [
      [KEY, IDLE],
      [`${KEY}.0`, 0],
      [`${KEY}.1`, 0],
    ]);
  });

  it('touches nothing that belongs to another key', () => {
    const out = sessionCookieWrites(
      [write(`${KEY}.0`, 'new-head')],
      [
        { name: 'bbe_room', value: '1' },
        { name: `${KEY}-code-verifier`, value: 'v' },
        { name: 'sb-other-auth-token.1', value: 'theirs' },
        { name: `${KEY}.1`, value: '' },
      ],
      { secure: true, idleSeconds: IDLE },
    );
    assert.deepEqual(out.map((c) => c.name), [`${KEY}.0`]);
  });

  it('re-arms nothing on a sign-out', () => {
    const out = sessionCookieWrites(
      [write(`${KEY}.0`, '', 0)],
      [{ name: `${KEY}.0`, value: 'a' }, { name: `${KEY}.1`, value: 'b' }],
      { secure: true, idleSeconds: IDLE },
    );
    assert.deepEqual(out, [{ name: `${KEY}.0`, value: '', options: { ...policy(true), maxAge: 0 } }]);
  });
});

describe('roomCookieOptions() — bbe_room', () => {
  it('is HttpOnly, Lax, site-wide and kept for a year', () => {
    assert.deepEqual(roomCookieOptions(true), {
      path: '/',
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
      maxAge: ROOM_MAX_AGE_SECONDS,
    });
    assert.equal(ROOM_MAX_AGE_SECONDS, 365 * DAY);
  });

  it('is Secure only over https', () => {
    assert.equal(roomCookieOptions(false).secure, false);
  });
});

// --- Against @supabase/ssr itself -------------------------------------------

const SUPABASE_URL = 'http://127.0.0.1:54321'; // never contacted: fetch is injected
const ANON_KEY = 'placeholder-anon-key';
const now = () => Math.floor(Date.now() / 1000);

// Big enough that the session spans two cookies, as it does in production.
const USER = {
  id: '00000000-0000-4000-8000-000000000000',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: { note: 'n'.repeat(3000) },
};

/** Same field lengths for every generation, as real token pairs have. */
function session(generation: string, expiresAt: number) {
  return {
    access_token: `access-${generation}`.padEnd(400, generation),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: expiresAt,
    refresh_token: `refresh-${generation}`.padEnd(24, generation),
    user: USER,
  };
}

function fakeAuth(routes: Record<string, () => unknown>) {
  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const handler = routes[`${init?.method ?? 'GET'} ${url.pathname}${url.search}`];
    if (!handler) return Response.json({ code: 'unexpected_failure', msg: 'no fake route' }, { status: 404 });
    const body = handler();
    return body === null ? new Response(null, { status: 204 }) : Response.json(body);
  };
  return fetch as typeof globalThis.fetch;
}

type Jar = Map<string, { value: string; options: CookieOptions }>;

function jarOf(value: object): Jar {
  const encoded = `base64-${stringToBase64URL(JSON.stringify(value))}`;
  return new Map(createChunks(KEY, encoded).map(({ name, value: v }) => [name, { value: v, options: {} }]));
}

const cookiesIn = (jar: Jar) => [...jar].map(([name, { value }]) => ({ name, value }));

function write(jar: Jar, writes: CookieWrite[]) {
  for (const { name, value, options } of writes) {
    if (options.maxAge === 0) jar.delete(name);
    else jar.set(name, { value, options });
  }
}

function sessionIn(jar: Jar): unknown {
  let encoded = '';
  for (let i = 0; jar.has(`${KEY}.${i}`); i++) encoded += jar.get(`${KEY}.${i}`)?.value;
  return JSON.parse(stringFromBase64URL(encoded.slice('base64-'.length)));
}

/** A server client wired the way middleware.ts and server.ts wire theirs. */
function serverClient(jar: Jar, fetch: typeof globalThis.fetch, seen: { batches: CookieWrite[][]; writes: CookieWrite[] }) {
  return createServerClient(SUPABASE_URL, ANON_KEY, {
    global: { fetch },
    cookies: {
      getAll: () => cookiesIn(jar),
      setAll: (batch) => {
        seen.batches.push(batch);
        const writes = sessionCookieWrites(batch, cookiesIn(jar), { secure: true });
        seen.writes.push(...writes);
        write(jar, writes);
      },
    },
  });
}

describe('with @supabase/ssr 0.12.7', () => {
  it('re-arms every chunk when middleware refreshes the session', async () => {
    const before = session('a', now() - 60);
    const after = session('b', now() + 3600);
    const jar = jarOf(before);
    assert.deepEqual([...jar.keys()], [`${KEY}.0`, `${KEY}.1`]);

    const seen = { batches: [] as CookieWrite[][], writes: [] as CookieWrite[] };
    const supabase = serverClient(jar, fakeAuth({
      'POST /auth/v1/token?grant_type=refresh_token': () => after,
      'GET /auth/v1/user': () => USER,
    }), seen);
    const { data } = await supabase.auth.getUser();
    assert.equal(data.user?.id, USER.id);

    // Why the policy exists: the library forces 400 days, and on the server it
    // skips the tail chunk because its value did not change.
    assert.equal(seen.batches.length, 1);
    assert.deepEqual(seen.batches[0]?.map((c) => [c.name, c.options.maxAge]), [[`${KEY}.0`, 400 * DAY]]);

    assert.deepEqual(seen.writes.map((c) => c.name), [`${KEY}.0`, `${KEY}.1`]);
    for (const { options } of seen.writes) {
      assert.deepEqual(options, { path: '/', sameSite: 'lax', secure: true, httpOnly: false, maxAge: SESSION_IDLE_SECONDS });
    }
    assert.deepEqual(sessionIn(jar), after);
  });

  it('deletes every chunk on sign-out', async () => {
    const jar = jarOf(session('a', now() + 3600));
    const seen = { batches: [] as CookieWrite[][], writes: [] as CookieWrite[] };
    const supabase = serverClient(jar, fakeAuth({ 'POST /auth/v1/logout?scope=global': () => null }), seen);
    const { error } = await supabase.auth.signOut();
    assert.equal(error, null);
    assert.equal(jar.size, 0);
    for (const { options } of seen.writes) assert.equal(options.maxAge, 0);
  });

  it('writes every chunk with the idle window when the browser signs in', async () => {
    const jar: Jar = new Map();
    const writes: CookieWrite[] = [];
    const supabase = createBrowserClient(SUPABASE_URL, ANON_KEY, {
      global: { fetch: fakeAuth({ 'POST /auth/v1/token?grant_type=password': () => session('c', now() + 3600) }) },
      cookies: {
        getAll: () => cookiesIn(jar),
        setAll: (batch) => {
          const out = sessionCookieWrites(batch, cookiesIn(jar), { secure: true });
          writes.push(...out);
          write(jar, out);
        },
      },
    });
    const { error } = await supabase.auth.signInWithPassword({ email: `${randomUUID()}@example.invalid`, password: randomUUID() });
    assert.equal(error, null);
    assert.deepEqual(writes.map((c) => [c.name, c.options.maxAge, c.options.secure]), [
      [`${KEY}.0`, SESSION_IDLE_SECONDS, true],
      [`${KEY}.1`, SESSION_IDLE_SECONDS, true],
    ]);
  });
});
