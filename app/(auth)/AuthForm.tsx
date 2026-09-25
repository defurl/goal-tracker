'use client';

// Email + password and Google, for both /login and /signup (B1.1).
//
// A plain DOM form: auth is route-shell territory (D-10's 200 KB budget), so it
// must not reach for anything in scene/. Every message is a plain statement —
// no red, no shake, nothing that reads as a reprimand (non-negotiable 9).

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';
import { googleAuthEnabled, supabaseConfigured } from '@/lib/supabase/env';

import styles from './AuthForm.module.css';

type Mode = 'login' | 'signup';

const COPY: Record<Mode, { title: string; submit: string; switchText: string; switchHref: string }> = {
  login: {
    title: 'Sign in',
    submit: 'sign in',
    switchText: 'new here? create an account',
    switchHref: '/signup',
  },
  signup: {
    title: 'Create an account',
    submit: 'create account',
    switchText: 'already have one? sign in',
    switchHref: '/login',
  },
};

export function AuthForm({ mode, notice }: { mode: Mode; notice?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(notice ?? null);
  const copy = COPY[mode];

  const callback = () => `${window.location.origin}/auth/callback`;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(error.message);
        setBusy(false);
        return;
      }
      router.replace('/');
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: callback() },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.session) {
      router.replace('/');
      router.refresh();
      return;
    }
    // Email confirmation is on: no session until the link is followed.
    setMessage('Check your inbox — the link there finishes signing you up.');
  }

  async function google() {
    setBusy(true);
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callback() },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  if (!supabaseConfigured) {
    return (
      <main className={styles.page}>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.message}>Sign-in is not configured on this build.</p>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>{copy.title}</h1>

      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span className={styles.label}>email</span>
          <input
            className={styles.input}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>password</span>
          <input
            className={styles.input}
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        <button className={styles.submit} type="submit" disabled={busy}>
          {copy.submit}
        </button>
      </form>

      {googleAuthEnabled && (
        <button className={styles.secondary} type="button" onClick={google} disabled={busy}>
          continue with google
        </button>
      )}

      {message && (
        <p className={styles.message} role="status">
          {message}
        </p>
      )}

      <Link className={styles.switch} href={copy.switchHref}>
        {copy.switchText}
      </Link>
    </main>
  );
}
