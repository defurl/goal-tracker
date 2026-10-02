// The shared guard for every cookie-authenticated, state-changing route
// (hardening items 2 and 11). Each guarded handler calls screen() before it
// does anything else and, if it takes a body, readJson() once it knows the
// caller. Server only.
//
// CSRF. The session lives in Supabase's SameSite=Lax cookies, which a browser
// leaves off a cross-site POST or DELETE: that is the first line. This is the
// second. A write must say where it came from, and that must be here: Origin
// is compared with the request's own origin — the scheme and host the browser
// used (x-forwarded-proto with x-forwarded-host or host, which Vercel sets and
// a cross-site page cannot) and request.url's — plus CSRF_TRUSTED_ORIGINS.
// Referer stands in only when Origin is absent. `Origin: null` (a sandboxed
// frame, a data: URL, a cross-origin redirect) is refused, and so is a write
// that names no origin at all. It is the model of Next's own server-action
// check, Origin against x-forwarded-host or host plus allowedOrigins; the App
// Router has nothing of the kind for route handlers, and no token is added
// because nothing a cross-site page can send gets past this.
//
// A JSON route also requires Content-Type: application/json (415 otherwise),
// so a cross-site <form enctype="text/plain"> cannot deliver a JSON-shaped
// body, and a cross-origin fetch that sets the type needs a CORS preflight
// that no route answers.
//
// Size. A body is capped before it is parsed: a declared Content-Length over
// the route's cap is refused at once, and a body without one (chunked) is read
// with a running count and abandoned the moment it passes the cap — 413 either
// way, and the JSON parser never runs. The caps are in lib/security/limits.ts.
// Above the app: Vercel refuses a function body over 4.5 MB (413
// FUNCTION_PAYLOAD_TOO_LARGE) and a header over 16 KB, or 32 KB of headers
// (431), and stops a function at its maxDuration. Self-hosted, Node refuses
// 16 KiB of headers, and Next 14 buffers a non-GET body for middleware.ts
// before the route runs, so there a proxy's body limit bounds memory.
//
// Not guarded, because each has its own verification and neither acts on a
// cookie a cross-site page could ride:
//   GET /api/cron/seed-challenges  a bearer CRON_SECRET; it reads no session
//   GET /auth/callback             PKCE: a code is redeemed only with the
//                                  code-verifier cookie of the browser that
//                                  began the sign-in, so a planted code fails
// Every other write goes from the browser to Supabase with a bearer JWT, which
// a cross-site page cannot attach. There are no server actions.

import { bodyLimit, type BodyLimit } from './limits.ts';

/** How a guarded route is screened. */
export interface GuardPolicy {
  /** The route as logged and documented — a constant, never the request's own path. */
  route: string;
  /** The route reads a JSON body, so it requires Content-Type: application/json. */
  json: boolean;
  /** Which byte cap its body is held to (lib/security/limits.ts). */
  limit: BodyLimit;
}

/** Every cookie-authenticated, state-changing handler — and tests/unit/requestGuard.test.ts checks there are no others. */
export const GUARDED = {
  extract: { route: '/api/agent/extract', json: true, limit: 'extract' },
  reflect: { route: '/api/agent/reflect', json: true, limit: 'reflect' },
  // Neither reads a body. Sign-out is a plain form post.
  account: { route: '/api/account', json: false, limit: 'other' },
  signOut: { route: '/auth/signout', json: false, limit: 'other' },
} as const satisfies Record<string, GuardPolicy>;

type Env = Readonly<Record<string, string | undefined>>;

/** The origin of an http(s) URL, or null for anything else. */
export function httpOrigin(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Origins allowed to write besides the request's own: CSRF_TRUSTED_ORIGINS,
 * comma-separated. Empty by default — the app only ever calls itself. An entry
 * that is not an http(s) origin (`*`, `null`, a typo) is dropped, never read
 * as "anything".
 */
export function trustedOrigins(env: Env = process.env): string[] {
  return (env.CSRF_TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((entry) => (entry.trim() === '' ? null : httpOrigin(entry.trim())))
    .filter((origin): origin is string => origin !== null);
}

function firstHop(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim();
  return first ? first : null;
}

/** The origins this request was addressed to: as the browser used it, and as Next resolved it. */
export function ownOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const resolved = httpOrigin(request.url);
  if (resolved) origins.add(resolved);
  const scheme = firstHop(request.headers.get('x-forwarded-proto')) ?? new URL(request.url).protocol.slice(0, -1);
  for (const host of [firstHop(request.headers.get('x-forwarded-host')), request.headers.get('host')]) {
    const origin = host ? httpOrigin(`${scheme}://${host}`) : null;
    if (origin) origins.add(origin);
  }
  return origins;
}

export type OriginVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: 'origin_null' | 'origin_invalid' | 'origin_mismatch' | 'origin_missing' | 'referer_invalid' | 'referer_mismatch';
    };

/** Origin — or, only when it is absent, Referer — must name this site or a trusted origin. */
export function checkOrigin(request: Request, trusted: readonly string[] = trustedOrigins()): OriginVerdict {
  const allowed = ownOrigins(request);
  for (const origin of trusted) allowed.add(origin);

  const origin = request.headers.get('origin');
  if (origin !== null) {
    if (origin.trim().toLowerCase() === 'null') return { ok: false, reason: 'origin_null' };
    const claimed = httpOrigin(origin.trim());
    if (!claimed) return { ok: false, reason: 'origin_invalid' };
    return allowed.has(claimed) ? { ok: true } : { ok: false, reason: 'origin_mismatch' };
  }

  const referer = request.headers.get('referer');
  if (referer !== null) {
    const claimed = httpOrigin(referer.trim());
    if (!claimed) return { ok: false, reason: 'referer_invalid' };
    return allowed.has(claimed) ? { ok: true } : { ok: false, reason: 'referer_mismatch' };
  }

  return { ok: false, reason: 'origin_missing' };
}

/** application/json, with no charset or UTF-8's. Anything else is a body this app never sends. */
export function isJsonContentType(value: string | null): boolean {
  if (value === null) return false;
  const [type, ...params] = value.split(';');
  if (type?.trim().toLowerCase() !== 'application/json') return false;
  return params.every((param) => {
    const [name, raw = ''] = param.split('=');
    if (name?.trim().toLowerCase() !== 'charset') return true;
    const charset = raw.trim().replace(/^"(.*)"$/, '$1').toLowerCase();
    return charset === 'utf-8' || charset === 'utf8';
  });
}

/** A refusal in the shape of app/api/_lib/server.ts's json(): a plain code, never cached. */
function refusal(status: number, error: string): Response {
  return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/** Content-Length as a number; null when absent or unreadable, where the running count still holds. */
export function declaredLength(request: Request): number | null {
  const raw = request.headers.get('content-length')?.trim();
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

/** Null when the request may proceed; otherwise the response that refuses it. */
export function screen(request: Request, policy: GuardPolicy, env: Env = process.env): Response | null {
  const origin = checkOrigin(request, trustedOrigins(env));
  if (!origin.ok) return refusal(403, 'forbidden');
  if (policy.json && !isJsonContentType(request.headers.get('content-type'))) {
    return refusal(415, 'unsupported_media_type');
  }
  const declared = declaredLength(request);
  if (declared !== null && declared > bodyLimit(policy.limit, env)) return refusal(413, 'too_large');
  return null;
}

export type BodyRead = { ok: true; bytes: Uint8Array } | { ok: false; reason: 'too_large' | 'unreadable' };

/**
 * The body, counted as it arrives and abandoned the moment it passes `limit`
 * bytes, so no more than `limit` is ever held. A declared Content-Length over
 * the limit is refused before a byte is read.
 */
export async function readBodyWithin(request: Request, limit: number): Promise<BodyRead> {
  const declared = declaredLength(request);
  if (declared !== null && declared > limit) return { ok: false, reason: 'too_large' };
  if (request.body === null) return { ok: true, bytes: new Uint8Array(0) };

  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > limit) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes };
}

/** JSON, or undefined for a body that is not — never echoed back or logged. */
export function parseJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
}

export type JsonRead = { ok: true; value: unknown } | { ok: false; response: Response };

/**
 * The route's JSON body, read within its cap. Over the cap: a 413 to return,
 * and the parser never runs. A body that is not JSON, or that broke off,
 * reads as undefined, which the route's schema refuses (400).
 */
export async function readJson(request: Request, policy: GuardPolicy, env: Env = process.env): Promise<JsonRead> {
  const body = await readBodyWithin(request, bodyLimit(policy.limit, env));
  if (body.ok) return { ok: true, value: parseJson(body.bytes) };
  if (body.reason === 'unreadable') return { ok: true, value: undefined };
  return { ok: false, response: refusal(413, 'too_large') };
}
