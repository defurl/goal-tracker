// lib/security/securityLog.ts — hardening item 18. One parseable JSON line per
// event, built from four cleaned headers and nothing else the request carried.
// The markers below are fake values made up for this file.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_USER_AGENT_CHARS,
  logSecurityEvent,
  type HeaderSource,
  type SecurityEvent,
} from '../../lib/security/securityLog.ts';

const CATALOGUE: SecurityEvent[] = [
  { event: 'csrf.refused', route: '/api/agent/extract', outcome: 'refused', status: 403, reason: 'origin_mismatch' },
  { event: 'request.unsupported_media_type', route: '/api/agent/reflect', outcome: 'refused', status: 415, reason: 'content_type' },
  { event: 'request.too_large', route: '/api/agent/extract', outcome: 'refused', status: 413, reason: 'body_length', userId: 'u-1' },
  { event: 'ai.quota_exceeded', route: '/api/agent/reflect', outcome: 'refused', status: 429, reason: 'daily_limit', userId: 'u-1' },
  { event: 'cron.unauthorised', route: '/api/cron/seed-challenges', outcome: 'refused', status: 401, reason: 'bad_credentials' },
  { event: 'account.deletion', route: '/api/account', outcome: 'succeeded', status: 204, userId: 'u-1' },
  { event: 'account.deletion', route: '/api/account', outcome: 'failed', status: 503, userId: 'u-1' },
  { event: 'auth.sign_out', route: '/auth/signout', outcome: 'succeeded', status: 303, userId: null },
];

const [REFUSAL] = CATALOGUE as [SecurityEvent, ...SecurityEvent[]];

/** Headers as a stub, so a test can hand over values a real Headers object would refuse to hold. */
function rawHeaders(values: Record<string, string>): HeaderSource {
  return { headers: { get: (name: string) => values[name.toLowerCase()] ?? null } };
}

function linesFor(source: HeaderSource, event: SecurityEvent = REFUSAL): string[] {
  const lines: string[] = [];
  logSecurityEvent(source, event, (line) => lines.push(line));
  return lines;
}

function recordFor(source: HeaderSource, event: SecurityEvent = REFUSAL): Record<string, unknown> {
  const lines = linesFor(source, event);
  assert.equal(lines.length, 1);
  return JSON.parse(lines[0] ?? '') as Record<string, unknown>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('logSecurityEvent() — one line per event', () => {
  for (const event of CATALOGUE) {
    it(`writes exactly one parseable line for ${event.event} (${event.outcome})`, () => {
      const lines = linesFor(rawHeaders({ 'user-agent': 'Mozilla/5.0', 'x-forwarded-for': '203.0.113.7' }), event);
      assert.equal(lines.length, 1);
      const line = lines[0] ?? '';
      assert.ok(!line.includes('\n') && !line.includes('\r'));
      const record = JSON.parse(line) as Record<string, unknown>;
      assert.equal(record.kind, 'security');
      assert.equal(record.event, event.event);
      assert.equal(record.outcome, event.outcome);
      assert.equal(record.status, event.status);
      assert.equal(record.route, event.route);
      assert.equal(record.reason, event.reason ?? null);
      assert.equal(record.user_id, event.userId ?? null);
    });
  }

  it('carries the fields the checklist names: time, event, user, address, browser, request id, route, outcome', () => {
    const record = recordFor(
      rawHeaders({ 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64)', 'x-forwarded-for': '203.0.113.7', 'x-vercel-id': 'iad1::iad1::abcde-1727700000000-0f0f0f0f0f0f' }),
      { event: 'account.deletion', route: '/api/account', outcome: 'succeeded', status: 204, userId: 'u-1' },
    );
    assert.deepEqual(Object.keys(record).sort(), [
      'event', 'ip', 'kind', 'outcome', 'reason', 'request_id', 'route', 'status', 'timestamp', 'user_agent', 'user_id',
    ]);
    assert.match(String(record.timestamp), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(record.ip, '203.0.113.7');
    assert.equal(record.user_agent, 'Mozilla/5.0 (X11; Linux x86_64)');
    assert.equal(record.request_id, 'iad1::iad1::abcde-1727700000000-0f0f0f0f0f0f');
  });
});

describe('the client address', () => {
  it('is the first x-forwarded-for hop', () => {
    assert.equal(recordFor(rawHeaders({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' })).ip, '203.0.113.7');
    assert.equal(recordFor(rawHeaders({ 'x-forwarded-for': '2001:db8::1' })).ip, '2001:db8::1');
  });

  it('falls back to x-real-ip, and is null rather than anything that is not an address', () => {
    assert.equal(recordFor(rawHeaders({ 'x-forwarded-for': 'not-an-ip', 'x-real-ip': '198.51.100.2' })).ip, '198.51.100.2');
    assert.equal(recordFor(rawHeaders({ 'x-forwarded-for': '"><script>' })).ip, null);
    assert.equal(recordFor(rawHeaders({})).ip, null);
  });
});

describe('the request id', () => {
  it('is x-vercel-id when it looks like one, else a fresh UUID per event', () => {
    assert.match(String(recordFor(rawHeaders({})).request_id), UUID);
    assert.match(String(recordFor(rawHeaders({ 'x-vercel-id': 'not an id; drop table' })).request_id), UUID);
    assert.notEqual(recordFor(rawHeaders({})).request_id, recordFor(rawHeaders({})).request_id);
  });
});

describe('client-supplied values are cleaned', () => {
  it('cuts the user agent to its limit', () => {
    const record = recordFor(rawHeaders({ 'user-agent': 'a'.repeat(1000) }));
    assert.equal(String(record.user_agent).length, MAX_USER_AGENT_CHARS);
  });

  it('neutralises a newline injected into the user agent', () => {
    const forged = 'Mozilla/5.0\r\n{"kind":"security","event":"auth.sign_out","outcome":"succeeded"}\n';
    const lines = linesFor(rawHeaders({ 'user-agent': forged }));
    assert.equal(lines.length, 1);
    const line = lines[0] ?? '';
    assert.equal(line.split('\n').length, 1);
    const record = JSON.parse(line) as Record<string, unknown>;
    assert.equal(record.event, 'csrf.refused');
    assert.ok(!/[\r\n]/.test(String(record.user_agent)));
  });

  it('strips control characters, line separators and bidi overrides', () => {
    const record = recordFor(rawHeaders({ 'user-agent': 'A\u0007B\u001bC D E‮F\u0085G\u0000H' }));
    assert.equal(record.user_agent, 'ABCDEFGH');
  });

  it('masks anything shaped like an email address or a token', () => {
    const record = recordFor(
      rawHeaders({ 'user-agent': 'bot/1.0 (+mailto:someone@example.com) Bearer abc.def eyJhbGciOi.eyJzdWIiOi.c2ln' }),
    );
    const ua = String(record.user_agent);
    for (const fragment of ['someone', 'example.com', 'abc.def', 'eyJ']) assert.ok(!ua.includes(fragment), fragment);
  });
});

describe('what a line never holds', () => {
  it('reads no cookie, Authorization header, query string or body', () => {
    const request = new Request('http://bbe.test/api/agent/reflect?token=QUERY_MARKER_55e1', {
      method: 'POST',
      headers: {
        cookie: 'sb-test-auth-token=COOKIE_MARKER_7f3a',
        authorization: 'Bearer AUTH_MARKER_91c2',
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({ entry_text: 'BODY_MARKER_d00d', mood: 'calm', tags: [] }),
    });
    const lines = linesFor(request, { event: 'ai.quota_exceeded', route: '/api/agent/reflect', outcome: 'refused', status: 429, reason: 'daily_limit', userId: 'u-1' });
    const output = lines.join('\n');
    for (const marker of ['QUERY_MARKER', 'COOKIE_MARKER', 'AUTH_MARKER', 'BODY_MARKER']) {
      assert.ok(!output.includes(marker), marker);
    }
    assert.equal(request.bodyUsed, false);
  });

  it('writes no user id unless the route passes one', () => {
    assert.equal(recordFor(rawHeaders({})).user_id, null);
  });
});
