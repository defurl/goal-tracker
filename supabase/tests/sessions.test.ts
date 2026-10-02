// A password change locks out every other session — pre-launch hardening,
// item 3. Sessions belong to Supabase Auth (GoTrue), not to this codebase, so
// this pins what it actually does rather than what we would build:
//
//   - the other session's refresh token is gone: it cannot be renewed;
//   - the auth server refuses the other session's access token (getUser,
//     which middleware.ts and every API route call);
//   - the changing session keeps its id and keeps working;
//   - the old password stops signing in.
//
// The known limit, asserted so it cannot be forgotten: PostgREST checks only a
// token's signature and expiry, never the session behind it, so the other
// session's ACCESS token still reads through /rest/v1 until it expires — up to
// the JWT lifetime, 3600 s by default. If that assertion ever fails, Auth has
// started revoking access tokens and the note can go.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { anonKey, createUser, deleteUsers, url } from './harness.ts';

after(deleteUsers);

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

function claims(jwt: string): { session_id: string; iat: number; exp: number } {
  return JSON.parse(Buffer.from(jwt.split('.')[1] ?? '', 'base64url').toString('utf8'));
}

describe('a password change ends every other session — item 3', () => {
  it('the other session can neither refresh nor pass the auth server; this one carries on', async () => {
    const u = await createUser('two-sessions');
    const other = createClient(url, anonKey, noSession);
    const signedIn = await other.auth.signInWithPassword({ email: u.email, password: u.password });
    assert.equal(signedIn.error, null);
    const otherAccess = signedIn.data.session?.access_token ?? '';
    const mine = (await u.client.auth.getSession()).data.session?.access_token ?? '';
    assert.notEqual(claims(otherAccess).session_id, claims(mine).session_id, 'the control: two sessions');

    const changed = await u.client.auth.updateUser({ password: randomUUID() });
    assert.equal(changed.error, null);

    // The other session's refresh token was deleted with its session.
    const refreshed = await other.auth.refreshSession();
    assert.equal(refreshed.error?.code, 'refresh_token_not_found');

    // The auth server refuses its access token: the session it names is gone.
    const user = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${otherAccess}` },
    });
    assert.equal(user.status, 403);
    assert.equal(((await user.json()) as { error_code?: string }).error_code, 'session_not_found');

    // The session that changed the password is kept, with the same id.
    const renewed = await u.client.auth.refreshSession();
    assert.equal(renewed.error, null);
    assert.equal(claims(renewed.data.session?.access_token ?? '').session_id, claims(mine).session_id);

    // The old password no longer signs in.
    const stale = await createClient(url, anonKey, noSession).auth
      .signInWithPassword({ email: u.email, password: u.password });
    assert.equal(stale.error?.code, 'invalid_credentials');

    // The known limit: PostgREST still honours the old access token until it expires.
    const rest = createClient(url, anonKey, {
      ...noSession, global: { headers: { Authorization: `Bearer ${otherAccess}` } },
    });
    const { data, error } = await rest.from('profiles').select('id').eq('id', u.id);
    assert.equal(error, null);
    assert.equal(data?.length, 1, 'PostgREST now refuses a revoked session — update this note');
    const { iat, exp } = claims(otherAccess);
    assert.ok(exp - iat <= 3600, `the window is the JWT lifetime, ${exp - iat} s here`);
  });
});
