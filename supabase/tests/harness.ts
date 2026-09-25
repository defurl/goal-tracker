// Shared set-up for the database tests: clients, throwaway users, and the guard
// that keeps these tests off any database that holds real people.
//
// Run against the local stack only:
//   supabase start
//   pnpm test:db
//
// The keys come from `supabase status -o env` (API_URL, ANON_KEY,
// SERVICE_ROLE_KEY); `pnpm test:db` loads them. SUPABASE_URL and friends are
// accepted too, so CI can pass them explicitly.

import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function env(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    `missing ${names.join(' / ')} — start the local stack with \`supabase start\` ` +
      'and run through `pnpm test:db`, which loads `supabase status -o env`.',
  );
}

export const url = env('SUPABASE_URL', 'API_URL');
export const anonKey = env('SUPABASE_ANON_KEY', 'ANON_KEY');
const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY', 'SERVICE_ROLE_KEY');

// These tests create and delete auth users. Pointed at the hosted project they
// would do that among real accounts, so a non-local URL is refused outright.
const host = new URL(url).hostname;
if (!['127.0.0.1', 'localhost'].includes(host)) {
  throw new Error(
    `refusing to run database tests against ${host}: they create and delete ` +
      'users. Point them at `supabase start`, never at the hosted project.',
  );
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

/** Bypasses RLS. Seeds and inspects; never the client under test. */
export const admin: SupabaseClient = createClient(url, serviceKey, noSession);

export interface TestUser {
  id: string;
  email: string;
  /** Signed in with the anon key — exactly what a browser holds. */
  client: SupabaseClient;
}

const created: string[] = [];

export async function createUser(label: string): Promise<TestUser> {
  const email = `${label}-${randomUUID()}@rls.test`;
  const password = randomUUID();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);
  created.push(data.user.id);

  const client = createClient(url, anonKey, noSession);
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`signIn(${label}): ${signInError.message}`);

  return { id: data.user.id, email, client };
}

/** Deletes every user this run created; their rows go with them (on delete cascade). */
export async function deleteUsers(): Promise<void> {
  for (const id of created.splice(0)) {
    await admin.auth.admin.deleteUser(id);
  }
}

/** Insert through the service role and return the row, or throw. */
export async function seed<T extends Record<string, unknown>>(
  table: string,
  row: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`seed ${table}: ${error.message}`);
  return data as T;
}

/** Postgres' insufficient_privilege — what an RLS violation surfaces as. */
export const RLS_DENIED = '42501';
