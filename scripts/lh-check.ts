/**
 * lh:check — Lighthouse CI over every route, with asserted budgets (build plan
 * 4.1, design-system/10-tech-stack.md §3).
 *
 * Two configs, because Lighthouse takes one form factor per run:
 *   lighthouse/mobile.json    /text, /login, /signup — phones land on /text (D-07)
 *   lighthouse/desktop.json   / — the room
 *
 * Asserted as errors: performance ≥ 0.85 on the DOM routes, CLS ≤ 0.1, no
 * console errors, and the script transfer budgets from D-10 (200 KB for the
 * shell; 200 + 320 KB for the room, whose scene chunk is lazy but still loads).
 *
 * **CI runs the mobile config only** (`pnpm lh:check mobile`). A runner has no
 * GPU, so the room is drawn on SwiftShader, where each frame holds the main
 * thread for about half a second. Lighthouse cannot finish there: on the first
 * CI run its Network.getResponseBody call timed out. The room is measured on a
 * machine with a GPU (0.96 median, PROGRESS.md 2026-09-29), and its script
 * budget is asserted in CI anyway, by bundle:check. Its performance score is a
 * warning even locally, since a slow GPU is not a regression.
 *
 * LCP on the mobile routes is a warning: Lighthouse simulates slow 4G there,
 * and the 2.5 s budget was set against the portfolio's desktop numbers.
 *
 * Usage, against the production server (`pnpm build && pnpm start`):
 *   pnpm lh:check            both configs
 *   pnpm lh:check mobile     one of them, by name
 * Reports land in .lighthouseci/. Runs on Playwright's Chromium.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { chromium } from 'playwright';

const ALL = ['mobile', 'desktop'];
const only = process.argv[2];
if (only && !ALL.includes(only)) {
  console.error(`lh:check: no config named "${only}". Use one of: ${ALL.join(', ')}.`);
  process.exit(1);
}
const CONFIGS = (only ? [only] : ALL).map((name) => `lighthouse/${name}.json`);

/** lhci's own entry point, run with this Node, so no shell is involved. */
const LHCI = createRequire(import.meta.url).resolve('@lhci/cli/src/cli.js');

/**
 * Lighthouse connects to a Chrome this script starts rather than launching its
 * own. Its launcher deletes the profile directory the instant Chrome is killed,
 * which races Chrome's exit on Windows and fails every run with EPERM. Plain
 * child process, not chromium.launch(): a browser Playwright controls holds new
 * targets for itself and Lighthouse times out on them.
 */
const DEBUG_PORT = 9223;
const CHROME_PATH = process.env.CHROME_PATH ?? chromium.executablePath();

const profile = mkdtempSync(join(tmpdir(), 'lh-check-'));
const chrome = spawn(
  CHROME_PATH,
  [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    // Playwright launches its Chromium unsandboxed too. CI runners on Ubuntu
    // 24.04 block the unprivileged namespaces the sandbox needs.
    ...(process.platform === 'linux' ? ['--no-sandbox'] : []),
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function waitForChrome(): Promise<void> {
  for (let i = 0; i < 50; i++) {
    try {
      await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`Chrome never opened its debugging port (${CHROME_PATH})`);
}

// lhci's healthcheck looks for a Chrome install even when it will not launch one.
const env = { ...process.env, CHROME_PATH };

/**
 * On GitHub Actions every failed or warned assertion also becomes an
 * annotation. Annotations show on the run page and through the public checks
 * API, where a job's log needs admin rights, so a red job says why without
 * anyone having to open it.
 */
const IN_CI = process.env.GITHUB_ACTIONS === 'true';
const RESULTS = join('.lighthouseci', 'assertion-results.json');

function annotate(level: 'error' | 'warning', message: string): void {
  if (IN_CI) console.log(`::${level} title=lh:check::${message.replace(/\r?\n/g, ' ')}`);
}

interface Assertion {
  url: string;
  auditId: string;
  auditProperty?: string;
  operator: string;
  expected: number;
  actual: number;
  level: 'error' | 'warn';
  passed: boolean;
}

function reportAssertions(config: string, output: string): void {
  if (!existsSync(RESULTS)) {
    // Lighthouse never got as far as asserting: say what it last printed.
    const tail = output.trim().split('\n').slice(-6).join(' | ');
    annotate('error', `${config}: Lighthouse did not finish. ${tail}`);
    return;
  }
  const results = JSON.parse(readFileSync(RESULTS, 'utf8')) as Assertion[];
  for (const a of results.filter((r) => !r.passed)) {
    const audit = a.auditProperty ? `${a.auditId}.${a.auditProperty}` : a.auditId;
    annotate(
      a.level === 'error' ? 'error' : 'warning',
      `${new URL(a.url).pathname} ${audit}: expected ${a.operator} ${a.expected}, found ${a.actual}`,
    );
  }
}

let failed = false;
try {
  await waitForChrome();
  for (const config of CONFIGS) {
    console.log(`\nlh:check -> ${config}`);
    rmSync(RESULTS, { force: true });
    const run = spawnSync(
      process.execPath,
      [LHCI, 'autorun', `--config=${config}`, `--collect.settings.port=${DEBUG_PORT}`],
      { env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );
    process.stdout.write(run.stdout ?? '');
    process.stderr.write(run.stderr ?? '');
    reportAssertions(config, `${run.stdout ?? ''}\n${run.stderr ?? ''}`);
    if (run.status !== 0) failed = true;
  }
} catch (err) {
  annotate('error', (err as Error).message);
  throw err;
} finally {
  chrome.kill();
  await new Promise((resolve) => chrome.once('exit', resolve));
  rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}

if (failed) {
  console.error('\nlh:check: a budget failed. Reports are in .lighthouseci/.');
  process.exit(1);
}
console.log('\nlh:check: every asserted budget holds.');
