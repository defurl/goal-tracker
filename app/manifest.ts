// The PWA manifest (B2.9). The installed app opens on /text — the moment
// surface and the offline shell (D-07) — with the room one link away.
//
// Colours come from the palette constants, not literals (lint:colors), and the
// app is nocturnal-only (D-03), so there is one background for every context.

import type { MetadataRoute } from 'next';

import { BG_VOID } from '../lib/style/colors';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Be Better Everyday',
    short_name: 'Be Better',
    description: 'Turn what you save into two-minute actions, and watch the room keep the record.',
    start_url: '/text',
    scope: '/',
    display: 'standalone',
    background_color: BG_VOID,
    theme_color: BG_VOID,
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
