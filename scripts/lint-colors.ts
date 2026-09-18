/**
 * lint:colors — fails the build on any hex literal outside the token palette.
 *
 * design-system/01-color-palette.md: "Do not add hex literals. Derive from a
 * token at runtime." CLAUDE.md non-negotiable 3 requires this lint to ship in
 * Phase 0, before any scene code, because it is cheap now and expensive to
 * retrofit once hexes have spread.
 *
 * The palette is read from lib/style/colors.ts — the TypeScript mirror — so the
 * lint cannot drift from the palette it is enforcing. Add a colour by adding a
 * token to all three mirrors, never by widening the allowlist here.
 *
 * It also holds the three mirrors to each other. `01-color-palette.md` says
 * "change one, change all three" and nothing enforced it: `design-spec.jsonc`
 * is never parsed by the build, so a syntax error or a stale value there passed
 * every check silently. Both are checked here now.
 *
 * Usage:  pnpm lint:colors
 *         pnpm lint:colors --verbose    list every file scanned
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const VERBOSE = process.argv.includes('--verbose');

/** Directories that are never scanned. */
const SKIP_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'out',
  'coverage',
  'captures',
  'playwright-report',
  'test-results',
  // Extracted reference material from the portfolio. Not shipped, and it
  // legitimately contains the portfolio's own literals.
  'design-system',
]);

const SCAN_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css', '.json', '.jsonc', '.svg'];

/**
 * This file. It holds the sanctioned literals by definition, so scanning it
 * would report them against itself. Nothing else is exempt — if you find
 * yourself adding a second entry here, you are widening the palette by the back
 * door and the answer is a token in all three mirrors instead.
 */
const SKIP_FILES = new Set(['scripts/lint-colors.ts']);

/**
 * The literals sanctioned by 01-color-palette.md — the drawer walnut (two tones)
 * and the brass handle. Allowed ONLY in scene objects, not repo-wide: the point of
 * naming them is that they are exceptions, not a second palette.
 */
const SANCTIONED_LITERALS: Record<string, RegExp> = {
  '#221811': /^scene\/objects\//, // drawer walnut
  '#2C1F17': /^scene\/objects\//, // drawer walnut, second tone
  '#B8860B': /^scene\/objects\//, // brass handle
};

const HEX = /#[0-9a-fA-F]{3,8}\b/g;

/** The three mirrors. `design-system/tokens/` is the archived extraction (D-21). */
const TS_MIRROR = 'lib/style/colors.ts';
const CSS_MIRROR = 'styles/tokens.css';
const JSONC_MIRROR = 'design-spec.jsonc';

/**
 * Strip `//` comments from JSONC without touching `//` inside string values —
 * the palette is full of URLs, so a naive regex corrupts the file it is meant
 * to validate.
 */
function stripJsonComments(source: string): string {
  const BACKSLASH = String.fromCharCode(92);
  let out = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i++) {
    const c = source[i] as string;

    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === BACKSLASH) escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    if (c === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
      continue;
    }
    out += c;
  }
  return out;
}

/** `--bg-panel-2` -> `BG_PANEL_2`, the name the TypeScript mirror uses. */
function cssVarToConst(name: string): string {
  return name.replace(/^--/, '').replace(/-/g, '_').toUpperCase();
}

const IS_HEX = /^#[0-9a-fA-F]{6}$/;

/** Colour tokens from the TypeScript mirror, keyed by CSS variable name. */
function readTsMirror(): Map<string, string> {
  const source = readFileSync(join(ROOT, TS_MIRROR), 'utf8');
  const out = new Map<string, string>();
  for (const m of source.matchAll(/^export const (\w+) = '(#[0-9a-fA-F]{6})';$/gm)) {
    out.set(m[1] as string, (m[2] as string).toUpperCase());
  }
  return out;
}

/** Colour tokens from the CSS mirror. Non-colour tokens are skipped. */
function readCssMirror(): Map<string, string> {
  const source = readFileSync(join(ROOT, CSS_MIRROR), 'utf8');
  const out = new Map<string, string>();
  for (const m of source.matchAll(/^\s*(--[a-z0-9-]+):\s*(#[0-9a-fA-F]{6});/gm)) {
    out.set(cssVarToConst(m[1] as string), (m[2] as string).toUpperCase());
  }
  return out;
}

/**
 * Colour tokens from the JSONC contract. Throws if the file does not parse —
 * which is half the reason this check exists.
 */
function readJsoncMirror(): Map<string, string> {
  const source = readFileSync(join(ROOT, JSONC_MIRROR), 'utf8');
  let parsed: { color?: { css_variables?: Record<string, string> } };
  try {
    parsed = JSON.parse(stripJsonComments(source));
  } catch (err) {
    throw new Error(
      `${JSONC_MIRROR} does not parse: ${(err as Error).message}` +
        '\n  It is the third palette mirror and the contract the other two answer to.' +
        '\n  Nothing else in the build reads it, so this is the only thing standing' +
        '\n  between a stray comma and a silently broken contract.',
    );
  }

  const vars = parsed.color?.css_variables;
  if (!vars) {
    throw new Error(`${JSONC_MIRROR} parses but has no color.css_variables block`);
  }

  const out = new Map<string, string>();
  for (const [name, value] of Object.entries(vars)) {
    if (IS_HEX.test(value)) out.set(cssVarToConst(name), value.toUpperCase());
  }
  return out;
}

/** Every disagreement between the three mirrors, as human-readable lines. */
function compareMirrors(): string[] {
  const ts = readTsMirror();
  const css = readCssMirror();
  const jsonc = readJsoncMirror();

  const problems: string[] = [];
  const everyToken = new Set([...ts.keys(), ...css.keys(), ...jsonc.keys()]);

  for (const token of [...everyToken].sort()) {
    const seen: [string, string | undefined][] = [
      [TS_MIRROR, ts.get(token)],
      [CSS_MIRROR, css.get(token)],
      [JSONC_MIRROR, jsonc.get(token)],
    ];

    const missing = seen.filter(([, v]) => v === undefined).map(([f]) => f);
    if (missing.length > 0) {
      problems.push(`${token} is missing from: ${missing.join(', ')}`);
      continue;
    }

    const values = new Set(seen.map(([, v]) => v as string));
    if (values.size > 1) {
      problems.push(
        `${token} disagrees — ` + seen.map(([f, v]) => `${f}: ${v}`).join(' · '),
      );
    }
  }
  return problems;
}

function loadPalette(): Set<string> {
  const source = readFileSync(join(ROOT, TS_MIRROR), 'utf8');

  // Only `export const NAME = '#RRGGBB'` counts. Matching every hex in the file
  // would let a value mentioned in a COMMENT -- a rejected candidate, a worked
  // example -- quietly become an allowed colour, which is the opposite of what
  // this lint is for.
  const found = [...source.matchAll(/^export const \w+ = '(#[0-9a-fA-F]{6})';$/gm)].map(
    (m) => m[1] as string,
  );
  if (found.length === 0) {
    throw new Error(`lint:colors: no exported palette constants found in ${TS_MIRROR}`);
  }
  return new Set(found.map((h) => h.toUpperCase()));
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (SCAN_EXT.some((ext) => entry.endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

interface Violation {
  file: string;
  line: number;
  column: number;
  value: string;
  text: string;
}

function main(): void {
  const palette = loadPalette();

  // Parses design-spec.jsonc and holds the three mirrors to each other. Throws
  // if the JSONC is malformed — that is a hard failure, not a list of findings.
  const mirrorProblems = compareMirrors();

  const files = walk(ROOT);
  const violations: Violation[] = [];

  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join('/');
    if (SKIP_FILES.has(rel)) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);

    lines.forEach((text, i) => {
      for (const match of text.matchAll(HEX)) {
        const value = match[0].toUpperCase();
        if (palette.has(value)) continue;

        const scope = SANCTIONED_LITERALS[value];
        if (scope && scope.test(rel)) continue;

        violations.push({
          file: rel,
          line: i + 1,
          column: (match.index ?? 0) + 1,
          value: match[0],
          text: text.trim(),
        });
      }
    });
  }

  if (VERBOSE) {
    console.log(`lint:colors — ${files.length} files scanned, ${palette.size} palette values`);
  }

  if (violations.length === 0 && mirrorProblems.length === 0) {
    console.log(
      `lint:colors: clean (${files.length} files, ${palette.size} palette values, 3 mirrors agree)`,
    );
    return;
  }

  if (mirrorProblems.length > 0) {
    console.error('\nlint:colors: the three palette mirrors disagree\n');
    for (const p of mirrorProblems) console.error(`  ${p}`);
    console.error(
      '\n01-color-palette.md: "change one, change all three" —\n' +
        `  ${CSS_MIRROR} | ${TS_MIRROR} | ${JSONC_MIRROR}`,
    );
  }

  if (violations.length > 0) {
    console.error(
      `\nlint:colors: ${violations.length} hex literal(s) outside the token palette\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.file}:${v.line}:${v.column}  ${v.value}`);
      console.error(`    ${v.text}`);
    }
    console.error(
      '\nDerive from a token instead — design-system/01-color-palette.md, "Deriving new colours".',
    );
    console.error('If the colour is genuinely new, add it to ALL THREE mirrors:');
    console.error(`  ${CSS_MIRROR} | ${TS_MIRROR} | ${JSONC_MIRROR}`);
  }

  console.error('');
  process.exit(1);
}

try {
  main();
} catch (err) {
  // A malformed mirror is a failure with one cause and one fix. A stack trace
  // buries both.
  console.error(`\nlint:colors: ${(err as Error).message}\n`);
  process.exit(1);
}
