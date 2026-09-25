// /text — the mobile fast path, the offline shell and the accessibility surface.
// NOT a fallback (D-07). It reaches 100% of the product's functionality, and
// every feature ships here in the same phase it ships to the room.
//
// This route must never transitively import three.js. CI asserts it
// (scripts/bundle-check.ts, D-10) because a careless shared type import breaks it.

import type { Metadata } from 'next';

import { TextSurface } from './TextSurface';

export const metadata: Metadata = {
  title: 'Be Better Everyday — text',
};

export default function TextPage() {
  return <TextSurface />;
}
