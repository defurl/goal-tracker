// app/(auth)/authMessages.ts — what the auth forms say when Supabase refuses
// (security item 5). The errors below are shaped like supabase-js AuthErrors:
// a name, a status and Supabase Auth's error code.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { AUTH_MESSAGES, authMessage, type AuthFailure } from '../../app/(auth)/authMessages.ts';

const api = (status: number, code: string, extra: Partial<AuthFailure> = {}): AuthFailure => ({
  name: 'AuthApiError',
  status,
  code,
  ...extra,
});

describe('sign-in', () => {
  it('reads the same for an unknown email and a wrong password', () => {
    // Supabase answers both with invalid_credentials; a disabled or banned
    // account, or a password-less (Google-only) one, must not stand out either.
    const unknown = authMessage('login', api(400, 'invalid_credentials'));
    assert.equal(unknown, AUTH_MESSAGES.noMatch);
    for (const code of ['user_not_found', 'user_banned', 'validation_failed', 'email_address_invalid', 'not_a_code_yet']) {
      assert.equal(authMessage('login', api(400, code)), unknown, code);
    }
    assert.equal(authMessage('login', { name: 'AuthApiError', status: 400 }), unknown);
  });

  it('names an unconfirmed email — Supabase only says so after the right password', () => {
    assert.equal(authMessage('login', api(400, 'email_not_confirmed')), AUTH_MESSAGES.unconfirmed);
  });
});

describe('sign-up', () => {
  it('reads like any other sign-up when the address already has an account', () => {
    // "User already registered" — only returned while a confirm setting is off.
    for (const code of ['user_already_exists', 'email_exists', 'identity_already_exists']) {
      assert.equal(authMessage('signup', api(422, code)), AUTH_MESSAGES.checkInbox, code);
    }
  });

  it('explains a weak password without a number that could drift from the dashboard', () => {
    const weak = (reasons: string[]) => authMessage('signup', api(422, 'weak_password', { reasons }));
    assert.equal(weak(['length']), AUTH_MESSAGES.passwordShort);
    assert.equal(weak(['characters']), AUTH_MESSAGES.passwordWeak);
    assert.equal(weak(['length', 'characters']), AUTH_MESSAGES.passwordWeak);
    assert.equal(weak(['pwned']), AUTH_MESSAGES.passwordBreached);
    assert.equal(weak([]), AUTH_MESSAGES.passwordWeak);
    assert.doesNotMatch(AUTH_MESSAGES.passwordShort, /\d/);
  });

  it('says what it can about the address and the switch', () => {
    assert.equal(authMessage('signup', api(400, 'email_address_invalid')), AUTH_MESSAGES.emailUnusable);
    assert.equal(authMessage('signup', api(422, 'signup_disabled')), AUTH_MESSAGES.signupsClosed);
  });

  it('falls back to one neutral sentence for anything else', () => {
    assert.equal(authMessage('signup', api(400, 'email_address_not_authorized')), AUTH_MESSAGES.unavailable);
    assert.equal(authMessage('signup', api(400, 'not_a_code_yet')), AUTH_MESSAGES.unavailable);
  });
});

describe('limits and outages say what they are, on either form', () => {
  for (const action of ['login', 'signup'] as const) {
    it(`${action}: rate limits`, () => {
      assert.equal(authMessage(action, api(429, 'over_request_rate_limit')), AUTH_MESSAGES.tooManyTries);
      assert.equal(authMessage(action, api(429, 'some_future_limit')), AUTH_MESSAGES.tooManyTries);
      assert.equal(authMessage(action, api(429, 'over_email_send_rate_limit')), AUTH_MESSAGES.emailLimit);
    });

    it(`${action}: no connection, and the server failing`, () => {
      assert.equal(authMessage(action, { name: 'AuthRetryableFetchError', status: 0 }), AUTH_MESSAGES.offline);
      assert.equal(authMessage(action, { name: 'AuthRetryableFetchError', status: 503 }), AUTH_MESSAGES.unavailable);
      assert.equal(authMessage(action, api(500, 'unexpected_failure')), AUTH_MESSAGES.unavailable);
      assert.equal(authMessage(action, api(504, 'request_timeout')), AUTH_MESSAGES.unavailable);
      assert.equal(authMessage(action, api(422, 'hook_timeout')), AUTH_MESSAGES.unavailable);
    });
  }
});

describe('google', () => {
  it('has one sentence, unless it is a rate limit', () => {
    assert.equal(authMessage('google', api(400, 'provider_disabled')), AUTH_MESSAGES.google);
    assert.equal(authMessage('google', api(429, 'over_request_rate_limit')), AUTH_MESSAGES.tooManyTries);
  });
});

describe('the voice (non-negotiable 9)', () => {
  it('is plain statements: no exclamations, no shouting, no blame words', () => {
    for (const [key, text] of Object.entries(AUTH_MESSAGES)) {
      assert.doesNotMatch(text, /!/, key);
      assert.doesNotMatch(text, /\b[A-Z]{3,}\b/, key);
      assert.doesNotMatch(text, /\b(error|invalid|failed|wrong|denied|forbidden)\b/i, key);
      assert.match(text, /\.$/, key);
    }
  });
});
