// What the API surface tells someone who only has the anon key — which is
// everyone: it ships in the browser bundle. 026 and 027, pre-launch hardening.
//
//   /rest/v1/     PostgREST's OpenAPI root lists what the caller's role may
//                 use. Before 026 it gave the anon key every table, column and
//                 verb in public. Now it gives it nothing.
//   /graphql/v1   pg_graphql is not installed (027). The endpoint answers with
//                 Supabase's placeholder error, to anyone.
//
// A signed-in user is shown what they may read and call — and never
// rate_limits, nor a function that only the server may run.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { anonKey, catalog, createUser, deleteUsers, url } from './harness.ts';

after(deleteUsers);

interface OpenApi {
  paths?: Record<string, unknown>;
  definitions?: Record<string, unknown>;
}

async function openapi(token: string): Promise<OpenApi> {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  assert.equal(response.status, 200);
  return (await response.json()) as OpenApi;
}

async function graphql(token: string): Promise<{ data?: unknown; errors?: { message: string }[] }> {
  const response = await fetch(`${url}/graphql/v1`, {
    method: 'POST',
    headers: { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ __schema { types { name } } }' }),
  });
  return (await response.json()) as { data?: unknown; errors?: { message: string }[] };
}

async function accessToken(label: string): Promise<string> {
  const u = await createUser(label);
  const { data } = await u.client.auth.getSession();
  assert.ok(data.session, `${label} has no session`);
  return data.session.access_token;
}

describe('the OpenAPI root — 026', () => {
  it('shows the anon key no table, no column and no function', async () => {
    const doc = await openapi(anonKey);
    assert.deepEqual(Object.keys(doc.paths ?? {}), ['/']);
    assert.deepEqual(Object.keys(doc.definitions ?? {}), []);
  });

  it('shows a signed-in user neither rate_limits nor a server-only function', async () => {
    const paths = Object.keys((await openapi(await accessToken('openapi'))).paths ?? {});
    assert.ok(paths.includes('/habits'), 'the control: a signed-in user is shown their own tables');
    for (const hidden of [
      '/rate_limits', '/rpc/award_points', '/rpc/consume_rate_limit', '/rpc/seed_daily_challenge',
      '/rpc/run_challenge_sweep', '/rpc/local_today', '/rpc/habit_due_on',
    ]) {
      assert.ok(!paths.includes(hidden), `${hidden} is advertised to a signed-in user`);
    }
  });
});

describe('the GraphQL endpoint — 027', () => {
  it('pg_graphql is not installed', () => {
    const { installed } = catalog<{ installed: boolean }>(
      `select json_build_object('installed', exists (select 1 from pg_extension where extname = 'pg_graphql'));`,
    );
    assert.equal(installed, false);
  });

  it('answers no schema to the anon key or to a signed-in user', async () => {
    for (const [who, token] of [['anon', anonKey], ['a signed-in user', await accessToken('graphql')]] as const) {
      const body = await graphql(token);
      assert.equal(body.data, undefined, `${who} was answered with data`);
      assert.match(body.errors?.[0]?.message ?? '', /pg_graphql extension is not enabled/, who);
    }
  });
});
