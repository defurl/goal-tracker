// The flags on every cookie the app sets (security item 19). Owner decision
// 2026-10-01: Secure, a 30-day idle expiry, the names unchanged, nobody signed
// out by the change. The three Supabase client factories — client.ts,
// server.ts and middleware.ts — run every write through sessionCookieWrites().
//
// Left alone, @supabase/ssr 0.12.7 writes Path=/, SameSite=Lax, no Secure and
// Max-Age 400 days, and it forces that Max-Age on every write: cookies.js
// spreads `cookieOptions` and then sets `maxAge: DEFAULT_COOKIE_OPTIONS.maxAge`.
// So the idle window cannot be passed in as an option; it is applied here, in
// each factory's setAll, after the library has decided what to write.
//
// What this cannot do:
//   - HttpOnly on the session. The browser client reads it from
//     document.cookie; only moving every query server-side would change that.
//   - The __Host- prefix. It would rename sb-<ref>-auth-token*, and renaming
//     signs everyone out.
//   - End the session itself. The cookie's expiry only makes a browser forget
//     it. The refresh token inside stays valid at Supabase until it is used,
//     revoked or signed out; time-boxes and inactivity timeouts for sessions
//     are Pro-plan settings (D-17: the project is on Free).

import type { CookieOptions } from '@supabase/ssr';

const DAY_SECONDS = 24 * 60 * 60;

/** The idle window when NEXT_PUBLIC_SESSION_IDLE_DAYS is unset or unusable. */
export const SESSION_IDLE_DAYS_DEFAULT = 30;

/** Browsers clamp Max-Age to 400 days (RFC 6265bis §5.5), so no longer window means anything. */
const COOKIE_DAYS_CEILING = 400;

/**
 * NEXT_PUBLIC_SESSION_IDLE_DAYS as a whole number of days in 1–400, or the
 * default. A bad value falls back rather than throwing: a typo in an env var
 * must not take sign-in down with it.
 */
export function sessionIdleDays(raw: string | undefined): number {
  const text = raw?.trim() ?? '';
  if (!/^\d+$/.test(text)) return SESSION_IDLE_DAYS_DEFAULT;
  const days = Number(text);
  return days >= 1 && days <= COOKIE_DAYS_CEILING ? days : SESSION_IDLE_DAYS_DEFAULT;
}

/**
 * How long a browser keeps its session without being used. The one place the
 * window is set. Every write re-arms it, and the session cookie is written at
 * sign-in and at every token refresh — the first request after the access
 * token lapses (the JWT expiry, an hour by default) — so a browser in use is
 * re-armed at least hourly, and an idle one forgets its session this long
 * after its last refresh. A literal process.env expression, so Next inlines it
 * into the browser and middleware bundles alike.
 */
export const SESSION_IDLE_SECONDS =
  sessionIdleDays(process.env.NEXT_PUBLIC_SESSION_IDLE_DAYS) * DAY_SECONDS;

/**
 * The PKCE verifier cookies (`…-code-verifier`: the fixed key, each flow's
 * slot and the flow index) live only as long as the round trip they serve.
 * An hour outlasts a Google sign-in and the longest email link the Supabase
 * checklist allows (Email OTP Expiration ≤ 3600 s). The callback deletes them
 * on use; this bounds the ones a flow abandons.
 */
export const FLOW_MAX_AGE_SECONDS = 60 * 60;

/** bbe_room is a preference, not a credential: it keeps its year. */
export const ROOM_MAX_AGE_SECONDS = 365 * DAY_SECONDS;

/**
 * Whether the page was served over HTTPS, so its cookies can be Secure.
 *
 * Decided per request rather than per build: `next start` in CI, the review
 * captures and dev on a phone over the LAN are production builds on plain
 * http, where a Secure cookie would be refused and sign-in would quietly stop
 * working. On Vercel both signals say https. The first X-Forwarded-Proto value
 * is the client's own connection; a client that forges it only changes the
 * flags on cookies sent back to itself.
 */
export function isHttps({
  forwardedProto,
  protocol,
}: {
  forwardedProto?: string | null;
  protocol?: string | null;
}): boolean {
  const first = forwardedProto?.split(',')[0]?.trim().toLowerCase();
  return first === 'https' || protocol === 'https:';
}

export interface CookieWrite {
  name: string;
  value: string;
  options: CookieOptions;
}

interface Policy {
  secure: boolean;
  /** For tests. Everywhere else the window is SESSION_IDLE_SECONDS. */
  idleSeconds?: number;
}

const CHUNK_SUFFIX = /^(.*)\.(0|[1-9][0-9]*)$/;

/** The storage key a cookie belongs to: `sb-x-auth-token.1` → `sb-x-auth-token`. */
function itemKey(name: string): string {
  return CHUNK_SUFFIX.exec(name)?.[1] ?? name;
}

/** @supabase/ssr deletes with an empty value and Max-Age 0. */
function isRemoval({ value, options }: CookieWrite): boolean {
  return value === '' || options.maxAge === 0;
}

/**
 * The flags for one Supabase cookie, whatever the library proposed. Built
 * fresh rather than merged, so nothing it adds can loosen them. No Domain:
 * host-only, as the site has always been.
 */
export function sessionCookieOptions(
  write: CookieWrite,
  { secure, idleSeconds = SESSION_IDLE_SECONDS }: Policy,
): CookieOptions {
  const maxAge = isRemoval(write)
    ? 0
    : write.name.endsWith('-code-verifier')
      ? FLOW_MAX_AGE_SECONDS
      : idleSeconds;
  return { path: '/', sameSite: 'lax', secure, httpOnly: false, maxAge };
}

/**
 * What a factory's setAll should write: the library's batch with the policy
 * applied, plus every unchanged chunk of a session it just rewrote.
 *
 * Those chunks are the reason this is more than a map. On the server,
 * @supabase/ssr skips a chunk whose value did not change (applyServerStorage,
 * `currentByName.get(name) !== value`). After a refresh only the tokens at the
 * front change; the tail chunk, which holds the user object, is usually
 * byte-identical, so it would keep its old expiry and lapse first. A session
 * missing a chunk decodes to nothing — a sign-out of someone using the app
 * every day. Re-issuing it with its current value keeps every chunk on the
 * same window. `current` is the cookie jar before this batch is written.
 */
export function sessionCookieWrites(
  batch: readonly CookieWrite[],
  current: readonly { name: string; value: string }[],
  policy: Policy,
): CookieWrite[] {
  const named = new Set(batch.map((write) => write.name));
  const rewritten = new Set(batch.filter((write) => !isRemoval(write)).map((write) => itemKey(write.name)));
  const unchanged = current
    .filter(({ name, value }) => value !== '' && !named.has(name) && rewritten.has(itemKey(name)))
    .map(({ name, value }) => ({ name, value, options: {} }));

  return [...batch, ...unchanged].map((write) => ({
    name: write.name,
    value: write.value,
    options: sessionCookieOptions(write, policy),
  }));
}

/**
 * bbe_room — set by middleware.ts when /text's "enter the room" link is
 * followed, and read only by middleware.ts, so no script needs to see it.
 */
export function roomCookieOptions(secure: boolean): CookieOptions {
  return { path: '/', sameSite: 'lax', secure, httpOnly: true, maxAge: ROOM_MAX_AGE_SECONDS };
}
