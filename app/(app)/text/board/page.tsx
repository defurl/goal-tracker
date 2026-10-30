// /text/board — Phase 7 P0's board test (spec/06-build-plan.md Phase 7, D-26 §4).
//
// The redesign's board shell and its first card, on the v2 tokens and Inter
// (design-system/v2/01-04), over a blurred still of the room. It reads the same
// store and writes through the same functions as /text's challenge section, so
// it tests the look and the keyboard path, not new logic. Linked from nowhere.
//
// Like /text, this route must never import three.js (D-10).

import type { Metadata } from 'next';

import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';

import { BoardTest } from './BoardTest';

export const metadata: Metadata = {
  title: 'Be Better Everyday — board test',
  robots: { index: false, follow: false },
};

export default function BoardTestPage() {
  return <BoardTest />;
}
