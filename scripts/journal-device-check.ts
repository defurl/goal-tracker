/**
 * journal:check — Phase 7 P0's device-journal test (spec/06, D-26 §5).
 *
 * The journal's writing now lives only in the browser (lib/journal/deviceStore.ts).
 * This drives that module, unchanged, in Chromium, Firefox and WebKit, each with a
 * persistent profile, and checks what D-26 depends on:
 *
 *   - entries save, list newest first, and stay with their own account
 *   - search and a date range work on the device
 *   - bad entries are refused at save
 *   - entries survive closing and reopening the browser
 *   - export, then import into a fresh profile, gives back the same entries;
 *     importing twice adds nothing; a bad file is refused and writes nothing
 *   - sign-out's delete removes one account's entries and leaves another's
 *   - what each engine answers when asked for persistent storage
 *
 * What it cannot show: Safari's seven-day eviction of a site's data, or how a
 * real browser decides to grant persistence. Those need a real Safari device.
 * WebKit here is Playwright's build of the engine, not Safari.
 *
 * No server or build needed: `pnpm journal:check`. Writes
 * captures/p0/journal-device.json.
 */

import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, firefox, webkit, type BrowserContext, type BrowserType, type Page } from 'playwright';

const ROOT = process.cwd();
const MODULE_JS = stripTypeScriptTypes(readFileSync(join(ROOT, 'lib/journal/deviceStore.ts'), 'utf8'));
const PAGE = `<!doctype html><meta charset="utf-8"><title>journal check</title>
<script type="module">import * as J from '/deviceStore.js'; window.J = J; window.ready = true;</script>`;

const OWNER_A = 'aaaaaaaa-0000-4000-8000-000000000001';
const OWNER_B = 'bbbbbbbb-0000-4000-8000-000000000002';
const OWNER_C = 'cccccccc-0000-4000-8000-000000000003';
const ENTRIES = 200;

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

interface EngineResult {
  checks: Check[];
  storage: unknown;
  timingsMs: Record<string, number>;
  exportBytes: number;
}

function serve(): Promise<{ base: string; close: () => void }> {
  const server = createServer((req, res) => {
    if (req.url === '/deviceStore.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(MODULE_JS);
    } else {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(PAGE);
    }
  });
  return new Promise((resolve) => {
    server.listen(0, 'localhost', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({ base: `http://localhost:${port}/`, close: () => server.close() });
    });
  });
}

async function open(type: BrowserType, dir: string, base: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await type.launchPersistentContext(dir, { headless: true });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto(base);
  await page.waitForFunction(() => (window as unknown as { ready?: boolean }).ready === true);
  return { ctx, page };
}

type Journal = typeof import('../lib/journal/deviceStore.ts');

/**
 * Runs `fn` in the page with the module as `J`; returns its result. `fn` is
 * sent as source, so it may use only its arguments and browser globals.
 */
function inPage<T, A>(page: Page, fn: (J: Journal, arg: A) => Promise<T>, arg: A): Promise<T> {
  return page.evaluate(
    async ({ src, a }) => {
      const f = new Function('J', 'arg', `return (${src})(J, arg);`);
      return f((window as unknown as { J: unknown }).J, a);
    },
    { src: fn.toString(), a: arg },
  ) as Promise<T>;
}

async function runEngine(name: string, type: BrowserType, base: string): Promise<EngineResult> {
  const checks: Check[] = [];
  const check = (n: string, ok: boolean, detail = '') => checks.push({ name: n, ok, detail });
  const timingsMs: Record<string, number> = {};
  const dirA = mkdtempSync(join(tmpdir(), `bbe-journal-${name}-a-`));
  const dirB = mkdtempSync(join(tmpdir(), `bbe-journal-${name}-b-`));

  try {
    // ── Profile A: write, read, search, refuse ──────────────────────────────
    let { ctx, page } = await open(type, dirA, base);

    const t0 = Date.now();
    await inPage(
      page,
      async (J, { a, b, n }) => {
        const db = await J.openJournal();
        const words = ['garden', 'walk', 'meeting', 'tired', 'grateful', 'cà phê sáng', 'một bước nhỏ', '🌱'];
        for (let i = 0; i < n; i++) {
          const day = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString().slice(0, 10);
          const text = Array.from({ length: 40 }, (_, k) => words[(i + k) % words.length]).join(' ');
          await J.saveEntry(db, {
            id: `a-${String(i).padStart(4, '0')}-${crypto.randomUUID()}`,
            ownerId: a,
            localDate: day,
            type: i % 3 === 0 ? 'check-in' : i % 3 === 1 ? 'free' : 'guided',
            title: i % 2 ? `Day ${i}` : null,
            body: i % 10 === 0 ? `garden walk ${text}` : text.replaceAll('garden', 'yard'),
            prompt: i % 3 === 2 ? 'one-good-thing' : null,
            tags: i % 4 === 0 ? ['rest', 'home'] : ['work'],
            moods: ['calm'],
            energy: ((i % 5) + 1) as 1 | 2 | 3 | 4 | 5,
            createdAt: new Date(Date.UTC(2026, 0, 1) + i * 86400000 + 3600000).toISOString(),
            updatedAt: new Date(Date.UTC(2026, 0, 1) + i * 86400000 + 3600000).toISOString(),
          });
        }
        for (let i = 0; i < 5; i++) {
          await J.saveEntry(db, {
            id: `b-${i}-${crypto.randomUUID()}`,
            ownerId: b,
            localDate: '2026-02-01',
            type: 'free',
            title: null,
            body: 'garden walk from another account',
            prompt: null,
            tags: [],
            moods: [],
            energy: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        db.close();
      },
      { a: OWNER_A, b: OWNER_B, n: ENTRIES },
    );
    timingsMs.write200 = Date.now() - t0;
    // After the writes, so usage counts them.
    const storage = await inPage(page, (J) => J.requestPersistence(3000), null);

    const read = await inPage(
      page,
      async (J, { a, b }) => {
        const db = await J.openJournal();
        const listA = await J.listEntries(db, a);
        const base = listA[0];
        if (!base) throw new Error('no entries were saved');
        const oldest = listA[listA.length - 1]?.localDate ?? '';
        const out = {
          countA: await J.countEntries(db, a),
          countB: await J.countEntries(db, b),
          leak: listA.some((e: { ownerId: string }) => e.ownerId !== a),
          newestFirst: base.localDate > oldest,
          search: (await J.searchEntries(db, a, 'Garden WALK')).length,
          unicode: (await J.searchEntries(db, a, 'cà phê')).length,
          ranged: (await J.searchEntries(db, a, 'garden', { from: '2026-01-01', to: '2026-01-31' })).length,
          tooLong: '',
          badDate: '',
        };
        try {
          await J.saveEntry(db, { ...base, id: 'x-toolong-000', body: 'x'.repeat(20001) });
        } catch (e) {
          out.tooLong = String((e as Error).message);
        }
        try {
          await J.saveEntry(db, { ...base, id: 'x-baddate-000', localDate: '30/10/2026' });
        } catch (e) {
          out.badDate = String((e as Error).message);
        }
        db.close();
        return out;
      },
      { a: OWNER_A, b: OWNER_B },
    );
    check('saves every entry', read.countA === ENTRIES && read.countB === 5, `A ${read.countA}, B ${read.countB}`);
    check('lists only its own account', !read.leak);
    check('lists newest first', read.newestFirst === true);
    check('search, case-insensitive, all words', read.search === ENTRIES / 10, `${read.search} of ${ENTRIES / 10}`);
    check('search finds Vietnamese text', read.unicode > 0, `${read.unicode}`);
    check('search with a date range', read.ranged === 4, `${read.ranged} of 4 in January`);
    check('refuses a body over the cap', read.tooLong.includes('body'), read.tooLong);
    check('refuses a malformed date', read.badDate.includes('localDate'), read.badDate);
    await ctx.close();

    // ── Profile A again: survives a restart; export; sign-out delete ────────
    ({ ctx, page } = await open(type, dirA, base));
    const after = await inPage(
      page,
      async (J, { a, b }) => {
        const db = await J.openJournal();
        const kept = await J.countEntries(db, a);
        const file = await J.exportJournal(db, a);
        const deleted = await J.deleteAllFor(db, a);
        const out = { kept, file, deleted, leftA: await J.countEntries(db, a), leftB: await J.countEntries(db, b) };
        db.close();
        return out;
      },
      { a: OWNER_A, b: OWNER_B },
    );
    check('survives closing the browser', after.kept === ENTRIES, `${after.kept} after reopening`);
    check('sign-out deletes that account', after.deleted === ENTRIES && after.leftA === 0, `deleted ${after.deleted}`);
    check("sign-out leaves another account's entries", after.leftB === 5, `B ${after.leftB}`);
    await ctx.close();

    // ── Profile B: a different device; import; refusals ─────────────────────
    ({ ctx, page } = await open(type, dirB, base));
    const imported = await inPage(
      page,
      async (J, { c, file }) => {
        const db = await J.openJournal();
        const first = await J.importJournal(db, c, file);
        const second = await J.importJournal(db, c, file);
        const list = await J.listEntries(db, c);
        const parsed = JSON.parse(file);
        const same =
          list.length === parsed.entries.length &&
          list.every(
            (e: { id: string; body: string; ownerId: string }, i: number) =>
              e.id === parsed.entries[i].id && e.body === parsed.entries[i].body && e.ownerId === c,
          );
        const refusals: string[] = [];
        const bad = [
          'not json',
          JSON.stringify({ format: 'something-else', version: 1, entries: [] }),
          JSON.stringify({ ...parsed, version: 2 }),
          JSON.stringify({ ...parsed, entries: [...parsed.entries.slice(0, 3), { ...parsed.entries[3], energy: 9 }] }),
        ];
        for (const text of bad) {
          try {
            await J.importJournal(db, 'dddddddd-0000-4000-8000-000000000004', text);
            refusals.push('ACCEPTED');
          } catch (e) {
            refusals.push(String((e as Error).message));
          }
        }
        const wroteNothing = (await J.countEntries(db, 'dddddddd-0000-4000-8000-000000000004')) === 0;
        db.close();
        return { first, second, same, refusals, wroteNothing };
      },
      { c: OWNER_C, file: after.file },
    );
    check('import restores every entry', imported.first.added === ENTRIES, `added ${imported.first.added}`);
    check('imported entries match the export', imported.same);
    check('importing twice adds nothing', imported.second.added === 0 && imported.second.skipped === ENTRIES);
    check(
      'refuses bad files',
      imported.refusals.every((r) => r.startsWith('import refused')),
      imported.refusals.join(' | '),
    );
    check('a refused file writes nothing', imported.wroteNothing);
    await ctx.close();

    return { checks, storage, timingsMs, exportBytes: Buffer.byteLength(after.file) };
  } finally {
    rmSync(dirA, { recursive: true, force: true });
    rmSync(dirB, { recursive: true, force: true });
  }
}

const { base, close } = await serve();
const engines: [string, BrowserType][] = [
  ['chromium', chromium],
  ['firefox', firefox],
  ['webkit', webkit],
];
const report: Record<string, EngineResult | { error: string }> = {};
let failed = 0;

for (const [name, type] of engines) {
  try {
    const r = await runEngine(name, type, base);
    report[name] = r;
    const bad = r.checks.filter((c) => !c.ok);
    failed += bad.length;
    console.log(`\n${name}: ${r.checks.length - bad.length}/${r.checks.length} checks pass`);
    for (const c of r.checks) console.log(`  ${c.ok ? 'ok  ' : 'FAIL'} ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
    console.log(`  storage: ${JSON.stringify(r.storage)}`);
    console.log(`  ${ENTRIES} entries written in ${r.timingsMs.write200} ms; export ${(r.exportBytes / 1024).toFixed(0)} KB`);
  } catch (e) {
    failed += 1;
    report[name] = { error: String(e) };
    console.log(`\n${name}: ERROR ${String(e)}`);
  }
}
close();

mkdirSync(join(ROOT, 'captures/p0'), { recursive: true });
writeFileSync(join(ROOT, 'captures/p0/journal-device.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`\njournal:check: ${failed === 0 ? 'every check passes' : `${failed} failing`} — captures/p0/journal-device.json`);
process.exit(failed === 0 ? 0 : 1);
