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
 * **The room's performance score is a warning, not an error.** A CI runner has
 * no GPU, so the room is drawn on SwiftShader, where every shader link and
 * every frame is CPU work on the main thread: it scored 0.76 there against a
 * median 0.92 on a desktop GPU for the same build (PROGRESS.md, 2026-09-29).
 * Failing CI on that number would be failing it on the runner. Its LCP, CLS and script
 * budget are errors, because those do not depend on the GPU.
 *
 * LCP on the mobile routes is a warning for the same kind of reason: Lighthouse
 * simulates slow 4G there, and the 2.5 s budget was set against the portfolio's
 * desktop numbers. /text measured 2.2–2.6 s across runs, median under 2.5 s.
 *
 * Needs the production server: `pnpm build && pnpm start`, then `pnpm lh:check`.
 * Reports land in .lighthouseci/. Runs on Playwright's Chromium, so it runs
 * anywhere capture:states does.
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { chromium } from 'playwright';

const CONFIGS = ['lighthouse/mobile.json', 'lighthouse/desktop.json'];

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

let failed = false;
try {
  await waitForChrome();
  for (const config of CONFIGS) {
    console.log(`\nlh:check -> ${config}`);
    const run = spawnSync(
      process.execPath,
      [LHCI, 'autorun', `--config=${config}`, `--collect.settings.port=${DEBUG_PORT}`],
      { env, stdio: 'inherit' },
    );
    if (run.status !== 0) failed = true;
  }
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
