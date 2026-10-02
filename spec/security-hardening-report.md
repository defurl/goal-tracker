# Security hardening — report

**For:** `spec/security-hardening-prompt.md` (the 20 controls)
**Done:** 2026-10-01/02, on local `main` (`6c116e6..dc575b9`, 45 commits). **Not pushed.**
**Status:** the code is merged and every gate passes locally. Migrations 026–028 and the
dashboard settings below are **not yet on the hosted project** — see §4.

Owner decisions taken before the work started (2026-10-01):

- Security events log IP + user agent, and /privacy says so.
- Session cookies: Secure + a 30-day idle expiry, cookie names unchanged, no forced sign-out.
- No CAPTCHA; brute-force protection is Supabase's own limits, tightened.

---

## 1. Stack inventory

| layer | what |
|---|---|
| language / framework | TypeScript, Next.js 14.2.35 App Router, React 18, R3F for the room |
| auth | Supabase Auth (managed), Free plan — email + password, Google OAuth behind a flag, PKCE. **Sign-in runs browser → Supabase; the app's server never sees a password.** Sessions are `@supabase/ssr` cookies, refreshed in `middleware.ts` |
| database | Supabase Postgres 17, RLS on all 13 tables, reached only through PostgREST (`anon`, `authenticated`) and the server-only service role |
| hosting | Vercel (Linux), auto-deploys from `main`; `be-better-everyday-one.vercel.app` |
| payments | none (out of scope, D-24) |
| uploads | none — imports are a URL or pasted text |
| LLM | Gemini `gemini-2.5-flash-lite`, free tier, no billing attached; two agents (import, journal — the journal agent is off in production) |

## 2. Status

| # | Control | Status | What changed (files) | Tests added | Notes / manual actions |
|---|---|---|---|---|---|
| 1 | HSTS | Already present (platform) | `next.config.mjs` comment only | `edgeHeaders.test.ts` (no app HSTS); `security:headers` asserts HSTS on https | Vercel sends `max-age=63072000; includeSubDomains; preload` on `*.vercel.app`; HTTP→HTTPS is a 308. An app header would replace that stronger value. A custom domain needs a host-scoped header (§4) |
| 2 | CSRF | Done (Origin/Referer, not tokens) | `lib/security/requestGuard.ts`; the four state-changing routes | `requestGuard.test.ts` incl. a structural test that every POST/PUT/PATCH/DELETE route screens first | Same-origin check, `null` and missing Origin+Referer refused (403), JSON routes need `application/json` (415). Exempt: `GET /api/cron/seed-challenges` (bearer secret, no cookies), `GET /auth/callback` (PKCE). The App Router has no route-handler CSRF mechanism |
| 3 | Reset sessions on password change | Already present (Supabase) | `supabase/config.toml`: `secure_password_change` | `supabase/tests/sessions.test.ts` | Other sessions' refresh fails, `getUser()` refuses them, old password fails. **Gap:** their access token still works at PostgREST until expiry (≤ 1 h). No password-change UI exists. Notification email: manual |
| 4 | Expire reset links | Already present (Supabase) | `config.toml`: `otp_expiry = 1800`, `otp_length = 10` | one-off probe (D) | Single-use, superseded by a newer link, voided by a password change. Hosted expiry is 3600 s until set to 1800 (§4) |
| 5 | User enumeration | Partial | `app/(auth)/authMessages.ts`, `AuthForm.tsx` | `authMessages.test.ts` | The UI no longer tells. Supabase's API still has tells we can't change (look-alike user has `identities: []`, no bcrypt for unknown emails). "Email the existing owner" needs our own sign-up route |
| 6 | Whitelist upload types | N/A | — | — | No uploads. Imports are fetched server-side: SSRF guard, HTML only, 2 MB, 8 s |
| 7 | Verify payment webhooks | N/A | — | — | No payments |
| 8 | Server-side prices | N/A | — | — | No payments |
| 9 | Prompt injection | Done (prompt V3 PROPOSED) | `lib/prompts/contentExtraction.ts` (V3), `lib/agents/run.ts`, spec/04 §9 | `injection.test.ts` (13) + gemini/prompts/agents tests | No tools; system/user separate; the article goes to the model as escaped JSON data; output schema-checked; text-only rendering. Injected input or hostile output reaches no privileged path. V3 not yet run against the live model |
| 10 | Cap AI usage | Partial | `lib/agents/limits.ts`; spec/04 §6 | 11 in `agents.test.ts` | Already present: auth, per-plan daily caps → 429 + Retry-After, input caps, output-token caps, timeouts, per-user `agent_logs`. Global ceiling = free tier with no billing. **Not built:** in-app circuit breaker, spike alerting |
| 11 | Limit request size | Done (app + Vercel) | `lib/security/limits.ts`, `requestGuard.ts`; `maxDuration` on account/sign-out | `requestGuard.test.ts` (parser never runs on 413) | Per-route byte caps from env, enforced before parsing, declared or chunked. Header limits are Vercel's (431). Self-hosted would need a proxy body limit |
| 12 | Rate-limit password resets | Requires manual action | `config.toml` comments | — | Supabase-side only (§4): per-user interval 900 s, custom SMTP, email cap |
| 13 | Validate input | Done | `z.strictObject` + http(s)-only URL in `lib/agents/{extract,reflect}.ts`; 026 column grants; 028 timezone | `agents.test.ts`, `privileges.test.ts`, `timezone.test.ts` | Raw-HTML sinks: none. Dynamic SQL: none. Shell from input: none. Readability output is `textContent`, never rendered |
| 14 | CORS | Done | `next.config.mjs` comment | `edgeHeaders.test.ts`; `security:headers` | API and auth routes send no CORS headers to any origin incl. `null`. Vercel's CDN adds `ACAO: *` to static/prerendered output only — public, identical for all, no credentials: justified, not overridden |
| 15 | Directory listing | Already present | — | `security:headers` | Directories, `.env`, `.git`, source maps → 403/404. No storage buckets (confirm in dashboard) |
| 16 | Default admin routes | Done | `next.config.mjs` (`images.unoptimized`, `poweredByHeader: false`); `027_drop_graphql.sql` | `edgeHeaders.test.ts`; `exposure.test.ts` | No admin/debug/seed routes. `/_next/image` now 404. GraphQL dropped; `/rest/v1/` OpenAPI shows anon nothing. Cron route: timing-safe bearer secret |
| 17 | Lock accounts | Partial (blocked by plan) | — | — | Supabase has no lockout; per-IP limits only. Per-account lockout needs the Teams-plan password-verification hook. CAPTCHA declined |
| 18 | Log security events | Done for what the app sees | `lib/security/securityLog.ts`, six routes, `/privacy` line | `securityLog.test.ts` | JSON lines: `csrf.refused`, `request.unsupported_media_type`, `request.too_large`, `ai.quota_exceeded`, `cron.unauthorised`, `account.deletion`, `auth.sign_out`. Control chars stripped, emails/tokens masked, no bodies/cookies/auth headers; reflect logs only the refusal. Sign-in events live in Supabase's auth log. Alerting: manual (§4) |
| 19 | Secure cookie flags | Done to the owner's decision; Partial to the checklist | `lib/supabase/cookies.ts`, `client.ts`, `server.ts`, `middleware.ts` | `sessionCookies.test.ts` (22, three drive the real clients) | Session: Lax, Path=/, Secure on https, 30-day sliding expiry. **Not HttpOnly** — the browser client reads it. No `__Host-` (names unchanged). `bbe_room`: + HttpOnly + Secure. Fixed a chunk-expiry bug that would have signed daily users out |
| 20 | Restrict DB permissions | Done locally; hosted push is manual | `026_least_privilege.sql`, spec/03 §7 | `privileges.test.ts` (17) | `anon`: nothing. `authenticated`: SELECT + column-level writes the app uses, no DELETE/TRUNCATE. Future tables start closed. Migrations run as `postgres`, runtime as PostgREST roles |

### Cookie inventory (item 19)

| cookie | set by | flags after | lifetime |
|---|---|---|---|
| `sb-<ref>-auth-token` (+ `.0`/`.1`) | browser client, middleware, route handlers | `Path=/; SameSite=Lax`, Secure on https, not HttpOnly | 30 days, re-armed on every refresh |
| `…-code-verifier` (PKCE) | browser client | same | 1 hour |
| `bbe_room` | middleware | `Path=/; SameSite=Lax; HttpOnly`, Secure on https | 1 year |

### Gates on the merged `main`

lint, lint:colors, typecheck, unit 322/322, test:db 106/106, generated types unchanged,
build, bundle (shell 188.4 / 200 KB gz). Against a local production build:
`security:headers` and `offline:check` pass, the room renders with no console errors.

## 3. User-visible behaviour changes

- **A browser idle for 30 days is signed out.** Active users never notice; nobody is signed out by the deploy.
- **New auth messages.** One message for unknown email and wrong password; sign-up with an existing address reads like a normal sign-up. The review board's login-error capture will change.
- **New refusals:** 403 (forged origin), 415 (wrong content type), 413 (too large), 400 for unknown fields or a non-http(s) import URL. The app's own requests hit none of them. A paste over ~313 KB now fails as "the connection dropped" (see §5).
- The app can no longer be framed; `/_next/image` is gone (unused).
- An invalid browser timezone is no longer stored (falls back to UTC).

## 4. Manual actions (outside the repo)

**Before or with the push**

1. **Vercel → Environment variables: `ENABLE_EXPERIMENTAL_COREPACK=1`** (all environments), so Vercel installs with the pinned pnpm 11. The postcss override lives in `pnpm-workspace.yaml`, which pnpm 9 ignores — and would then fail the frozen install. If a deploy fails at install, the last good one stays live.
2. **Supabase: push 026–028.** `supabase db push --dry-run` (expect 026, 027, 028), then `supabase db push`. Verify: `select extname from pg_extension where extname = 'pg_graphql';` → no row; `curl https://<ref>.supabase.co/rest/v1/ -H "apikey: <anon>"` → paths only `/`.
3. **Never run `supabase config push`.** The local `config.toml` has email confirmation off; pushed, it would turn it off on the hosted project.

**Supabase dashboard (Authentication)**

4. **Custom SMTP — launch blocker.** The built-in sender only mails the project's team members (2/hour). With confirmations on, public sign-up does not work until this is set.
5. Confirm email **on**; confirm phone **on** (even with phone sign-in off — otherwise repeat sign-ups say "User already registered"); secure email change **on**; secure password change **on**.
6. Email OTP expiration **1800 s**; OTP length **10**.
7. Minimum password length **12**, no composition rules. Then change `AuthForm`'s `minLength={8}` to 12.
8. Rate limits: per-user password-reset interval **900 s**; token verifications **15 / 5 min / IP**; keep sign-ins/sign-ups at 30 and the token endpoint at 150 (they share Vercel's IPs); emails sent to expected volume once SMTP is custom.
9. Sessions: refresh-token rotation **on**, reuse interval 10 s; consider JWT expiry **1800 s** to halve item 3's gap.
10. Security notifications: **Password changed** on (and Email address changed).
11. Auth → Logs: use the audit log for sign-in failures; alert on spikes.

**Supabase project / account**

12. Database → Network Restrictions: allow only the owner's IP (the app uses HTTPS, unaffected). SSL enforcement **on**.
13. MFA on the Supabase, Vercel, GitHub and Google AI Studio accounts.
14. Storage: confirm no buckets, or only private ones.

**Monitoring and AI spend**

15. Logs: Vercel keeps runtime logs 1 h (Hobby). For alerting, a Log Drain filtered on `"kind":"security"` — **and update /privacy's retention sentence if you add one.**
16. Confirm the Gemini key's Google Cloud project has **no billing account**. The day billing is attached: a budget with alerts, a per-day quota on the model, and Google's disable-billing-at-100 % pattern (spec/04 §6).
17. After the deploy: `pnpm security:headers https://be-better-everyday-one.vercel.app` (expect all green) and one real article import (checks prompt V3).

**Future custom domain:** add a host-scoped HSTS header (`max-age=300; includeSubDomains`, ramped to a year) — the exact rule is in `next.config.mjs`'s comment.

## 5. Other risks noticed

**Needs an owner decision**

- **Next 14 is out of support.** 23 advisories remain (2 critical), fixes only in 15.5.x. Reachable in production on Vercel: almost none (no image optimizer now, no server actions, no rewrites, no i18n). **Reachable on a Windows dev machine:** `next dev`/`next start` bind every interface — bind to `127.0.0.1` on untrusted networks. Adding the first server action would make several live. The upgrade means React 19 and R3F v9, and D-06 says "Next.js 14".
- **/privacy's deletion paragraph** says deleting removes everything "at once and for good"; the deletion log line (user id, address, browser) lives for the log retention (~1 h). Needs a wording decision.
- **Journal agent (off in production):** nothing in code stops a support reflection containing a phone number or URL (D-13's named harm) — a check like the quoting check is proposed; and the entry is not fenced like the article.
- **Prompt V3** and the spec/04 §2, §6, §9 notes are PROPOSED.
- **No Content-Security-Policy** beyond `frame-ancestors`. Needs a nonce policy, trialled report-only, because of three/R3F and Tone.js.

**Listed, not fixed**

- A revoked session's access token works at PostgREST for up to 1 h (shorter JWT expiry, or an RLS check on `auth.sessions`).
- Users can still write their own `journal_entries.ai_*` fields directly (self-only); moving `reflect.ts`'s write to the service client would let 026 revoke them.
- Zone hopping between real timezones still reaches ~3 local dates (each pays once). Fix: allow a zone change only from UTC, or once a week.
- No per-IP AI limit; many accounts multiply the per-user caps (the shared free quota is the backstop). A malformed body still spends a quota unit; 429s write no `agent_logs` row.
- No password-reset UI, yet Supabase's `/recover` is live: a recovery link signs someone in with no way to set a password.
- `signOut()` is global — it signs out every device.
- PKCE confirmation links only complete in the browser that signed up.
- Sessions never expire server-side on Free (time-box and inactivity timeout are Pro).
- `middleware.ts` refreshes the session on `/api` routes too — a duplicate `getUser()` per API call. Excluding `/api/` looks safe.
- `lib/data/challenge.ts` maps 413 to "connection dropped"; `lib/data/journal.ts` and the challenge copy hard-code the AI caps.
- No missing authorization checks found: every RPC that takes an id checks ownership, with a cross-user test each; RLS isolation covers all 13 tables.
- No hardcoded secrets found in tracked files; `.env` is ignored and was never committed.
