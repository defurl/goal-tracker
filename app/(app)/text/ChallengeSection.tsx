'use client';

// Feature 1 on /text — today's challenge and the import that feeds it.

import { useState, type FormEvent } from 'react';

import { completeChallenge, importAction, rollChallenge, type ImportOutcome } from '../../../lib/data/challenge';
import { useAppStore } from '../../../lib/stores/app';

import styles from './text.module.css';

function importMessage(outcome: ImportOutcome): string {
  switch (outcome.kind) {
    case 'imported':
      return outcome.sourceUnreadable
        ? 'That page could not be read, so this one is a starter action. Paste the article’s text for one drawn from it.'
        : 'Saved to your actions.';
    case 'limited':
      return 'Twenty imports today. The rest can wait for tomorrow.';
    case 'invalid':
      return 'That does not look like a link or any text.';
    case 'signed_out':
      return 'Sign in to save actions.';
    case 'unavailable':
      return 'Not saved — the connection dropped. Try again in a moment.';
  }
}

export function ChallengeSection({ signedIn }: { signedIn: boolean }) {
  const challenge = useAppStore((s) => s.challenge);
  const importing = useAppStore((s) => s.importing);
  const [busy, setBusy] = useState(false);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    await task();
    setBusy(false);
  }

  const rollReason =
    challenge && !challenge.complete && challenge.rollsRemaining === 0
      ? challenge.rollCount >= 3
        ? 'Three rolls a day — this one is today’s.'
        : 'Import another action to have something to roll to.'
      : null;

  return (
    <>
      <section className={styles.section} aria-labelledby="challenge-heading">
        <h2 id="challenge-heading" className={styles.heading}>Today’s challenge</h2>

        {challenge ? (
          <>
            <p className={styles.prose}>{challenge.actionText}</p>
            {challenge.sourceSummary && <p className={styles.quiet}>{challenge.sourceSummary}</p>}
            {challenge.sourceUrl && <p className={styles.faint}>{challenge.sourceUrl}</p>}

            {challenge.complete ? (
              <p className={styles.label}>done today</p>
            ) : (
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy || !challenge.id}
                  onClick={() => challenge.id && run(() => completeChallenge(challenge.id as string))}
                >
                  do it now — mark done
                </button>
                <button
                  type="button"
                  className={styles.action}
                  disabled={busy || challenge.rollsRemaining === 0}
                  aria-describedby={rollReason ? 'roll-reason' : undefined}
                  onClick={() => challenge.id && run(() => rollChallenge(challenge.id as string))}
                >
                  roll again · {challenge.rollsRemaining} left
                </button>
              </div>
            )}
            {rollReason && (
              <p id="roll-reason" className={styles.faint}>
                {rollReason}
              </p>
            )}
          </>
        ) : (
          // FR-1.7: a welcome that routes to import, never a blank surface.
          <p className={styles.quiet}>
            Nothing saved yet. Paste an article{' '}
            <a href="#import" className={styles.label}>below</a> and it becomes a two-minute action — one of them
            is waiting here each morning.
          </p>
        )}
      </section>

      <ImportSection signedIn={signedIn} importing={importing} />
    </>
  );
}

function ImportSection({ signedIn, importing }: { signedIn: boolean; importing: boolean }) {
  const [mode, setMode] = useState<'url' | 'text'>('url');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    setMessage(null);
    setPreview(null);
    const outcome = await importAction(mode === 'url' ? { url: trimmed } : { text: trimmed });
    setMessage(importMessage(outcome));
    if (outcome.kind === 'imported') {
      setPreview(outcome.actionText);
      setValue('');
    }
  }

  return (
    <section id="import" className={styles.section} aria-labelledby="import-heading">
      <h2 id="import-heading" className={styles.heading}>Import</h2>
      <p className={styles.quiet}>A link or a passage you saved. It comes back as one action you can do in two minutes.</p>

      {!signedIn ? (
        <p className={styles.faint}>
          <a href="/login" className={styles.label}>sign in</a> to import.
        </p>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <div className={styles.toggles} role="radiogroup" aria-label="what you are importing">
            {(['url', 'text'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                className={styles.toggle}
                onClick={() => setMode(m)}
              >
                {m === 'url' ? 'a link' : 'some text'}
              </button>
            ))}
          </div>

          <label className={styles.field}>
            <span className={styles.label}>{mode === 'url' ? 'article link' : 'article text'}</span>
            {mode === 'url' ? (
              <input
                className={styles.input}
                type="url"
                inputMode="url"
                placeholder="https://"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            ) : (
              <textarea className={styles.textarea} value={value} onChange={(e) => setValue(e.target.value)} />
            )}
          </label>

          <button type="submit" className={styles.primary} disabled={importing || !value.trim()}>
            {importing ? 'reading…' : 'turn it into an action'}
          </button>
        </form>
      )}

      {/* X-2: a skeleton while the agent works, never a bare spinner. */}
      {importing && (
        <div className={styles.skeleton} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      {preview && <p className={styles.prose}>{preview}</p>}
      {message && (
        <p className={styles.quiet} role="status">
          {message}
        </p>
      )}
    </section>
  );
}
