// next.config.mjs — what every response is sent with, and what nothing is.
// No server: the config is imported and read the way Next reads it. A live
// deployment adds its own on top (Vercel's HSTS, and its CORS default on
// static files), which only a running server can show.
//
// Each rule's source is compiled by Next's own route builder, giving the regex
// `next start` matches and Vercel's build turns into its header routes. That
// builder is a next/dist internal: next is pinned to 14 (D-06), and an upgrade
// that moves it fails here rather than letting a rule silently stop matching.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { NextConfig } from 'next';
import { buildCustomRoute } from 'next/dist/lib/build-custom-route.js';

async function loadConfig(): Promise<NextConfig> {
  // A computed specifier: the config is plain .mjs, outside the type-checked tree.
  const mod = (await import(new URL('../../next.config.mjs', import.meta.url).href)) as { default: NextConfig };
  return mod.default;
}

/** The headers next.config gives a request for `path`, keys lower-cased. A later rule wins, as in Next. */
async function headersFor(path: string): Promise<Map<string, string>> {
  const rules = (await (await loadConfig()).headers?.()) ?? [];
  const out = new Map<string, string>();
  for (const rule of rules) {
    if (!new RegExp(buildCustomRoute('header', rule).regex).test(path)) continue;
    for (const { key, value } of rule.headers) out.set(key.toLowerCase(), value);
  }
  return out;
}

/** One of every kind of response the app serves. */
const PATHS = [
  '/',
  '/text',
  '/login',
  '/privacy',
  '/no-such-page',
  '/api/agent/reflect',
  '/api/account',
  '/auth/callback',
  '/manifest.webmanifest',
  '/sw.js',
  '/fonts/DepartureMono-Regular.woff2',
  '/_next/static/chunks/main-app.js',
];

describe('next.config — headers on every response', () => {
  for (const path of PATHS) {
    it(`${path}: nosniff`, async () => {
      assert.equal((await headersFor(path)).get('x-content-type-options'), 'nosniff');
    });

    it(`${path}: only the origin leaves for another site`, async () => {
      assert.equal((await headersFor(path)).get('referrer-policy'), 'strict-origin-when-cross-origin');
    });

    it(`${path}: no site may frame it`, async () => {
      const h = await headersFor(path);
      assert.equal(h.get('x-frame-options'), 'DENY');
      // frame-ancestors alone: a fuller policy needs its own report-only trial.
      assert.equal(h.get('content-security-policy'), "frame-ancestors 'none'");
    });

    it(`${path}: unused device features are refused`, async () => {
      const policy = new Map(
        ((await headersFor(path)).get('permissions-policy') ?? '')
          .split(',')
          .map((d) => d.trim().split('=') as [string, string]),
      );
      for (const feature of ['camera', 'microphone', 'geolocation', 'payment', 'usb']) {
        assert.equal(policy.get(feature), '()', `${feature} is not refused`);
      }
    });
  }
});

describe('next.config — surfaces that stay off', () => {
  it('turns the image optimizer off, so /_next/image is a 404', async () => {
    assert.equal((await loadConfig()).images?.unoptimized, true);
  });

  it('sends no X-Powered-By', async () => {
    assert.equal((await loadConfig()).poweredByHeader, false);
  });

  it('ships no browser source maps', async () => {
    assert.notEqual((await loadConfig()).productionBrowserSourceMaps, true);
  });
});
