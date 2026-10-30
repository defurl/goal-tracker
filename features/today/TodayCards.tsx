'use client';

// Today (functional specification §2, Figma frame 02): greeting and date (in the page), the
// week, the focus list, the challenge, mood, energy, habits, a quick journal
// line and an inspiration. Every widget links to its module. Nothing here
// judges a missed day: an empty day is just empty (X-5, D-09).

import Link from 'next/link';
import { useState } from 'react';

import { rollReason as rollReasonFor } from '@/lib/challenge/copy';
import { completeChallenge, rollChallenge } from '@/lib/data/challenge';
import { checkHabit } from '@/lib/data/habits';
import { localToday, putEntry, useJournalStore } from '@/lib/journal/device';
import { MOODS } from '@/lib/journal/moods';
import { useAppStore } from '@/lib/stores/app';
import { Icon } from '@/components/ui/icons';
import { Button, Card, Empty, ErrorText, Meter, Muted, Ring, Skeleton, VisuallyHidden, buttonClass, inputClass } from '@/components/ui/kit';

import styles from './today.module.css';

type BoardProps = { signedIn: boolean; ready: boolean };

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const QUICK_PROMPTS = [
  { id: 'grateful', label: 'What am I grateful for today?', icon: 'sun' },
  { id: 'learned', label: 'What did I learn today?', icon: 'sprout' },
  { id: 'tomorrow', label: 'What can I do tomorrow, a little better?', icon: 'leaf' },
] as const;

function SignInHint() {
  return (
    <Empty action={<Link className={buttonClass('primary', true)} href="/login">Sign in</Link>}>
      Sign in to keep your actions and points with you.
    </Empty>
  );
}

// ── the week ──────────────────────────────────────────────────────────────

function WeekCard() {
  const dayGrid = useAppStore((s) => s.dayGrid);
  const habits = useAppStore((s) => s.habits);
  const todayDone = habits.some((h) => h.completedToday);
  const now = new Date();
  // Monday first. Days after today in this week are simply blank.
  const mondayOffset = (now.getDay() + 6) % 7;
  const days = WEEKDAYS.map((label, i) => {
    const back = mondayOffset - i;
    const date = new Date(now);
    date.setDate(now.getDate() - back);
    let on = false;
    if (back === 0) on = todayDone;
    else if (back > 0) on = dayGrid[dayGrid.length - 1 - back] === 1;
    return { label, day: date.getDate(), on, isToday: back === 0, future: back < 0 };
  });
  return (
    <Card title="This week" icon="calendar" action={<Link className={buttonClass('tertiary')} href="/growth">View detail</Link>}>
      <ol className={styles.week}>
        {days.map((d) => (
          <li key={d.label} className={`${styles.weekDay} ${d.isToday ? styles.weekToday : ''}`}>
            <span>{d.label}</span>
            <span
              className={`${styles.weekMark} ${d.on ? styles.weekMarkOn : ''} ${d.isToday && !d.on ? styles.weekTodayMark : ''}`}
              role="img"
              aria-label={`${d.label} ${d.day}${d.isToday ? ', today' : ''}${d.on ? ', something done' : ''}`}
            >
              {d.on ? <Icon name="check" size={16} /> : <span aria-hidden="true">{d.day}</span>}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ── focus: today's due actions ────────────────────────────────────────────

function FocusCard({ signedIn, ready }: BoardProps) {
  const habits = useAppStore((s) => s.habits);
  const due = habits.filter((h) => h.dueToday);
  return (
    <Card title="Today’s focus" icon="target" action={<Link className={buttonClass('tertiary')} href="/growth">Edit</Link>}>
      {!ready ? (
        <Skeleton label="Loading today’s focus" />
      ) : !signedIn ? (
        <SignInHint />
      ) : due.length === 0 ? (
        <Empty action={<Link className={buttonClass('secondary', true)} href="/growth">Add a repeating action</Link>}>
          Nothing planned for today. Small, repeating actions live in the Growth Map.
        </Empty>
      ) : (
        <ul className={styles.list}>
          {due.map((h) => (
            <li key={h.id} className={styles.item}>
              <button
                type="button"
                role="checkbox"
                aria-checked={h.completedToday}
                aria-label={h.name}
                className={styles.check}
                onClick={() => void checkHabit(h.id, !h.completedToday)}
              >
                <span>{h.completedToday && <Icon name="check" size={16} />}</span>
              </button>
              <span className={`${styles.itemMain} ${h.completedToday ? styles.done : ''}`}>{h.name}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── the daily challenge ───────────────────────────────────────────────────

function ChallengeCard({ signedIn, ready }: BoardProps) {
  const challenge = useAppStore((s) => s.challenge);
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    await task();
    setBusy(false);
  };
  const reason = rollReasonFor(challenge);
  return (
    <Card title="Daily challenge" icon="bolt">
      {!ready ? (
        <Skeleton label="Loading today’s challenge" />
      ) : !signedIn ? (
        <SignInHint />
      ) : !challenge ? (
        <Empty action={<Link className={buttonClass('secondary', true)} href="/growth">Open the Inspiration Inbox</Link>}>
          Save something that inspired you and it becomes a two-minute action, waiting here each morning.
        </Empty>
      ) : (
        <>
          <p className={styles.bigAction}>{challenge.actionText}</p>
          {challenge.sourceSummary && <Muted>{challenge.sourceSummary}</Muted>}
          {challenge.complete ? (
            <p className={styles.row}>
              <Icon name="check" /> Done today. A small step counts.
            </p>
          ) : (
            <div className={styles.row}>
              <Button
                variant="primary"
                icon="check"
                disabled={busy || !challenge.id}
                onClick={() => challenge.id && run(() => completeChallenge(challenge.id as string))}
              >
                Mark as done
              </Button>
              <Button
                disabled={busy || challenge.rollsRemaining === 0}
                aria-describedby={reason ? 'skip-reason' : undefined}
                onClick={() => challenge.id && run(() => rollChallenge(challenge.id as string))}
              >
                Skip · {challenge.rollsRemaining} left
              </Button>
            </div>
          )}
          {reason && <Muted id="skip-reason">{reason}</Muted>}
        </>
      )}
    </Card>
  );
}

// ── mood and energy: today's check-in on this device ──────────────────────

function useTodayCheckIn() {
  const entries = useJournalStore((s) => s.entries);
  const date = localToday();
  return entries.find((e) => e.type === 'check-in' && e.localDate === date) ?? null;
}

function MoodCard() {
  const checkIn = useTodayCheckIn();
  const [failed, setFailed] = useState(false);
  const selected = checkIn?.moods ?? [];

  async function pick(key: string) {
    setFailed(false);
    const moods = selected.includes(key) ? selected.filter((m) => m !== key) : [key, ...selected].slice(0, 4);
    const saved = await putEntry(
      {
        type: 'check-in',
        title: null,
        body: checkIn?.body ?? '',
        prompt: null,
        tags: checkIn?.tags ?? [],
        moods,
        energy: checkIn?.energy ?? null,
        fields: checkIn?.fields,
      },
      checkIn?.id,
    );
    if (!saved) setFailed(true);
  }

  return (
    <Card title="Today’s mood" icon="smile" action={<Link className={buttonClass('tertiary')} href="/journal">Check in</Link>}>
      <div className={styles.row} role="group" aria-label="How are you feeling?">
        {MOODS.slice(0, 6).map((m) => (
          <button
            key={m.key}
            type="button"
            className={`${buttonClass('secondary', true)} ${styles.toggle}`}
            aria-pressed={selected.includes(m.key)}
            onClick={() => void pick(m.key)}
          >
            <span aria-hidden="true">{m.emoji}</span> {m.label}
          </button>
        ))}
      </div>
      <Muted>Saved on this device only. Any mood is fine.</Muted>
      {failed && <ErrorText>This device would not save it. Try again, or check the browser’s storage settings.</ErrorText>}
    </Card>
  );
}

function EnergyCard({ signedIn }: { signedIn: boolean }) {
  const checkIn = useTodayCheckIn();
  const habits = useAppStore((s) => s.habits);
  const due = habits.filter((h) => h.dueToday);
  const doneCount = due.filter((h) => h.completedToday).length;

  async function setEnergy(level: 1 | 2 | 3 | 4 | 5) {
    await putEntry(
      {
        type: 'check-in',
        title: null,
        body: checkIn?.body ?? '',
        prompt: null,
        tags: checkIn?.tags ?? [],
        moods: checkIn?.moods ?? [],
        energy: checkIn?.energy === level ? null : level,
        fields: checkIn?.fields,
      },
      checkIn?.id,
    );
  }

  return (
    <Card title="Energy and focus" icon="bars">
      <Meter label="Energy" value={checkIn?.energy ?? null} max={5} tone="signal" />
      {signedIn && due.length > 0 && <Meter label="Actions" value={doneCount} max={due.length} />}
      <div className={styles.row} role="group" aria-label="Set today’s energy, 1 to 5">
        {([1, 2, 3, 4, 5] as const).map((n) => (
          <button
            key={n}
            type="button"
            className={`${buttonClass('secondary', true)} ${styles.toggle}`}
            aria-pressed={checkIn?.energy === n}
            aria-label={`Energy ${n} of 5`}
            onClick={() => void setEnergy(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </Card>
  );
}

// ── habits ────────────────────────────────────────────────────────────────

function HabitsCard({ signedIn, ready }: BoardProps) {
  const habits = useAppStore((s) => s.habits);
  return (
    <Card title="Habits" icon="sprout" action={<Link className={buttonClass('tertiary')} href="/growth">See all</Link>}>
      {!ready ? (
        <Skeleton label="Loading habits" />
      ) : !signedIn ? (
        <SignInHint />
      ) : habits.length === 0 ? (
        <Empty action={<Link className={buttonClass('secondary', true)} href="/growth">Start a habit</Link>}>
          No habits yet. One small one is plenty.
        </Empty>
      ) : (
        <div className={styles.rings}>
          {habits.map((h) => (
            <button
              key={h.id}
              type="button"
              className={styles.ringButton}
              disabled={!h.dueToday}
              aria-pressed={h.completedToday}
              aria-label={`${h.name}: ${h.completedToday ? 'done today' : h.dueToday ? 'not yet today' : 'not due today'}`}
              onClick={() => void checkHabit(h.id, !h.completedToday)}
            >
              <Ring
                value={h.completedToday ? 1 : 0}
                label={h.name}
                sub={h.longestStreak > 0 ? `best run ${h.longestStreak}` : h.dueToday ? 'today' : 'rest day'}
              >
                {h.completedToday && (
                  <path d="m22 33 7 7 13-15" fill="none" stroke="currentColor" strokeWidth="4" className={styles.ringCheck} />
                )}
              </Ring>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

// ── quick journal ─────────────────────────────────────────────────────────

function QuickJournalCard() {
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setState('saving');
    const saved = await putEntry({
      type: 'guided',
      title: 'One good thing',
      body: text.trim(),
      prompt: 'one-good-thing',
      tags: [],
      moods: [],
      energy: null,
    });
    if (saved) {
      setText('');
      setState('saved');
    } else setState('failed');
  }

  return (
    <Card title="Quick journal" icon="pen" action={<Link className={buttonClass('tertiary')} href="/journal">Open full journal</Link>}>
      <form className={styles.row} onSubmit={save}>
        <label htmlFor="quick-journal" className={styles.itemMain}>
          <VisuallyHidden>One good thing that happened today</VisuallyHidden>
          <input
            id="quick-journal"
            className={inputClass}
            value={text}
            maxLength={2000}
            placeholder="What’s one good thing that happened today?"
            onChange={(e) => {
              setText(e.target.value);
              if (state !== 'saving') setState('idle');
            }}
          />
        </label>
        <Button type="submit" variant="primary" disabled={!text.trim() || state === 'saving'}>
          Save
        </Button>
      </form>
      {state === 'saved' && <Muted>Saved to your journal on this device.</Muted>}
      {state === 'failed' && <ErrorText>Not saved. Your text is still here; try again.</ErrorText>}
      <div className={styles.prompts}>
        {QUICK_PROMPTS.map((p) => (
          <Link key={p.id} className={styles.promptButton} href="/journal">
            <Icon name={p.icon} />
            {p.label}
          </Link>
        ))}
      </div>
    </Card>
  );
}

// ── inspiration ───────────────────────────────────────────────────────────

function InspirationCard({ signedIn }: { signedIn: boolean }) {
  const challenge = useAppStore((s) => s.challenge);
  const summary = signedIn ? challenge?.sourceSummary : null;
  return (
    <Card title="Today’s inspiration" icon="sparkle" action={<Link className={buttonClass('tertiary')} href="/growth">Inbox</Link>}>
      {summary ? (
        <>
          <p className={styles.quote}>{summary}</p>
          {challenge?.sourceUrl && <p className={styles.source}>From {new URL(challenge.sourceUrl).hostname}</p>}
        </>
      ) : (
        <>
          <p className={styles.quote}>Not every day has to be productive. Some days are just for living.</p>
          <Muted>Save an article or a note to the Inspiration Inbox and its best idea shows up here.</Muted>
        </>
      )}
    </Card>
  );
}

export function TodayCards({ signedIn, ready }: BoardProps) {
  const points = useAppStore((s) => s.points);
  return (
    <div className={styles.grid}>
      <div className={`${styles.stack} ${styles.s3}`}>
        <ChallengeCard signedIn={signedIn} ready={ready} />
        {signedIn && points.total > 0 && (
          <Card title="Points" icon="leaf" action={<Link className={buttonClass('tertiary')} href="/settings">Shop</Link>}>
            <p className={styles.bigAction}>{points.total} earned</p>
            <Muted>{points.today > 0 ? `${points.today} today.` : 'Points come from things you finish.'}</Muted>
          </Card>
        )}
      </div>
      <div className={`${styles.stack} ${styles.s5}`}>
        <FocusCard signedIn={signedIn} ready={ready} />
        <HabitsCard signedIn={signedIn} ready={ready} />
        <InspirationCard signedIn={signedIn} />
      </div>
      <div className={`${styles.stack} ${styles.s4}`}>
        <MoodCard />
        <EnergyCard signedIn={signedIn} />
        <QuickJournalCard />
        <WeekCard />
      </div>
    </div>
  );
}
