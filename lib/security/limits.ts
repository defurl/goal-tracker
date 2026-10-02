// Request body caps, in bytes (hardening item 11), checked before a body is
// parsed (lib/security/requestGuard.ts). Each comes from the environment when
// that holds a positive integer, else from the schema it guards: the most
// bytes a body can take while every string in it is within its schema's
// maximum, so the cap never refuses a body the schema would accept.

import { MAX_ENTRY_CHARS, MOOD_KEYS, TOPIC_TAGS } from '../journal/moods.ts';

type Env = Readonly<Record<string, string | undefined>>;

/**
 * The most bytes one UTF-16 code unit takes in JSON.stringify's output: a
 * \uXXXX escape, which it writes for control characters and lone surrogates.
 * UTF-8 alone needs at most three.
 */
export const JSON_BYTES_PER_CHAR = 6;

/** Keys, quotes, commas and brackets, with room to spare. */
export const JSON_OVERHEAD_BYTES = 1024;

/** ExtractInput's maxima (lib/agents/extract.ts), mirrored; tests/unit/requestGuard.test.ts holds them to the schema. */
export const EXTRACT_URL_MAX_CHARS = 2048;
export const EXTRACT_TEXT_MAX_CHARS = 50_000;

/** The most bytes a JSON body takes whose strings hold `chars` UTF-16 code units in all. */
export function jsonBodyBytes(chars: number): number {
  return chars * JSON_BYTES_PER_CHAR + JSON_OVERHEAD_BYTES;
}

const longest = (values: readonly string[]) => Math.max(0, ...values.map((value) => value.length));
const total = (values: readonly string[]) => values.reduce((sum, value) => sum + value.length, 0);

export const DEFAULT_BODY_LIMITS = {
  /** { url, text } at their maxima: 313,312 bytes. */
  extract: jsonBodyBytes(EXTRACT_URL_MAX_CHARS + EXTRACT_TEXT_MAX_CHARS),
  /** { entry_text, mood, tags } at their maxima: 13,408 bytes. */
  reflect: jsonBodyBytes(MAX_ENTRY_CHARS + longest(MOOD_KEYS) + total(TOPIC_TAGS)),
  /** The other guarded routes read no body; sign-out's form posts an empty one. */
  other: 1024,
} as const;

export type BodyLimit = keyof typeof DEFAULT_BODY_LIMITS;

export const BODY_LIMIT_ENV: Record<BodyLimit, string> = {
  extract: 'BODY_LIMIT_EXTRACT_BYTES',
  reflect: 'BODY_LIMIT_REFLECT_BYTES',
  other: 'BODY_LIMIT_DEFAULT_BYTES',
};

/** A route's cap: its environment override when that is a positive integer, else its default. */
export function bodyLimit(key: BodyLimit, env: Env = process.env): number {
  const raw = env[BODY_LIMIT_ENV[key]]?.trim();
  const value = raw && /^\d+$/.test(raw) ? Number(raw) : 0;
  return Number.isSafeInteger(value) && value > 0 ? value : DEFAULT_BODY_LIMITS[key];
}
