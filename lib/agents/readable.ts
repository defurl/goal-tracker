// Article HTML → the text the model reads — spec/04-ai-agents.md §2.
//
// Mozilla Readability over linkedom: Readability needs a DOM, and linkedom is
// a fraction of jsdom's size for a job that never runs a script or lays out a
// page. If Readability finds no article, the page's body text stands in.
//
// The 6000-character cap is the cost control 04 §6 calls the real one, and it
// applies to pasted text as much as to fetched articles. Truncated from the
// END: an article's lead carries its actionable content.

import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export const MAX_SOURCE_CHARS = 6000;

export function capSource(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_SOURCE_CHARS);
}

export function readableText(html: string): string {
  const { document } = parseHTML(html);
  let text = '';
  try {
    text = new Readability(document as unknown as Document).parse()?.textContent ?? '';
  } catch {
    text = '';
  }
  if (!text.trim()) text = document.body?.textContent ?? '';
  return capSource(text);
}
