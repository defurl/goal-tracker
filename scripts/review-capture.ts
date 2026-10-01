/**
 * review:capture — every screen the Phase 6 review board shows (D-25 §1).
 *
 * A throwaway user with a lived-in account — a year of habits, five weeks of
 * journal moods, three goals with milestones, a grown tree — signed in on a
 * production build, plus the signed-out states: the room and each panel on a
 * desktop and a phone, the hall, the corner in each of its states, /text whole
 * and section by section, sign-in and /privacy. Every capture is pinned to
 * 22:00 (the profile's zone and the browser's agree), so the room wears its
 * night look throughout.
 *
 * Local only, twice over: the seed goes to the stack `supabase status` reports
 * and any other host is refused, and the user is deleted at the end. The app
 * under test must be built against that same stack (README, "The local
 * database"); pointed anywhere else, the sign-in fails and nothing is captured.
 *
 *   pnpm exec supabase start
 *   pnpm build && pnpm start          the app, with .env.local on the local stack
 *   pnpm review:capture               writes captures/review/ (not committed)
 *
 * CAPTURE_BASE_URL overrides http://localhost:3000. A GPU is used where there
 * is one: SwiftShader drops bloom under load, and the board shows the effects.
 */

import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type BrowserContextOptions, type Locator, type Page } from 'playwright';

import { shiftDate, weekday } from '../lib/dates.ts';
import { zoneForHour } from './zone-for-hour.ts';

const BASE = process.env.CAPTURE_BASE_URL ?? 'http://localhost:3000';
const OUT = join('captures', 'review');
const SHOTS = join(OUT, 'shots');

function localStack(): { url: string; serviceKey: string } {
  let status: string;
  try {
    status = execSync('supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    console.error('review:capture: the local stack is not running. Start it with `pnpm exec supabase start`.');
    process.exit(1);
  }
  const vars: Record<string, string> = {};
  for (const line of status.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match?.[1] && match[2] !== undefined) vars[match[1]] = match[2];
  }
  const url = vars.API_URL ?? '';
  const serviceKey = vars.SERVICE_ROLE_KEY ?? '';
  const host = url ? new URL(url).hostname : '';
  if (!['127.0.0.1', 'localhost'].includes(host) || !serviceKey) {
    throw new Error(`refusing to seed ${host || 'an unknown host'}: review:capture creates and deletes a user`);
  }
  return { url, serviceKey };
}

const { url: SUPA, serviceKey } = localStack();
const ADMIN = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const ZONE = zoneForHour(22);
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date());
const ago = (n: number) => shiftDate(TODAY, -n);

async function rest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers: ADMIN,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${method} ${path} ${response.status} ${await response.text()}`);
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

interface HabitRow {
  id: string;
  frequency: { days: number[] };
}
interface IdRow {
  id: string;
}

const email = `review-${randomUUID().slice(0, 8)}@rls.test`;
const password = randomUUID();

async function createUser(): Promise<string> {
  const response = await fetch(`${SUPA}/auth/v1/admin/users`, {
    method: 'POST',
    headers: ADMIN,
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!response.ok) throw new Error(`create user ${response.status} ${await response.text()}`);
  return ((await response.json()) as IdRow).id;
}

async function seed(uid: string): Promise<void> {
  await rest('PATCH', `profiles?id=eq.${uid}`, { timezone: ZONE });

  // Imports waiting to become a day's challenge; ensure_daily_challenge picks one.
  await rest('POST', 'user_actions', [
    { user_id: uid, status: 'pending', action_text: 'Write down the three things you finished today before you close the laptop.', source_summary: 'An essay on ending the workday on purpose', source_url: 'https://example.com/shutdown-ritual' },
    { user_id: uid, status: 'pending', action_text: 'Put your phone in another room for the first hour after you wake.', source_summary: 'Notes on attention in the morning', source_url: 'https://example.com/first-hour' },
    { user_id: uid, status: 'pending', action_text: 'Walk for ten minutes after lunch, without headphones.', source_summary: 'A short piece on walking and thinking', source_url: 'https://example.com/walk-to-think' },
    { user_id: uid, status: 'done', action_text: 'Drink a glass of water before your first coffee.', source_summary: 'Hydration basics', source_url: null },
  ]);

  // Every row carries the same keys: PostgREST rejects a bulk insert otherwise.
  const everyDay = { days: [0, 1, 2, 3, 4, 5, 6] };
  const born = new Date(Date.now() - 420 * 86400000).toISOString();
  const archived = new Date(Date.now() - 150 * 86400000).toISOString();
  const habit = (name: string, type: 'build' | 'break', longest: number, days = everyDay, archivedAt: string | null = null) => ({
    user_id: uid, name, type, frequency: days, created_at: born, archived_at: archivedAt, longest_streak: longest, streak: 0,
  });
  const habits = await rest<HabitRow[]>('POST', 'habits', [
    habit('Walk after dinner', 'build', 41),
    habit('Read ten pages', 'build', 12),
    habit('Gym', 'build', 21, { days: [1, 3, 5] }),
    habit('No phone in bed', 'break', 16),
    habit('No sugar after six', 'break', 19, everyDay, archived),
  ]);
  const [walk, read, gym, phone, sugar] = habits as [HabitRow, HabitRow, HabitRow, HabitRow, HabitRow];
  const kept = new Map(habits.map((h) => [h.id, new Set<string>()]));
  const logs: { habit_id: string; user_id: string; date: string; completed: true }[] = [];
  const keep = (h: HabitRow, date: string) => {
    logs.push({ habit_id: h.id, user_id: uid, date, completed: true });
    kept.get(h.id)?.add(date);
  };
  for (let n = 0; n < 365; n++) {
    const date = ago(n);
    // Today: the walk and the phone kept, reading and the gym still to do.
    if (n === 0) {
      keep(walk, date);
      keep(phone, date);
      continue;
    }
    if ((n >= 60 && n < 101) || (n < 60 && n % 3 !== 0) || (n >= 101 && n % 4 !== 1)) keep(walk, date);
    if (n % 5 === 0 || n % 7 === 0 || n === 1) keep(read, date);
    if ([1, 3, 5].includes(weekday(date)) && n % 17 !== 2) keep(gym, date);
    if (n % 6 !== 4) keep(phone, date);
    if (n >= 150 && n % 2 === 0) keep(sugar, date);
  }
  await rest('POST', 'habit_logs', logs);

  // The stored streak, as log_habit() would have left it: consecutive due days
  // kept, ending today or yesterday.
  for (const h of [walk, read, gym, phone]) {
    let run = 0;
    for (let n = 0; n < 365; n++) {
      const date = ago(n);
      if (!h.frequency.days.includes(weekday(date))) continue;
      if (kept.get(h.id)?.has(date)) run++;
      else if (n !== 0) break;
    }
    await rest('PATCH', `habits?id=eq.${h.id}`, { streak: run });
  }

  // Five weeks of moods. Never any entry text: there is no column for it (FR-3.6).
  const moods: [string, number][] = [['bright', 2], ['content', 1], ['calm', 1], ['neutral', 0], ['tired', -1], ['anxious', -1], ['low', -2]];
  const tags = ['work', 'health', 'rest', 'learning', 'home', 'relationships'];
  const entries = [];
  for (let n = 1; n <= 34; n++) {
    if (n % 4 === 3 || n % 9 === 0) continue;
    const [mood, score] = moods[(n * 5) % moods.length] as [string, number];
    const picked = [...new Set([tags[n % tags.length], tags[(n * 3) % tags.length]])];
    entries.push({ user_id: uid, date: ago(n), mood, mood_score: score, tags: picked });
  }
  await rest('POST', 'journal_entries', entries);

  // One goal is five days overdue on purpose: it must look like any other (FR-4.5).
  const goals = await rest<IdRow[]>('POST', 'goals', [
    { user_id: uid, title: 'Run a 10k', category: 'health', description: 'Under an hour, by the spring race.', start_date: ago(60), target_date: shiftDate(TODAY, 45) },
    { user_id: uid, title: 'Rewrite the portfolio site', category: 'career', description: null, start_date: ago(90), target_date: ago(5) },
    { user_id: uid, title: 'Read twelve books this year', category: 'learning', description: null, start_date: ago(270), target_date: shiftDate(TODAY, 90) },
  ]);
  const milestones = (goal: IdRow, list: [string, boolean][]) =>
    list.map(([title, done], i) => ({
      goal_id: goal.id, user_id: uid, title, sort_order: i,
      completed_at: done ? new Date(Date.now() - (list.length - i) * 7 * 86400000).toISOString() : null,
    }));
  const [run, site, books] = goals as [IdRow, IdRow, IdRow];
  await rest('POST', 'milestones', [
    ...milestones(run, [['Run 3k without stopping', true], ['Run 5k', true], ['Run 7.5k', false], ['Run 10k', false]]),
    ...milestones(site, [['Pick the three projects', true], ['Write the case studies', true], ['New layout', true], ['Photos', false], ['Publish', false]]),
    ...milestones(books, [['Three books', true], ['Six books', true], ['Nine books', false], ['Twelve books', false]]),
  ]);

  // A grown tree: 1,620 points across the year, twenty of them today.
  const award = (event: string, points: number, date: string) =>
    rest('POST', 'rpc/award_points', { p_user_id: uid, p_event: event, p_points: points, p_ref_id: randomUUID(), p_date: date });
  for (let w = 1; w <= 26; w++) await award('weekly_streak', 50, ago(w * 7));
  for (let n = 2; n <= 40; n += 2) await award('daily_challenge', 15, ago(n));
  await award('build_habit', 10, TODAY);
  await award('break_habit', 10, TODAY);
}

// ── the browser ──────────────────────────────────────────────────────────────

const DESKTOP: BrowserContextOptions = { viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 };
const PHONE: BrowserContextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const PANELS: [label: string, name: string][] = [
  ['daily challenge', 'challenge'],
  ['article import', 'import'],
  ['goals', 'goals'],
  ['journal', 'journal'],
  ['tracker', 'habits'],
  ['bonsai', 'bonsai'],
];

interface Tab {
  context: BrowserContext;
  page: Page;
  errors: string[];
}

const shots: { name: string; file: string }[] = [];

async function open(browser: Browser, device: BrowserContextOptions): Promise<Tab> {
  const context = await browser.newContext({ ...device, colorScheme: 'dark', timezoneId: ZONE });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  return { context, page, errors };
}

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.keyboard.press('Enter');
  try {
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30000 });
  } catch {
    throw new Error('sign-in failed: is the app under test built against the local stack?');
  }
}

async function shot(page: Page, name: string, options: Parameters<Page['screenshot']>[0] = {}): Promise<void> {
  const file = `${name}.jpg`;
  await page.screenshot({ ...options, path: join(SHOTS, file), type: 'jpeg', quality: 88 });
  shots.push({ name, file });
  console.log(`  ${name}`);
}

async function shotOf(page: Page, locator: Locator, name: string, pad = 12): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`nothing to capture for ${name}`);
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  await shot(page, name, {
    clip: { x, y, width: Math.min(viewport.width - x, box.width + pad * 2), height: Math.min(viewport.height - y, box.height + pad * 2) },
  });
}

/** The bottom-right furniture: everything whose class names a corner. */
async function shotCorner(page: Page, name: string): Promise<void> {
  const box = await page.evaluate(() => {
    const rects = [...document.querySelectorAll('[class*="corner"]')]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 0);
    if (rects.length === 0) return null;
    const left = Math.min(...rects.map((r) => r.left));
    const top = Math.min(...rects.map((r) => r.top));
    return { left, top, height: Math.max(...rects.map((r) => r.bottom)) - top };
  });
  if (!box) return;
  const viewport = page.viewportSize() ?? { width: 0, height: 0 };
  const x = Math.max(0, box.left - 112);
  const y = Math.max(0, box.top - 28);
  await shot(page, name, { clip: { x, y, width: viewport.width - x, height: Math.min(viewport.height - y, box.height + 56) } });
}

async function ready(page: Page, scene: 'room' | 'hall' = 'room'): Promise<void> {
  await page.waitForSelector(`[data-room-ready][data-scene="${scene}"]`, { timeout: 120000 });
  await page.waitForTimeout(4500);
}

/** From the keyboard: an object's hidden button, then Enter. The panel's title takes focus. */
async function activate(page: Page, label: string, wait = 3800): Promise<void> {
  await page.locator(`button[aria-label="${label}"]`).focus();
  await page.keyboard.press('Enter');
  await page.waitForTimeout(wait);
}

async function back(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(3200);
}

async function room(page: Page, prefix: string, extras = false): Promise<void> {
  await ready(page);
  await shot(page, `${prefix}-rest`);
  await shotCorner(page, `${prefix}-corner`);
  if (extras) {
    for (const [label, name] of [['daily challenge', 'label'], ['step through', 'door']] as const) {
      await page.locator(`button[aria-label="${label}"]`).focus();
      await page.waitForTimeout(700);
      await shot(page, `${prefix}-${name}`);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.waitForTimeout(400);
    }
  }
  for (const [label, name] of PANELS) {
    await activate(page, label);
    await shot(page, `${prefix}-panel-${name}`);
    await back(page);
  }
  if (extras) {
    await activate(page, 'window', 3200);
    await shot(page, `${prefix}-window`);
    await back(page);
  }
}

/** Sound on (the countdown), then one press on delete account — it arms and lapses on its own. */
async function cornerStates(page: Page, prefix: string): Promise<void> {
  await page.getByRole('button', { name: 'sound off' }).click();
  await page.waitForTimeout(2500);
  await shotCorner(page, `${prefix}-corner-sound`);
  await page.getByRole('button', { name: 'sound on' }).click();
  await page.waitForTimeout(1200);

  await page.getByRole('button', { name: 'delete account' }).click();
  await page.waitForTimeout(300);
  await shotCorner(page, `${prefix}-corner-armed`);
  await page.waitForTimeout(4200);
  if ((await page.getByRole('button', { name: 'delete account' }).count()) !== 1) {
    throw new Error('the delete control did not lapse');
  }
}

async function textPage(page: Page, prefix: string, sections = false): Promise<void> {
  await page.goto(`${BASE}/text`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // The history is read only once its section nears the screen (A5.9).
  await page.locator('section[aria-labelledby="history-heading"]').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await shot(page, `${prefix}-full`, { fullPage: true });
  if (!sections) return;
  await shotOf(page, page.locator('main > header'), `${prefix}-header`);
  const list = page.locator('main > section');
  for (let i = 0; i < (await list.count()); i++) {
    const section = list.nth(i);
    const title = (await section.locator('h2').first().innerText()).toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shotOf(page, section, `${prefix}-section-${title}`);
  }
}

mkdirSync(SHOTS, { recursive: true });
const uid = await createUser();
const browser = await chromium.launch({ channel: 'chromium', args: ['--use-angle=d3d11', '--ignore-gpu-blocklist'] });
const failures: string[] = [];
try {
  await seed(uid);
  console.log(`review:capture -> ${OUT}  (${BASE}, ${ZONE}, today ${TODAY})`);

  // Desktop, signed in: the room, its corner and labels, every panel, the window; the hall; /text.
  {
    const tab = await open(browser, DESKTOP);
    await signIn(tab.page);
    await tab.page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await room(tab.page, 'room-in', true);
    await cornerStates(tab.page, 'room-in');
    await tab.page.goto(`${BASE}/?scene=hall`, { waitUntil: 'networkidle' });
    await ready(tab.page, 'hall');
    await shot(tab.page, 'hall-in-rest');
    await activate(tab.page, 'the year');
    await shot(tab.page, 'hall-in-history');
    await back(tab.page);
    await activate(tab.page, 'the tree', 3500);
    await shot(tab.page, 'hall-in-tree');
    await back(tab.page);
    await textPage(tab.page, 'text-desktop-in');
    failures.push(...tab.errors);
    await tab.context.close();
  }

  // Desktop, signed out: what a first visit sees.
  {
    const tab = await open(browser, DESKTOP);
    await tab.page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await room(tab.page, 'room-out');
    await tab.page.goto(`${BASE}/?scene=hall`, { waitUntil: 'networkidle' });
    await ready(tab.page, 'hall');
    await activate(tab.page, 'the year');
    await shot(tab.page, 'hall-out-history');
    for (const route of ['login', 'signup']) {
      await tab.page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
      await shot(tab.page, `auth-desktop-${route}`);
    }
    await tab.page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' });
    await shot(tab.page, 'auth-desktop-privacy', { fullPage: true });
    failures.push(...tab.errors);
    await tab.context.close();
  }

  // Phone, signed in: the room in portrait, its panels and corner; /text whole and by section.
  {
    const tab = await open(browser, PHONE);
    const { page } = tab;
    await signIn(page);
    await page.goto(`${BASE}/?room=1`, { waitUntil: 'networkidle' });
    await room(page, 'room-phone-in');
    await cornerStates(page, 'room-phone-in');
    await textPage(page, 'text-phone-in', true);

    // States a still frame of the page does not show.
    const focus = page.locator('section[aria-labelledby="focus-heading"]');
    await focus.scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'start two minutes' }).click();
    await page.waitForTimeout(2500);
    await shotOf(page, focus, 'text-phone-in-focus-running');
    await page.getByRole('button', { name: 'stop' }).click();

    const habits = page.locator('main > section').filter({ has: page.locator('h2', { hasText: 'Habits' }) });
    await habits.scrollIntoViewIfNeeded();
    await habits.getByRole('button', { name: 'archive' }).first().click();
    await page.waitForTimeout(300);
    await shotOf(page, habits, 'text-phone-in-habits-armed');
    await page.waitForTimeout(4200);
    if (await habits.getByRole('button', { name: 'press again to archive' }).count()) throw new Error('archive did not lapse');

    await page.evaluate(() => window.scrollTo(0, 0));
    await tab.context.setOffline(true);
    await page.waitForTimeout(1500);
    await shotOf(page, page.locator('main > header'), 'text-phone-in-offline');
    await tab.context.setOffline(false);
    failures.push(...tab.errors);
    await tab.context.close();
  }

  // Phone, signed out: /text, sign-in with a wrong password, privacy.
  {
    const tab = await open(browser, PHONE);
    const { page } = tab;
    await textPage(page, 'text-phone-out');
    for (const route of ['login', 'signup']) {
      await page.goto(`${BASE}/${route}`, { waitUntil: 'networkidle' });
      await shot(page, `auth-phone-${route}`);
    }
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.locator('input[type=email]').fill(email);
    await page.locator('input[type=password]').fill(`${password}-wrong`);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2500);
    await shot(page, 'auth-phone-login-error');
    await page.goto(`${BASE}/privacy`, { waitUntil: 'networkidle' });
    await shot(page, 'auth-phone-privacy', { fullPage: true });
    failures.push(...tab.errors);
    await tab.context.close();
  }
} finally {
  await browser.close();
  await fetch(`${SUPA}/auth/v1/admin/users/${uid}`, { method: 'DELETE', headers: ADMIN });
  writeFileSync(join(OUT, 'shots.json'), JSON.stringify({ zone: ZONE, today: TODAY, base: BASE, shots }, null, 1));
}

const left = await rest<unknown[]>('GET', `habits?user_id=eq.${uid}&select=id`);
console.log(`\n${shots.length} screens; the throwaway user ${left.length === 0 ? 'is deleted' : 'STILL HAS ROWS'}.`);
if (failures.length) {
  console.error(`page errors: ${failures.slice(0, 3).join(' | ')}`);
  process.exit(1);
}
