// pnpm test:db — runs supabase/tests/ against the local stack.
//
// Loads the local stack's URL and keys from `supabase status -o env` so nobody
// has to paste a service-role key into a shell. The keys printed there are the
// CLI's fixed local-development keys, not the hosted project's.
//
// Needs `supabase start` first. The harness refuses any non-local URL.

import { execSync, spawnSync } from 'node:child_process';

let status: string;
try {
  // pnpm puts node_modules/.bin on PATH for scripts, so this is the pinned CLI.
  status = execSync('supabase status -o env', {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
} catch {
  console.error('test:db: the local stack is not running. Start it with `pnpm exec supabase start`.');
  process.exit(1);
}

const env: NodeJS.ProcessEnv = { ...process.env };
for (const line of status.split(/\r?\n/)) {
  const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
  if (match?.[1] && match[2] !== undefined) env[match[1]] = match[2];
}

// One file at a time: seed_daily_challenge() sweeps every profile, so a file
// that runs it would otherwise act on another file's users mid-test.
const args = ['--test', '--test-concurrency=1', 'supabase/tests/*.test.ts'];
const result = spawnSync(process.execPath, args, {
  stdio: 'inherit',
  env,
});
process.exit(result.status ?? 1);
