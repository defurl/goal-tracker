// Shared by the agent tests: the real OpenAIProvider with its network blocked,
// a scripted stand-in that records what it was sent, and a provider that fails
// the test if it is called at all. Nothing here reaches OpenAI.

import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { OpenAIProvider } from '../../lib/agents/openai.ts';
import type { AgentProvider, CompletionRequest } from '../../lib/agents/provider.ts';
import type { Database } from '../../lib/supabase/database.types.ts';
import { admin, url, type TestUser } from './harness.ts';

type Db = SupabaseClient<Database>;
export const service = admin as unknown as Db;

/** A deploy with a missing or wrong SUPABASE_SERVICE_ROLE_KEY: every service call fails. */
export const brokenService = createClient(url, 'not-a-service-key', {
  auth: { persistSession: false, autoRefreshToken: false },
}) as unknown as Db;

/** The real provider, with every request failing the way a blocked network fails. */
export const networkBlocked = new OpenAIProvider({
  apiKey: 'test-key',
  fetch: async () => {
    throw new TypeError('fetch failed: connect ENETUNREACH');
  },
});

/** Answers with `content` and remembers what it was sent. */
export function scripted(content: string): AgentProvider & { requests: CompletionRequest[] } {
  const requests: CompletionRequest[] = [];
  return {
    requests,
    async complete(request) {
      requests.push(request);
      return { content, inputTokens: 321, outputTokens: 45 };
    },
  };
}

export const neverCalled: AgentProvider = {
  complete: async () => assert.fail('the provider must not be called'),
};

export function deps(u: TestUser, provider: AgentProvider) {
  return { provider, db: u.client as unknown as Db, service, userId: u.id };
}

export async function lastLog(userId: string, agentId: string) {
  const { data } = await admin
    .from('agent_logs').select()
    .eq('user_id', userId).eq('agent_id', agentId)
    .order('created_at', { ascending: false });
  return { latest: data?.[0], count: data?.length ?? 0 };
}
