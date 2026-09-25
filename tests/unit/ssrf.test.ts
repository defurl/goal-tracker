// lib/agents/ssrf.ts and lib/agents/fetchPage.ts — spec/04-ai-agents.md §2.
//
// The fetch tests run a real local server. The production guard refuses it —
// it is on 127.0.0.1 — so each test grants exactly that one address and port
// and then watches every OTHER refusal still happen: a redirect to a private
// address, a name resolving to one, a non-HTML body, a slow origin.

import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { fetchPage, PageFetchError, type FetchPageOptions } from '../../lib/agents/fetchPage.ts';
import { isPublicAddress } from '../../lib/agents/ssrf.ts';

describe('isPublicAddress()', () => {
  const refused = [
    '127.0.0.1', '127.8.8.8', '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1',
    '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '255.255.255.255', '198.18.0.1',
    '::', '::1', 'fe80::1', 'fc00::1', 'fd12:3456::1', 'ff02::1', '2001:db8::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1', '64:ff9b::a00:1', '2002:c0a8:0101::1',
    'not-an-ip', '', '999.1.1.1',
  ];
  const allowed = ['8.8.8.8', '1.1.1.1', '172.32.0.1', '93.184.216.34', '2606:4700::1111', '::ffff:8.8.8.8'];

  for (const ip of refused) it(`refuses ${ip || '(empty)'}`, () => assert.equal(isPublicAddress(ip), false));
  for (const ip of allowed) it(`allows ${ip}`, () => assert.equal(isPublicAddress(ip), true));
});

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    assert.ok(error instanceof PageFetchError, `not a PageFetchError: ${String(error)}`);
    return error.code;
  }
}

describe('fetchPage() — refusals with the production guard', () => {
  const cases: [string, string][] = [
    ['http://127.0.0.1/', 'BLOCKED'],
    ['http://[::1]/', 'BLOCKED'],
    ['http://169.254.169.254/latest/meta-data/', 'BLOCKED'],
    ['http://10.0.0.1/', 'BLOCKED'],
    ['http://localhost/', 'BLOCKED'],
    ['http://app.localhost/', 'BLOCKED'],
    ['http://example.com:8080/', 'BLOCKED'],
    ['http://user:pass@example.com/', 'INVALID_URL'],
    ['ftp://example.com/', 'INVALID_URL'],
    ['file:///etc/passwd', 'INVALID_URL'],
    ['not a url', 'INVALID_URL'],
  ];
  for (const [url, expected] of cases) {
    it(`${url} → ${expected}`, async () => assert.equal(await code(fetchPage(url)), expected));
  }
});

describe('fetchPage() — against a local server', () => {
  let server: Server;
  let port = '';
  let base = '';

  before(async () => {
    server = createServer((req, res) => {
      switch (req.url) {
        case '/article':
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
          res.end('<html><body><p>Write one sentence.</p></body></html>');
          break;
        case '/pdf':
          res.writeHead(200, { 'content-type': 'application/pdf' });
          res.end('%PDF-1.4');
          break;
        case '/to-private':
          res.writeHead(302, { location: 'http://10.0.0.1/' });
          res.end();
          break;
        case '/to-private-name':
          res.writeHead(302, { location: `http://inner.test:${port}/article` });
          res.end();
          break;
        case '/to-article':
          res.writeHead(301, { location: '/article' });
          res.end();
          break;
        case '/loop':
          res.writeHead(302, { location: '/loop' });
          res.end();
          break;
        case '/slow':
          // Never answers; the fetch's own timeout must end it.
          break;
        default:
          res.writeHead(404);
          res.end();
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = String((server.address() as AddressInfo).port);
    base = `http://site.test:${port}`;
  });

  after(() => {
    server.closeAllConnections();
    server.close();
  });

  /** Grants 127.0.0.1 on this port and nothing else; names resolve from a fixed table. */
  function local(extra: FetchPageOptions = {}): FetchPageOptions {
    const table: Record<string, string[]> = {
      'site.test': ['127.0.0.1'],
      'inner.test': ['192.168.1.10'],
      'mixed.test': ['127.0.0.1', '10.0.0.1'],
    };
    return {
      isAllowedAddress: (ip) => ip === '127.0.0.1',
      allowedPorts: [port],
      resolve: (host, callback) => {
        const ips = table[host];
        if (!ips) callback(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }), []);
        else callback(null, ips.map((address) => ({ address, family: 4 })));
      },
      ...extra,
    };
  }

  it('fetches an HTML page', async () => {
    const page = await fetchPage(`${base}/article`, local());
    assert.match(page.html, /Write one sentence/);
  });

  it('follows a same-site redirect', async () => {
    const page = await fetchPage(`${base}/to-article`, local());
    assert.equal(page.finalUrl, `${base}/article`);
  });

  it('refuses a redirect to a private address', async () => {
    assert.equal(await code(fetchPage(`${base}/to-private`, local())), 'BLOCKED');
  });

  it('refuses a redirect to a name that resolves privately', async () => {
    assert.equal(await code(fetchPage(`${base}/to-private-name`, local())), 'BLOCKED');
  });

  it('refuses a name with any private address among its records', async () => {
    assert.equal(await code(fetchPage(`http://mixed.test:${port}/article`, local())), 'BLOCKED');
  });

  it('stops after three redirects', async () => {
    assert.equal(await code(fetchPage(`${base}/loop`, local())), 'HTTP_ERROR');
  });

  it('refuses non-HTML content', async () => {
    assert.equal(await code(fetchPage(`${base}/pdf`, local())), 'NOT_HTML');
  });

  it('times out a slow origin', async () => {
    const started = Date.now();
    assert.equal(await code(fetchPage(`${base}/slow`, local({ timeoutMs: 300 }))), 'TIMEOUT');
    assert.ok(Date.now() - started < 3000);
  });

  it('reports an unresolvable name as a network failure', async () => {
    assert.equal(await code(fetchPage(`http://nowhere.test:${port}/`, local())), 'NETWORK');
  });
});
