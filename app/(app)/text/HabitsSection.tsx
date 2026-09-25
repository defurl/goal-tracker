'use client';

// Feature 2 on /text — today's habits, one tap each (US-2.2, FR-2.8).
//
// Streaks: the longest is the primary number and the current one sits beside
// it, with no treatment of any kind when it resets (D-09). A missed day has
// one signal in this product — nothing grows — and this list adds none.

import { useState, type FormEvent } from 'react';

import { HABIT_CAP, archiveHabit, checkHabit, createHabit, type CreateHabitOutcome } from '../../../lib/data/habits';
import { useAppStore, type HabitSummary } from '../../../lib/stores/app';

import styles from './text.module.css';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function HabitRow({ habit, signedIn }: { habit: HabitSummary; signedIn: boolean }) {
  return (
    <li className={styles.item}>
      <button
        type="button"
        role="checkbox"
        aria-checked={habit.completedToday}
        aria-label={`${habit.name}${habit.type === 'break' ? ', avoided today' : ', done today'}`}
        className={styles.check}
        disabled={!signedIn}
        onClick={() => void checkHabit(habit.id, !habit.completedToday)}
      />
      <div className={styles.itemBody}>
        <span className={styles.prose}>{habit.name}</span>
        <span className={styles.faint}>
          {habit.type === 'build' ? 'building' : 'quitting'} · longest{' '}
          <span className={styles.number}>{habit.longestStreak}</span> · now {habit.streak}
        </span>
      </div>
      <button type="button" className={styles.action} onClick={() => void archiveHabit(habit.id)}>
        archive
      </button>
    </li>
  );
}

function createMessage(outcome: CreateHabitOutcome): string | null {
  switch (outcome) {
    case 'created':
      return null;
    case 'cap_reached':
      // AC-2.1: explained, not silent.
      return 'Ten habits is the most at once — it keeps a day doable. Archive one to make room.';
    case 'invalid':
      return 'A habit needs a name and at least one day.';
    case 'signed_out':
      return 'Sign in to add habits.';
    case 'unavailable':
      return 'Not saved — the connection dropped. Try again in a moment.';
  }
}

function NewHabit({ atCap }: { atCap: boolean }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'build' | 'break'>('build');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const outcome = await createHabit({ name, type, days });
    setBusy(false);
    setMessage(createMessage(outcome));
    if (outcome === 'created') setName('');
  }

  if (atCap) {
    return <p className={styles.faint}>{createMessage('cap_reached')}</p>;
  }

  return (
    <details className={styles.details}>
      <summary>add a habit</summary>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span className={styles.label}>name</span>
          <input className={styles.input} maxLength={80} required value={name} onChange={(e) => setName(e.target.value)} />
        </label>

        <div className={styles.toggles} role="radiogroup" aria-label="building or quitting">
          {(['build', 'break'] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} className={styles.toggle} onClick={() => setType(t)}>
              {t === 'build' ? 'building it' : 'quitting it'}
            </button>
          ))}
        </div>

        <div className={styles.toggles} role="group" aria-label="days it is due">
          {DAYS.map((label, day) => (
            <button
              key={label}
              type="button"
              aria-pressed={days.includes(day)}
              className={styles.toggle}
              onClick={() => setDays((d) => (d.includes(day) ? d.filter((x) => x !== day) : [...d, day]))}
            >
              {label}
            </button>
          ))}
        </div>

        <button type="submit" className={styles.primary} disabled={busy || !name.trim() || days.length === 0}>
          add
        </button>
        {message && (
          <p className={styles.quiet} role="status">
            {message}
          </p>
        )}
      </form>
    </details>
  );
}

export function HabitsSection({ signedIn }: { signedIn: boolean }) {
  const habits = useAppStore((s) => s.habits);
  const due = habits.filter((h) => h.dueToday);
  const rest = habits.filter((h) => !h.dueToday);

  return (
    <section className={styles.section} aria-labelledby="habits-heading">
      <h2 id="habits-heading" className={styles.heading}>Habits</h2>

      {habits.length === 0 ? (
        <p className={styles.quiet}>
          No habits yet. Add something you are building, or something you are quitting — each one kept grows the bonsai.
        </p>
      ) : (
        <>
          <ul className={styles.list} aria-label="due today">
            {due.map((h) => (
              <HabitRow key={h.id} habit={h} signedIn={signedIn} />
            ))}
          </ul>
          {rest.length > 0 && (
            <>
              <p className={styles.label}>not due today</p>
              <ul className={styles.list} aria-label="not due today">
                {rest.map((h) => (
                  <HabitRow key={h.id} habit={h} signedIn={signedIn} />
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {signedIn ? (
        <NewHabit atCap={habits.length >= HABIT_CAP} />
      ) : (
        <p className={styles.faint}>
          <a href="/login" className={styles.label}>sign in</a> to keep habits.
        </p>
      )}
    </section>
  );
}
