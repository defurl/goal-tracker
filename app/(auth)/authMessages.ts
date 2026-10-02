// What the sign-in and sign-up forms say when Supabase says no (security item
// 5, user enumeration). Never Supabase's own words: they differ case by case —
// "Invalid login credentials", "User already registered" — and that difference
// is exactly what lets someone test whether an address has an account here.
//
//   sign-in   an unknown email and a wrong password read the same.
//   sign-up   an address that already has an account reads like any other
//             sign-up. With "Confirm email" on, Supabase answers it with a
//             look-alike user and sends nothing; with it off it answers "User
//             already registered", which lands on the same sentence here.
//   limits    rate limits and network failures say what they are. They are
//             about this network or this moment, not about any account.
//
// This is the UI half. Sign-in and sign-up go from the browser straight to
// Supabase, so its API answers are its own; the hardening checklist covers
// what the dashboard can do about them.
//
// Every message is a plain statement (non-negotiable 9): no blame, no alarm.

export type AuthAction = 'login' | 'signup' | 'google';

/** The fields of a supabase-js AuthError this reads — plain data, so tests need no client. */
export interface AuthFailure {
  name?: string;
  code?: string;
  status?: number;
  reasons?: readonly string[];
}

export const AUTH_MESSAGES = {
  /** Unknown email, wrong password, and anything else a sign-in refuses. */
  noMatch: 'That email and password don’t match. Check both and try again.',
  /** Shown for every accepted sign-up, an address already in use included. */
  checkInbox:
    'Check your inbox — the link there finishes signing you up. If you already have an account, sign in instead.',
  /** Only ever after the right password (see authMessage). */
  unconfirmed: 'Your email isn’t confirmed yet — the link in your inbox does that. Then sign in here.',
  tooManyTries: 'Too many attempts just now. Wait a few minutes, then try again.',
  emailLimit: 'No more emails can go out just now. Try again in a little while.',
  offline: 'The server can’t be reached right now. Check your connection and try again.',
  unavailable: 'That didn’t go through, and the fault isn’t yours. Try again in a moment.',
  passwordShort: 'That password is too short. Try a longer one.',
  passwordBreached: 'That password has turned up in a data breach elsewhere. Choose a different one.',
  passwordWeak: 'That password is too easy to guess. Try a longer one, with a mix of characters.',
  emailUnusable: 'That email address can’t be used here. Check it, or try another.',
  signupsClosed: 'New accounts are closed for now.',
  google: 'Google sign-in didn’t start. Try again, or use your email.',
} as const;

/** Codes that mean "this address is already an account" — never said out loud. */
const ACCOUNT_EXISTS = new Set(['user_already_exists', 'email_exists', 'identity_already_exists']);

function isRateLimit({ code, status }: AuthFailure): boolean {
  return status === 429 || code === 'over_request_rate_limit';
}

/** No answer at all (status 0), or the server or its gateway failing (5xx). */
function isOutage({ name, code, status }: AuthFailure): boolean {
  if (name === 'AuthRetryableFetchError') return true;
  if (code === 'request_timeout' || code === 'unexpected_failure' || code?.startsWith('hook_')) return true;
  return status !== undefined && status >= 500;
}

function weakPassword({ reasons = [] }: AuthFailure): string {
  if (reasons.includes('pwned')) return AUTH_MESSAGES.passwordBreached;
  if (reasons.length === 1 && reasons[0] === 'length') return AUTH_MESSAGES.passwordShort;
  return AUTH_MESSAGES.passwordWeak;
}

/**
 * The sentence for a failed sign-in, sign-up or Google start. Anything not
 * named here gets the action's catch-all, so a code Supabase adds later cannot
 * become a new tell.
 */
export function authMessage(action: AuthAction, failure: AuthFailure): string {
  if (action === 'google') return isRateLimit(failure) ? AUTH_MESSAGES.tooManyTries : AUTH_MESSAGES.google;

  if (failure.name === 'AuthRetryableFetchError' && (failure.status ?? 0) === 0) return AUTH_MESSAGES.offline;
  if (isOutage(failure)) return AUTH_MESSAGES.unavailable;
  if (failure.code === 'over_email_send_rate_limit') return AUTH_MESSAGES.emailLimit;
  if (isRateLimit(failure)) return AUTH_MESSAGES.tooManyTries;

  if (action === 'login') {
    // Supabase checks the password before it checks confirmation, so this
    // only reaches someone who already holds the right password.
    if (failure.code === 'email_not_confirmed') return AUTH_MESSAGES.unconfirmed;
    return AUTH_MESSAGES.noMatch;
  }

  if (failure.code !== undefined && ACCOUNT_EXISTS.has(failure.code)) return AUTH_MESSAGES.checkInbox;
  if (failure.code === 'weak_password') return weakPassword(failure);
  if (failure.code === 'email_address_invalid') return AUTH_MESSAGES.emailUnusable;
  if (failure.code === 'signup_disabled' || failure.code === 'email_provider_disabled') {
    return AUTH_MESSAGES.signupsClosed;
  }
  return AUTH_MESSAGES.unavailable;
}
