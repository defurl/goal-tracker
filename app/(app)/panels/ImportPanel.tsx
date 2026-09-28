'use client';

// The phone's panel — Article Import in the room (build plan 3.2, F1).
//
// design-system/12 §3.4 and spec/02 F1: a link field, a status line, the
// extracted preview. Submits on Enter. It is TRANSIENT, not a settings screen:
// once an action is saved the panel closes itself and the camera returns to
// the desk, where monitor 1 shows today's challenge.
//
// The close waits CLOSE_AFTER_MS so the preview can be read, and any touch or
// keypress in the panel cancels it — a panel must not vanish from under
// someone who is still using it. The dwell is PROPOSED.
//
// While the agent runs, the phone's screen warms (spec/05 §3); that is the
// scene reading `importing`, which lib/data/challenge sets. Nothing here
// touches the scene.

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';

import { importMessage } from '../../../lib/challenge/copy';
import { importAction } from '../../../lib/data/challenge';
import { useAppStore } from '../../../lib/stores/app';
import { useInteractionStore } from '../../../lib/stores/interaction';
import { supabaseConfigured } from '../../../lib/supabase/env';
import { useSignedIn } from '../../../lib/supabase/useSignedIn';

import voice from '../text/text.module.css';

const CLOSE_AFTER_MS = 3000;

export function ImportPanel() {
  const signedInState = useSignedIn();
  const importing = useAppStore((s) => s.importing);
  const returnToDesk = useInteractionStore((s) => s.returnToDesk);

  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const holdOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };
  useEffect(() => holdOpen, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || importing) return;
    holdOpen();
    setMessage(null);
    setPreview(null);
    const outcome = await importAction(mode === 'url' ? { url: trimmed } : { text: trimmed });
    setMessage(importMessage(outcome));
    if (outcome.kind !== 'imported') return;
    setPreview(outcome.actionText);
    setValue('');
    // An unreadable page says what to do next, so it stays open to be read.
    if (!outcome.sourceUnreadable) closeTimer.current = setTimeout(returnToDesk, CLOSE_AFTER_MS);
  }

  if (signedInState === null && supabaseConfigured) return null; // not known yet — no flash of "sign in"

  if (!supabaseConfigured || !signedInState) {
    return (
      <p className={voice.quiet}>
        A link or a passage you saved comes back as one action you can do in two minutes.{' '}
        <Link href="/login" className={voice.label}>
          sign in
        </Link>{' '}
        to import.
      </p>
    );
  }

  const status = importing ? 'extracting…' : preview ? 'ready' : null;

  return (
    <div className={voice.form} onPointerDown={holdOpen} onKeyDown={holdOpen}>
      <p className={voice.quiet}>A link or a passage you saved. It comes back as one action you can do in two minutes.</p>

      <form className={voice.form} onSubmit={submit}>
        <div className={voice.toggles} role="radiogroup" aria-label="what you are importing">
          {(['url', 'text'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={mode === m}
              className={voice.toggle}
              onClick={() => setMode(m)}
            >
              {m === 'url' ? 'a link' : 'some text'}
            </button>
          ))}
        </div>

        <label className={voice.field}>
          <span className={voice.label}>{mode === 'url' ? 'article link' : 'article text'}</span>
          {mode === 'url' ? (
            <input
              className={voice.input}
              type="url"
              inputMode="url"
              placeholder="https://"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          ) : (
            <textarea className={voice.textarea} value={value} onChange={(e) => setValue(e.target.value)} />
          )}
        </label>

        <button type="submit" className={voice.primary} disabled={importing || !value.trim()}>
          {importing ? 'reading…' : 'turn it into an action'}
        </button>
      </form>

      <div role="status" className={voice.form}>
        {status && <p className={voice.label}>{status}</p>}
        {/* X-2: a skeleton while the agent works, never a bare spinner. */}
        {importing && (
          <div className={voice.skeleton} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        )}
        {preview && <p className={voice.prose}>{preview}</p>}
        {message && <p className={voice.quiet}>{message}</p>}
      </div>
    </div>
  );
}
