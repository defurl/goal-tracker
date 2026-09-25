// content_extraction_agent against the local stack — half of the Phase 2
// track B gate: a usable result with the provider network-blocked (FALLBACK-1).
// Plus RATE-1's 429 and LOG-1's row, which records a code and never the text.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { extractAction } from '../../lib/agents/extract.ts';
import { FALLBACK_SOURCE_SUMMARY } from '../../lib/prompts/fallbacks.ts';
import { deps, lastLog, networkBlocked, neverCalled, scripted } from './agentHarness.ts';
import { admin, createUser, deleteUsers } from './harness.ts';

after(deleteUsers);

describe('extraction agent', () => {
  it('returns a usable action with the provider network-blocked (FALLBACK-1)', async () => {
    const u = await createUser('extract-blocked');
    const result = await extractAction(deps(u, networkBlocked), { text: 'An article about morning routines.' });

    assert.equal(result.status, 200);
    if (result.status !== 200) return;
    assert.equal(result.body.fallback, true);
    assert.ok(result.body.action.actionText.length > 0);

    const { data } = await admin.from('user_actions').select().eq('user_id', u.id).single();
    assert.equal(data?.source_summary, FALLBACK_SOURCE_SUMMARY);

    const log = await lastLog(u.id, 'content_extraction_agent');
    assert.equal(log.latest?.success, false);
    assert.equal(log.latest?.error_code, 'PROVIDER_ERROR');

    // The first import also puts something on the monitor (019).
    const challenge = await admin.from('daily_challenges').select('action_id').eq('user_id', u.id).single();
    assert.equal(challenge.data?.action_id, data?.id);
  });

  it('stores the model’s action and logs tokens, not text', async () => {
    const u = await createUser('extract-ok');
    const p = scripted(JSON.stringify({ action: 'Write tomorrow’s first task on a card.', source_summary: 'On starting.' }));
    const result = await extractAction(deps(u, p), { text: 'PASTED-ARTICLE-BODY' });

    assert.equal(result.status, 200);
    if (result.status === 200) assert.equal(result.body.fallback, false);
    assert.equal(p.requests[0]?.user, 'PASTED-ARTICLE-BODY');

    const log = await lastLog(u.id, 'content_extraction_agent');
    assert.deepEqual(
      { success: log.latest?.success, error_code: log.latest?.error_code, input_tokens: log.latest?.input_tokens },
      { success: true, error_code: null, input_tokens: 321 },
    );
    assert.ok(!JSON.stringify(log.latest).includes('PASTED-ARTICLE-BODY'));
  });

  it('an unreadable URL never reaches the model and still yields an action', async () => {
    const u = await createUser('extract-ssrf');
    const result = await extractAction(deps(u, neverCalled), { url: 'http://169.254.169.254/latest/meta-data/' });
    assert.equal(result.status, 200);
    if (result.status === 200) {
      assert.equal(result.body.sourceUnreadable, true);
      assert.equal(result.body.fallback, true);
    }
    assert.equal((await lastLog(u.id, 'content_extraction_agent')).latest?.error_code, 'SOURCE_UNREADABLE');
  });

  it('the 21st extraction of the day is a 429 with Retry-After, and no provider call', async () => {
    const u = await createUser('extract-limit');
    const today = new Date().toISOString().slice(0, 10);
    await admin.from('rate_limits').insert({ user_id: u.id, agent_id: 'content_extraction_agent', date: today, count: 20 });

    const result = await extractAction(deps(u, neverCalled), { text: 'one more' });
    assert.equal(result.status, 429);
    if (result.status === 429) assert.ok(result.retryAfter > 0 && result.retryAfter <= 86400);
    const { data } = await admin.from('user_actions').select('id').eq('user_id', u.id);
    assert.equal(data?.length, 0);
  });

  it('refuses malformed input without calling the provider', async () => {
    const u = await createUser('extract-400');
    for (const body of [undefined, {}, { url: 'x', text: 'y' }, { text: '' }]) {
      assert.equal((await extractAction(deps(u, neverCalled), body)).status, 400);
    }
  });
});
