// 028_valid_timezone.sql — a profile's timezone is a real IANA zone.
//
// Free text there did two kinds of damage: a value Postgres cannot read made
// the hourly sweep fail for every user, and a POSIX offset string ('XYZ-160',
// seven days ahead) let one user open a fortnight of local days at once,
// multiplying every daily bound.

import { after, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { admin, catalog, createUser, deleteUsers, seed } from './harness.ts';

after(deleteUsers);

const INVALID = '22023';

describe('profiles.timezone — 028', () => {
  it('a real zone is accepted, as hydrate() writes it', async () => {
    const u = await createUser('zone-ok');
    const { error } = await u.client.from('profiles').update({ timezone: 'America/Argentina/Buenos_Aires' }).eq('id', u.id);
    assert.equal(error, null);
  });

  it('an offset string or an unknown name is refused, for the user and the server alike', async () => {
    const u = await createUser('zone-bad');
    for (const zone of ['XYZ-160', 'UTC+100', '<+150>-150', 'Not/AZone', '']) {
      const own = await u.client.from('profiles').update({ timezone: zone }).eq('id', u.id);
      assert.equal(own.error?.code, INVALID, `the user stored "${zone}"`);
      const server = await admin.from('profiles').update({ timezone: zone }).eq('id', u.id);
      assert.equal(server.error?.code, INVALID, `the service role stored "${zone}"`);
    }
    const { data } = await admin.from('profiles').select('timezone').eq('id', u.id).single();
    assert.equal(data?.timezone, 'UTC');
  });

  it('the sweep skips a zone it cannot read instead of failing for everyone', async () => {
    const good = await createUser('zone-sweep-good');
    const bad = await createUser('zone-sweep-bad');
    for (const u of [good, bad]) {
      await seed('user_actions', { user_id: u.id, action_text: 'Stretch.', source_summary: 's' });
    }
    // A bad value from before 028 can only be staged with the trigger off, in
    // a transaction that is rolled back.
    const result = catalog<{ seeded_good: number; seeded_bad: number }>(`
      begin;
      alter table profiles disable trigger profiles_valid_timezone;
      update profiles set timezone = 'Not/AZone' where id = '${bad.id}';
      do $$ begin perform seed_daily_challenge(); end $$;
      select json_build_object(
        'seeded_good', (select count(*) from daily_challenges where user_id = '${good.id}'),
        'seeded_bad', (select count(*) from daily_challenges where user_id = '${bad.id}'));
      rollback;
    `);
    assert.deepEqual(result, { seeded_good: 1, seeded_bad: 0 });
  });
});
