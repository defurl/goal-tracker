// next.config.mjs — what every response is sent with, and what nothing is.
// No server: the config is imported and read the way Next reads it. A live
// deployment adds its own on top (Vercel's HSTS, and its CORS default on
// static files), which only a running server can show.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import type { NextConfig } from 'next';

async function loadConfig(): Promise<NextConfig> {
  // A computed specifier: the config is plain .mjs, outside the type-checked tree.
  const mod = (await import(new URL('../../next.config.mjs', import.meta.url).href)) as { default: NextConfig };
  return mod.default;
}

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
