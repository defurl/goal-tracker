'use client';

// Feature 4 on /text — goals, their milestones, and the timeline.
//
// The timeline is hand-authored SVG, no charting library (FR-4.3). An overdue
// goal renders exactly like any other — no red, no warning mark, no urgency
// copy (FR-4.5, AC-4.4). Legible at 400 px with five goals (AC-4.3).

import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { MILESTONE_CAP, createGoal, loadGoalDetails, setMilestone, type CreateGoalOutcome, type GoalDetail } from '../../../lib/data/goals';
import { useAppStore, type GoalCategory } from '../../../lib/stores/app';

import styles from './text.module.css';

const CATEGORIES: GoalCategory[] = ['health', 'career', 'learning', 'relationships', 'finance', 'other'];

const ROW = 30;
const WIDTH = 400;
const TOP = 16;

function Timeline({ goals }: { goals: GoalDetail[] }) {
  if (goals.length === 0) return null;
  const todayIso = new Intl.DateTimeFormat('en-CA').format(new Date());
  const time = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime();
  const min = Math.min(...goals.map((g) => time(g.startDate)), time(todayIso));
  const max = Math.max(...goals.map((g) => time(g.targetDate)), time(todayIso));
  const span = Math.max(max - min, 86400e3);
  const x = (iso: string) => ((time(iso) - min) / span) * WIDTH;
  const height = TOP + goals.length * ROW;

  return (
    <svg
      className={styles.timeline}
      viewBox={`0 0 ${WIDTH} ${height}`}
      role="img"
      aria-label={`timeline of ${goals.length} goal${goals.length === 1 ? '' : 's'}`}
    >
      <line className={styles.timelineToday} x1={x(todayIso)} x2={x(todayIso)} y1={0} y2={height} />
      <text className={styles.timelineText} x={Math.min(x(todayIso) + 3, WIDTH - 30)} y={9}>
        today
      </text>
      {goals.map((g, i) => {
        const y = TOP + i * ROW;
        const start = x(g.startDate);
        const width = Math.max(x(g.targetDate) - start, 2);
        return (
          <g key={g.id}>
            <text className={styles.timelineText} x={0} y={y + 9}>
              {g.title.length > 44 ? `${g.title.slice(0, 43)}…` : g.title}
            </text>
            <line className={styles.timelineTrack} x1={0} x2={WIDTH} y1={y + 18} y2={y + 18} />
            <rect className={styles.timelineBar} x={start} y={y + 15} width={width} height={6} />
            <rect className={styles.timelineDone} x={start} y={y + 15} width={width * g.progress} height={6} />
          </g>
        );
      })}
    </svg>
  );
}

function createMessage(outcome: CreateGoalOutcome): string | null {
  switch (outcome) {
    case 'created':
      return null;
    case 'invalid_dates':
      return 'The target date comes before the start. Move one of them.';
    case 'invalid':
      return `A goal needs a title, both dates and one to ${MILESTONE_CAP} milestones.`;
    case 'signed_out':
      return 'Sign in to set goals.';
    case 'unavailable':
      return 'Not saved — the connection dropped. Try again in a moment.';
  }
}

function NewGoal({ onCreated }: { onCreated: () => void }) {
  const todayIso = new Intl.DateTimeFormat('en-CA').format(new Date());
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GoalCategory>('other');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(todayIso);
  const [targetDate, setTargetDate] = useState('');
  const [milestones, setMilestones] = useState<string[]>(['', '', '']);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const outcome = await createGoal({ title, category, description, startDate, targetDate, milestones });
    setMessage(createMessage(outcome));
    if (outcome === 'created') {
      setTitle('');
      setDescription('');
      setTargetDate('');
      setMilestones(['', '', '']);
      onCreated();
    }
  }

  const datesBackwards = Boolean(targetDate) && targetDate < startDate;

  return (
    <details className={styles.details}>
      <summary>set a goal</summary>
      <form className={styles.form} onSubmit={submit}>
        <label className={styles.field}>
          <span className={styles.label}>goal</span>
          <input className={styles.input} maxLength={120} required value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>kind</span>
          <select className={styles.select} value={category} onChange={(e) => setCategory(e.target.value as GoalCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.row}>
          <label className={styles.field}>
            <span className={styles.label}>start</span>
            <input className={styles.input} type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>target</span>
            <input
              className={styles.input}
              type="date"
              required
              min={startDate}
              value={targetDate}
              aria-describedby={datesBackwards ? 'goal-dates' : undefined}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
        </div>
        {datesBackwards && (
          <p id="goal-dates" className={styles.faint}>
            {createMessage('invalid_dates')}
          </p>
        )}
        <label className={styles.field}>
          <span className={styles.label}>why it matters (optional)</span>
          <textarea className={styles.textarea} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <fieldset className={styles.form}>
          <legend className={styles.label}>milestones · up to {MILESTONE_CAP}</legend>
          {milestones.map((m, i) => (
            <input
              key={i}
              className={styles.input}
              aria-label={`milestone ${i + 1}`}
              maxLength={120}
              value={m}
              onChange={(e) => setMilestones((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
            />
          ))}
          {milestones.length < MILESTONE_CAP && (
            <button type="button" className={styles.action} onClick={() => setMilestones((all) => [...all, ''])}>
              another milestone
            </button>
          )}
        </fieldset>

        <button type="submit" className={styles.primary} disabled={!title.trim() || !targetDate || datesBackwards}>
          set goal
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

export function GoalsSection({ signedIn }: { signedIn: boolean }) {
  // The store's summaries change when a milestone does; re-read the detail then.
  const summaries = useAppStore((s) => s.goals);
  const [goals, setGoals] = useState<GoalDetail[]>([]);

  const reload = useCallback(() => {
    void loadGoalDetails().then(setGoals);
  }, []);
  useEffect(() => {
    if (signedIn) reload();
    else setGoals([]);
  }, [signedIn, summaries, reload]);

  return (
    <section className={styles.section} aria-labelledby="goals-heading">
      <h2 id="goals-heading" className={styles.heading}>Goals</h2>

      {goals.length === 0 ? (
        <p className={styles.quiet}>
          No goals yet. Name one thing you want by a date, and break it into a few steps you can tick off.
        </p>
      ) : (
        <>
          <Timeline goals={goals} />
          <ul className={styles.list}>
            {goals.map((g) => {
              const done = g.milestones.filter((m) => m.complete).length;
              return (
                <li key={g.id} className={styles.goal}>
                  <span className={styles.prose}>{g.title}</span>
                  <span className={styles.faint}>
                    {g.category} · {g.startDate} → {g.targetDate} · {done} of {g.milestones.length} milestones
                  </span>
                  <ul className={styles.list} aria-label={`milestones for ${g.title}`}>
                    {g.milestones.map((m) => (
                      <li key={m.id} className={styles.item}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={m.complete}
                          aria-label={m.title}
                          className={styles.check}
                          disabled={!signedIn}
                          onClick={() => void setMilestone(m.id, !m.complete)}
                        />
                        <span className={`${styles.itemBody} ${styles.quiet}`}>{m.title}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {signedIn ? (
        <NewGoal onCreated={reload} />
      ) : (
        <p className={styles.faint}>
          <a href="/login" className={styles.label}>sign in</a> to set goals.
        </p>
      )}
    </section>
  );
}
