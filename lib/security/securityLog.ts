// Security events (hardening item 18): one JSON line each, written to stdout,
// which Vercel keeps as runtime logs (1 hour on Hobby, 1 day on Pro). Server
// only — route handlers import this, components never do.
//
// What a line holds, and all it can hold: when, which event, its outcome and
// status, a fixed reason code, the route (a constant from the code, never the
// request's own path or query), the verified user id when the route already
// knows it, the client's address, its user agent and a request id.
//
// What it never holds: a body or anything read from one, a cookie, an
// Authorization header, a token, a query string, an email address. The record
// is built from the four headers read below and from the caller's fixed
// fields, and from nothing else, so no caller can add one by mistake. On
// /api/agent/reflect that is FR-3.6: a refused reflection is logged as its
// outcome, never as anything it carried.
//
// The address is the first x-forwarded-for hop. Vercel overwrites that header
// with the connecting client's address, so a client cannot choose it there;
// x-real-ip carries the same value. The request id is x-vercel-id, which
// names the regions the request passed through, or a fresh UUID.
//
// Every value a client supplies is cleaned before it is written: control
// characters, line and paragraph separators and bidi controls are removed,
// anything shaped like an email address or a token is masked, and the result
// is cut to length. JSON.stringify escapes what is left, so one event is one
// line and a header cannot forge a second.

import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

export type SecurityEventName =
  | 'csrf.refused'
  | 'request.unsupported_media_type'
  | 'request.too_large'
  | 'ai.quota_exceeded'
  | 'cron.unauthorised'
  | 'account.deletion'
  | 'auth.sign_out';

export type SecurityOutcome = 'refused' | 'succeeded' | 'failed';

/** Fixed codes from the code that refused the request — never a value from the request. */
export type SecurityReason =
  | 'origin_null'
  | 'origin_invalid'
  | 'origin_mismatch'
  | 'origin_missing'
  | 'referer_invalid'
  | 'referer_mismatch'
  | 'content_type'
  | 'declared_length'
  | 'body_length'
  | 'daily_limit'
  | 'secret_unset'
  | 'bad_credentials';

export interface SecurityEvent {
  event: SecurityEventName;
  /** The route as the code names it, e.g. '/api/agent/extract'. */
  route: string;
  outcome: SecurityOutcome;
  status: number;
  reason?: SecurityReason;
  /** The verified session's user id, when the route has one. Never read from the request. */
  userId?: string | null;
}

/** Anything with request headers: a Request, a NextRequest. */
export interface HeaderSource {
  readonly headers: { get(name: string): string | null };
}

export const MAX_USER_AGENT_CHARS = 256;
const MAX_ID_CHARS = 64;
const REQUEST_ID = /^[A-Za-z0-9:._-]{1,128}$/;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const JWT = /eyJ[\w-]*\.[\w-]+\.[\w-]*/g;
const BEARER = /\bbearer\s+\S+/gi;

/** C0 and C1 controls, DEL, lone surrogates, line and paragraph separators, bidi controls, BOM. */
function unsafe(codePoint: number): boolean {
  return (
    codePoint < 0x20 ||
    (codePoint >= 0x7f && codePoint <= 0x9f) ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
    codePoint === 0x200e ||
    codePoint === 0x200f ||
    codePoint === 0x2028 ||
    codePoint === 0x2029 ||
    (codePoint >= 0x202a && codePoint <= 0x202e) ||
    (codePoint >= 0x2066 && codePoint <= 0x2069) ||
    codePoint === 0xfeff
  );
}

/** A client-supplied value, safe to write: stripped, masked, cut to `max` characters. Null when nothing is left. */
export function cleanValue(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  const kept = Array.from(value)
    .filter((ch) => !unsafe(ch.codePointAt(0) ?? 0))
    .join('')
    .replace(EMAIL, '[email]')
    .replace(JWT, '[token]')
    .replace(BEARER, 'bearer [token]')
    .trim();
  const cut = Array.from(kept).slice(0, max).join('');
  return cut === '' ? null : cut;
}

/** The client's address: the first x-forwarded-for hop, else x-real-ip — and only a well-formed IP. */
export function clientIp(source: HeaderSource): string | null {
  const candidates = [source.headers.get('x-forwarded-for')?.split(',')[0], source.headers.get('x-real-ip')];
  for (const candidate of candidates) {
    const ip = candidate?.trim();
    if (ip && isIP(ip) !== 0) return ip;
  }
  return null;
}

/** x-vercel-id when it looks like one, else a fresh UUID. */
export function requestId(source: HeaderSource): string {
  const given = source.headers.get('x-vercel-id')?.trim();
  return given && REQUEST_ID.test(given) ? given : randomUUID();
}

export type LineWriter = (line: string) => void;

const toStdout: LineWriter = (line) => console.log(line);

/** Writes one line for one event. */
export function logSecurityEvent(source: HeaderSource, event: SecurityEvent, write: LineWriter = toStdout): void {
  const record = {
    timestamp: new Date().toISOString(),
    kind: 'security',
    event: event.event,
    outcome: event.outcome,
    status: event.status,
    reason: event.reason ?? null,
    route: cleanValue(event.route, MAX_ID_CHARS),
    user_id: cleanValue(event.userId, MAX_ID_CHARS),
    ip: clientIp(source),
    user_agent: cleanValue(source.headers.get('user-agent'), MAX_USER_AGENT_CHARS),
    request_id: requestId(source),
  };
  write(JSON.stringify(record));
}
