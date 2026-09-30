// Does a reflection quote the entry it was written about? (D-23 §16, FR-3.6)
//
// The four ai_* fields are the only journal text the database ever holds. If
// the model lifts a phrase from the entry into one of them, a fragment of the
// entry is stored after all, and FR-3.6's promise is broken by the model rather
// than by the code. The prompt asks it not to; this is what enforces it.
//
// A run of QUOTE_RUN_WORDS consecutive words, compared case- and punctuation-
// blind, counts as a quote. Five is long enough that ordinary phrasing ("you
// took time to", "a short walk after") rarely trips it by chance, and short
// enough to catch a lifted clause. Each field is checked on its own, so a run
// cannot be assembled across two of them.

import type { JournalReflection } from '../prompts/journalAnalysis.ts';

export const QUOTE_RUN_WORDS = 5;

function words(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];
}

function runs(list: string[], length: number): Set<string> {
  const found = new Set<string>();
  for (let i = 0; i + length <= list.length; i++) found.add(list.slice(i, i + length).join(' '));
  return found;
}

/** True when `text` shares a run of `length` consecutive words with `entry`. */
export function sharesRun(entry: string, text: string, length = QUOTE_RUN_WORDS): boolean {
  const source = runs(words(entry), length);
  if (source.size === 0) return false;
  for (const run of runs(words(text), length)) if (source.has(run)) return true;
  return false;
}

/** True when any stored field of the reflection quotes the entry. */
export function quotesEntry(entry: string, reflection: JournalReflection): boolean {
  return [reflection.summary, reflection.strength, reflection.next_action, reflection.primary_emotion].some((field) =>
    sharesRun(entry, field),
  );
}
