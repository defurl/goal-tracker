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

function loadPalette(): Set<string> {
  const source = readFileSync(join(ROOT, 'lib/style/colors.ts'), 'utf8');
  const found = source.match(/#[0-9a-fA-F]{6}\b/g);
  if (!found || found.length === 0) {
    throw new Error('lint:colors: no palette values found in lib/style/colors.ts');
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

  if (violations.length === 0) {
    console.log(`lint:colors: clean (${files.length} files, ${palette.size} palette values)`);
    return;
  }

  console.error(`\nlint:colors: ${violations.length} hex literal(s) outside the token palette\n`);
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}:${v.column}  ${v.value}`);
    console.error(`    ${v.text}`);
  }
  console.error(
    '\nDerive from a token instead — design-system/01-color-palette.md, "Deriving new colours".',
  );
  console.error('If the colour is genuinely new, add it to ALL THREE mirrors:');
  console.error('  styles/tokens.css · lib/style/colors.ts · design-spec.jsonc\n');
  process.exit(1);
}

main();
