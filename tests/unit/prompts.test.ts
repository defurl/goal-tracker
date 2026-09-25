// lib/prompts/ — B2.1: the versioned templates, their schemas and the curated
// fallbacks (spec/04-ai-agents.md §2, §3, §7).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { withinWordLimit } from '../../lib/prompts/contentExtraction.ts';
import { CURATED_FALLBACK_ACTIONS, GENTLE_REFLECTION, pickFallbackAction } from '../../lib/prompts/fallbacks.ts';
import { JOURNAL_ANALYSIS_V1 } from '../../lib/prompts/journalAnalysis.ts';

describe('CURATED_FALLBACK_ACTIONS — spec/04 §2', () => {
  it('holds at least 20, all different', () => {
    assert.ok(CURATED_FALLBACK_ACTIONS.length >= 20);
    assert.equal(new Set(CURATED_FALLBACK_ACTIONS).size, CURATED_FALLBACK_ACTIONS.length);
  });

  it('each obeys the extraction rules: ≤ 40 words, a capitalised imperative first, fits the column', () => {
    for (const action of CURATED_FALLBACK_ACTIONS) {
      assert.ok(withinWordLimit({ action, source_summary: 'x' }), action);
      assert.match(action, /^[A-Z][a-z]+ /, action);
      assert.ok(action.length <= 300, action);
    }
  });

  it('never repeats one until every one has been given', () => {
    const given: string[] = [];
    for (let i = 0; i < CURATED_FALLBACK_ACTIONS.length; i++) given.push(pickFallbackAction(given));
    assert.equal(new Set(given).size, CURATED_FALLBACK_ACTIONS.length);
    assert.ok(CURATED_FALLBACK_ACTIONS.includes(pickFallbackAction(given)));
  });
});

describe('GENTLE_REFLECTION — the 429 and failure case', () => {
  it('is a valid reflection that names no emotion and asks for no support flag', () => {
    const parsed = JOURNAL_ANALYSIS_V1.schema.parse(GENTLE_REFLECTION);
    assert.equal(parsed.primary_emotion, '');
    assert.equal(parsed.support_response, false);
  });
});

describe('JOURNAL_ANALYSIS_V1.schema', () => {
  it('defaults support_response to false', () => {
    const parsed = JOURNAL_ANALYSIS_V1.schema.parse({
      primary_emotion: 'calm', strength: 's', next_action: 'n', summary: 'x',
    });
    assert.equal(parsed.support_response, false);
  });
});
