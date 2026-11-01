'use client';

// Growth Map (functional specification §4, D-26 §3): journeys with milestones
// (G01-G03), repeating actions — the habits — and the Inspiration Inbox (G05).
// Progress is completed milestones over milestones, never a score of the
// person. Nothing is created from private writing; everything here is typed
// or approved by the user.

import { useEffect, useState } from 'react';

import { ensureHistory } from '@/lib/data/history';
import { HABIT_CAP, archiveHabit, checkHabit, createHabit, type CreateHabitOutcome } from '@/lib/data/habits';
import { MILESTONE_CAP, createGoal, loadGoalDetails, setMilestone, type GoalDetail } from '@/lib/data/goals';
import { localToday } from '@/lib/journal/device';
import { useAppStore, type GoalCategory } from '@/lib/stores/app';
import { setHashPath, useHashPath } from '@/features/room/useHashTab';
import { Icon } from '@/components/ui/icons';
import {
  ArmButton,
  Button,
  Card,
  Chips,
  Empty,
  ErrorText,
  Field,
  Muted,
  Ring,
  Skeleton,
  Tabs,
  Tag,
  buttonClass,
  inputClass,
  textareaClass,
} from '@/components/ui/kit';
import { InboxCard } from './InboxCard';

import { useSurfaceState } from '@/app/(app)/useSurfaceState';

import styles from '@/features/today/today.module.css';

type BoardProps = { signedIn: boolean; ready: boolean };

/** The design team's growth areas, on the schema's six categories. */
export const AREAS: readonly { value: GoalCategory; label: string }[] = [
  { value: 'health', label: 'Appearance and care' },
  { value: 'other', label: 'Mindset' },
  { value: 'relationships', label: 'Personality and social' },
  { value: 'learning', label: 'Learning' },
  { value: 'career', label: 'Career' },
  { value: 'finance', label: 'Money' },
];

const areaLabel = (c: GoalCategory) => AREAS.find((a) => a.value === c)?.label ?? c;

const WEEK = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
] as const;

const HABIT_COPY: Record<Exclude<CreateHabitOutcome, 'created'>, string> = {
  cap_reached: `Ten repeating actions is the limit. Archive one to start another.`,
  invalid: 'Give it a name and at least one day.',
  unavailable: 'Not saved: the connection dropped. Try again.',
  signed_out: 'Sign in to save repeating actions.',
};

// ── journeys ──────────────────────────────────────────────────────────────

function NewJourney({ onCreated }: { onCreated: () => void }) {
  const today = localToday();
  const [title, setTitle] = useState('');
  const [area, setArea] = useState<GoalCategory[]>(['learning']);
  const [why, setWhy] = useState('');
  const [start, setStart] = useState(today);
  const [target, setTarget] = useState('');
  const [milestones, setMilestones] = useState<string[]>(['']);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const outcome = await createGoal({
      title,
      category: area[0] ?? 'other',
      description: why,
      startDate: start,
      targetDate: target,
      milestones,
    });
    setBusy(false);
    if (outcome === 'created') {
      onCreated();
      return;
    }
    setError(
      {
        invalid: 'A journey needs a name, a target date and at least one milestone.',
        invalid_dates: 'The target date comes after the start.',
        unavailable: 'Not saved: the connection dropped. Try again.',
        signed_out: 'Sign in to save journeys.',
      }[outcome],
    );
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Field label="What do you want to grow toward?">
        {(p) => <input {...p} className={inputClass} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Chips legend="Area" options={AREAS} value={area} onChange={(v) => setArea(v.length ? v : area)} />
      <Field label="Why it matters (optional)">
        {(p) => <textarea {...p} className={textareaClass} style={{ minHeight: 72 }} maxLength={600} value={why} onChange={(e) => setWhy(e.target.value)} />}
      </Field>
      <div className={styles.twoCols}>
        <Field label="Start">{(p) => <input {...p} type="date" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
        <Field label="Target date">{(p) => <input {...p} type="date" className={inputClass} min={start} value={target} onChange={(e) => setTarget(e.target.value)} />}</Field>
      </div>
      <fieldset className={styles.form} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: 6 }}>Milestones, in order (up to {MILESTONE_CAP})</legend>
        {milestones.map((m, i) => (
          <input
            key={i}
            className={inputClass}
            aria-label={`Milestone ${i + 1}`}
            maxLength={120}
            value={m}
            placeholder={i === 0 ? 'A first, observable step' : ''}
            onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? e.target.value : x)))}
          />
        ))}
        {milestones.length < MILESTONE_CAP && (
          <Button variant="tertiary" icon="plus" onClick={() => setMilestones([...milestones, ''])}>
            Add a milestone
          </Button>
        )}
      </fieldset>
      {error && <ErrorText>{error}</ErrorText>}
      <div className={styles.row}>
        <Button type="submit" variant="primary" disabled={busy}>
          Start journey
        </Button>
      </div>
    </form>
  );
}

function JourneysCard({ signedIn, ready }: BoardProps) {
  const goalsInStore = useAppStore((s) => s.goals);
  const [details, setDetails] = useState<GoalDetail[] | null>(null);
  const [adding, setAdding] = useState(false);

  // Milestones are not in the store; fetch them, and again when goals change.
  useEffect(() => {
    if (!ready || !signedIn) return;
    let live = true;
    void loadGoalDetails().then((d) => live && setDetails(d));
    return () => {
      live = false;
    };
  }, [ready, signedIn, goalsInStore]);

  const active = (details ?? []).filter((g) => !g.complete);
  const finished = (details ?? []).filter((g) => g.complete);

  return (
    <Card
      title="Journeys"
      icon="target"
      action={
        signedIn && !adding ? (
          <Button variant="tertiary" icon="plus" onClick={() => setAdding(true)}>
            New journey
          </Button>
        ) : undefined
      }
    >
      {!ready || (signedIn && details === null) ? (
        <Skeleton label="Loading journeys" />
      ) : !signedIn ? (
        <Empty action={<a className={buttonClass('primary', true)} href="/login">Sign in</a>}>Sign in to plan journeys.</Empty>
      ) : adding ? (
        <NewJourney onCreated={() => setAdding(false)} />
      ) : active.length === 0 ? (
        <Empty action={<Button variant="primary" onClick={() => setAdding(true)}>Start a journey</Button>}>
          A journey is one thing you want to grow toward, split into milestones you can see. One to three at a time is plenty.
        </Empty>
      ) : (
        <>
          {active.length > 3 && <Muted>{active.length} journeys are active. Pausing some can make room.</Muted>}
          {active.map((g) => {
            const done = g.milestones.filter((m) => m.complete).length;
            return (
              <article key={g.id} className={styles.entry}>
                <div className={styles.row} style={{ alignItems: 'flex-start', gap: 16 }}>
                  <Ring value={g.progress} label={`${done}/${g.milestones.length}`} size={56} />
                  <div className={styles.itemMain}>
                    <p className={styles.itemTitle}>{g.title}</p>
                    <p className={styles.itemMeta}>
                      {areaLabel(g.category)} · by{' '}
                      {new Date(`${g.targetDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                    {g.description && <Muted>{g.description}</Muted>}
                    <ul className={styles.list}>
                      {g.milestones.map((m) => (
                        <li key={m.id} className={styles.item}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={m.complete}
                            aria-label={m.title}
                            className={styles.check}
                            onClick={() => void setMilestone(m.id, !m.complete)}
                          >
                            <span>{m.complete && <Icon name="check" size={16} />}</span>
                          </button>
                          <span className={`${styles.itemMain} ${m.complete ? styles.done : ''}`}>{m.title}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </article>
            );
          })}
        </>
      )}
      {finished.length > 0 && !adding && (
        <details className={styles.details}>
          <summary>Finished journeys ({finished.length})</summary>
          <ul className={styles.list}>
            {finished.map((g) => (
              <li key={g.id} className={styles.item}>
                <Icon name="check" /> {g.title}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

// ── repeating actions (the habits) ────────────────────────────────────────

function NewAction() {
  const [name, setName] = useState('');
  const [type, setType] = useState<('build' | 'break')[]>(['build']);
  const [days, setDays] = useState<string[]>(['0', '1', '2', '3', '4', '5', '6']);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const outcome = await createHabit({ name, type: type[0] ?? 'build', days: days.map(Number) });
    setBusy(false);
    if (outcome === 'created') {
      setName('');
      setMessage(null);
    } else setMessage(HABIT_COPY[outcome]);
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <Field label="New repeating action">
        {(p) => (
          <input {...p} className={inputClass} maxLength={80} value={name} placeholder="Drink a glass of water" onChange={(e) => setName(e.target.value)} />
        )}
      </Field>
      <Chips
        legend="Kind"
        options={[
          { value: 'build', label: 'Building it' },
          { value: 'break', label: 'Quitting it' },
        ]}
        value={type}
        onChange={(v) => setType(v.length ? (v as ('build' | 'break')[]) : type)}
      />
      <Chips legend="Days" options={WEEK} value={days} multiple onChange={setDays} />
      {message && <ErrorText>{message}</ErrorText>}
      <div>
        <Button type="submit" variant="primary" disabled={busy || !name.trim() || days.length === 0}>
          Add action
        </Button>
      </div>
    </form>
  );
}

function ActionsCard({ signedIn, ready }: BoardProps) {
  const habits = useAppStore((s) => s.habits);
  return (
    <Card title="Repeating actions" icon="sprout">
      {!ready ? (
        <Skeleton label="Loading actions" />
      ) : !signedIn ? (
        <Muted>Sign in to keep repeating actions.</Muted>
      ) : (
        <>
          {habits.length === 0 ? (
            <Muted>Small actions you repeat, on the days you choose. Missing a day changes nothing.</Muted>
          ) : (
            <ul className={styles.list}>
              {habits.map((h) => (
                <li key={h.id} className={styles.item}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={h.completedToday}
                    aria-label={`${h.name}, today`}
                    disabled={!h.dueToday}
                    className={styles.check}
                    onClick={() => void checkHabit(h.id, !h.completedToday)}
                  >
                    <span>{h.completedToday && <Icon name="check" size={16} />}</span>
                  </button>
                  <div className={styles.itemMain}>
                    <p className={`${styles.itemTitle} ${h.completedToday ? styles.done : ''}`}>{h.name}</p>
                    <p className={styles.itemMeta}>
                      {h.type === 'break' ? 'Quitting · ' : ''}
                      {h.dueToday ? 'today' : 'rest day'}
                      {h.longestStreak > 1 ? ` · best run ${h.longestStreak}` : ''}
                    </p>
                  </div>
                  <ArmButton size="small" label="Archive" armedLabel="Press again" onFire={() => void archiveHabit(h.id)} />
                </li>
              ))}
            </ul>
          )}
          {habits.length < HABIT_CAP ? (
            <details className={styles.details} open={habits.length === 0}>
              <summary>Add a repeating action</summary>
              <NewAction />
            </details>
          ) : (
            <Muted>Ten is the limit. Archive one to start another; its history stays.</Muted>
          )}
        </>
      )}
    </Card>
  );
}

// ── the year ──────────────────────────────────────────────────────────────

function YearCard({ signedIn, ready }: BoardProps) {
  const history = useAppStore((s) => s.history);
  useEffect(() => {
    if (ready && signedIn && history === null) void ensureHistory();
  }, [ready, signedIn, history]);

  return (
    <Card title="Your year" icon="calendar">
      {!signedIn ? (
        <Muted>Sign in to see your year.</Muted>
      ) : history === null ? (
        <Skeleton label="Loading your year" />
      ) : history.length === 0 ? (
        <Muted>Your year fills in as you keep repeating actions.</Muted>
      ) : (
        <ul className={styles.list}>
          {history.map((row) => {
            const last30 = row.days.slice(-30);
            const kept30 = last30.filter((d) => d > 0).length;
            return (
              <li key={row.id} className={styles.entry}>
                <div className={styles.between}>
                  <p className={styles.itemTitle}>
                    {row.name} {row.archived && <Tag>archived</Tag>}
                  </p>
                  <span className={styles.itemMeta}>
                    {row.keptThisYear} days this year{row.longestStreak > 1 ? ` · best run ${row.longestStreak}` : ''}
                  </span>
                </div>
                <div
                  role="img"
                  aria-label={`${row.name}: kept ${kept30} of the last 30 days`}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(30, 1fr)', gap: 2 }}
                >
                  {last30.map((d, i) => (
                    <span
                      key={i}
                      style={{
                        height: 14,
                        borderRadius: 2,
                        background: d > 0 ? 'var(--v2-interactive)' : 'var(--v2-line)',
                      }}
                    />
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function GrowthBoard({ signedIn, ready }: BoardProps) {
  const path = useHashPath();
  const tab = path[0] === 'inbox' ? 'inbox' : path[0] === 'year' ? 'year' : 'map';
  return (
    <div className={styles.stack}>
      <Tabs
        label="Growth Map"
        tabs={[
          { value: 'map', label: 'Journeys and actions' },
          { value: 'inbox', label: 'Inspiration Inbox' },
          { value: 'year', label: 'Your year' },
        ]}
        value={tab}
        onChange={(t) => setHashPath(...(t === 'map' ? [] : [t]))}
      />
      {tab === 'map' && (
        <div className={styles.grid}>
          <div className={styles.s7}>
            <JourneysCard signedIn={signedIn} ready={ready} />
          </div>
          <div className={styles.s5}>
            <ActionsCard signedIn={signedIn} ready={ready} />
          </div>
        </div>
      )}
      {tab === 'inbox' && (
        <div className={styles.grid}>
          <div className={styles.s8}>
            <InboxCard signedIn={signedIn} />
          </div>
        </div>
      )}
      {tab === 'year' && <YearCard signedIn={signedIn} ready={ready} />}
    </div>
  );
}

/** The route's content, with who is signed in. */
export function GrowthScreen() {
  const { ready, signedIn } = useSurfaceState();
  return <GrowthBoard signedIn={signedIn} ready={ready} />;
}
