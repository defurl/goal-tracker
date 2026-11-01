'use client';

// Self Care (functional specification §5): "what do you need right now?"
// with rule-based picks (SC01), the library (SC02), a session you can start,
// pause, stop, skip or finish — only finishing counts (SC03), routines you
// build and check off (SC04), and a short list of good places to go (SC05).
// Skipping is never failing, and a missed routine day changes nothing.

import { useEffect, useMemo, useState } from 'react';

import {
  ACTIVITIES,
  CATEGORIES,
  DURATIONS,
  EXTERNAL,
  NEEDS,
  activity as activityById,
  recommend,
  type Activity,
  type Filters,
  type Need,
} from '@/lib/content/selfcare';
import { useDeviceState } from '@/lib/device/deviceState';
import { localToday } from '@/lib/journal/device';
import { Icon } from '@/components/ui/icons';
import { ArmButton, Button, Card, Chips, Empty, Field, Muted, Tag, inputClass } from '@/components/ui/kit';

import { useSurfaceState } from '@/app/(app)/useSurfaceState';

import styles from '@/features/today/today.module.css';

type BoardProps = { signedIn: boolean; ready: boolean };
type Feedback = 'helpful' | 'neutral' | 'not-helpful';

interface Session {
  id: string;
  activityId: string;
  status: 'completed' | 'stopped' | 'skipped';
  feedback: Feedback | null;
  note: string;
  date: string;
  seconds: number;
}

interface Routine {
  id: string;
  name: string;
  items: { id: string; text: string }[];
  days: number[];
  paused: boolean;
  archived: boolean;
  /** date → item ids checked that day */
  checks: Record<string, string[]>;
}

interface SelfCareState {
  sessions: Session[];
  feedback: Record<string, Feedback>;
  routines: Routine[];
}

const INITIAL: SelfCareState = { sessions: [], feedback: {}, routines: [] };

const id = () => Math.random().toString(36).slice(2, 10);
const minutes = (a: Activity) => (a.minutes >= 20 ? `${a.minutes} min` : `${a.minutes} min`);
const categoryLabel = (c: Activity['category']) => CATEGORIES.find((x) => x.value === c)?.label ?? c;

const WEEK = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
] as const;

function formatClock(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── a session ─────────────────────────────────────────────────────────────

function SessionCard({
  activity,
  onEnd,
  onClose,
}: {
  activity: Activity;
  onEnd: (s: Omit<Session, 'id' | 'date'>) => void;
  onClose: () => void;
}) {
  const [state, setState] = useState<'ready' | 'running' | 'paused' | 'finished'>('ready');
  const [seconds, setSeconds] = useState(0);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (state !== 'running') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  const end = (status: Session['status']) =>
    onEnd({ activityId: activity.id, status, feedback: feedback[0] ?? null, note: note.trim(), seconds });

  return (
    <Card title={activity.title} icon="heart" action={<Button variant="tertiary" onClick={onClose}>Close</Button>}>
      <Muted>
        {categoryLabel(activity.category)} · about {minutes(activity)} · {activity.energy} energy
      </Muted>
      <p className={styles.itemTitle}>{activity.purpose}</p>
      {activity.setup && <Muted>Before you start: {activity.setup}</Muted>}
      <ol className={styles.steps}>
        {activity.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      {activity.safety && (
        <p className={styles.row} style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
          <Icon name="info" />
          <span>{activity.safety}</span>
        </p>
      )}

      {state === 'finished' ? (
        <div className={styles.form}>
          <p className={styles.itemTitle}>Done. How was it?</p>
          <Chips
            legend="Was it helpful? (optional)"
            options={[
              { value: 'helpful', label: 'Helpful' },
              { value: 'neutral', label: 'Neutral' },
              { value: 'not-helpful', label: 'Not helpful' },
            ]}
            value={feedback}
            onChange={(v) => setFeedback(v as Feedback[])}
          />
          <Field label="A private note (optional)" hint="Stays on this device.">
            {(p) => <input {...p} className={inputClass} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />}
          </Field>
          <div>
            <Button variant="primary" onClick={() => end('completed')}>
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          {state !== 'ready' && (
            <p className={styles.timer} aria-live="off">
              {formatClock(seconds)}
            </p>
          )}
          <div className={styles.row}>
            {state === 'ready' && (
              <Button variant="primary" onClick={() => setState('running')}>
                Start
              </Button>
            )}
            {state === 'running' && <Button onClick={() => setState('paused')}>Pause</Button>}
            {state === 'paused' && (
              <Button variant="primary" onClick={() => setState('running')}>
                Resume
              </Button>
            )}
            {state !== 'ready' && (
              <Button variant="primary" icon="check" onClick={() => setState('finished')}>
                I did it
              </Button>
            )}
            {state !== 'ready' && <Button onClick={() => end('stopped')}>Stop</Button>}
            <Button variant="tertiary" onClick={() => end('skipped')}>
              Skip this one
            </Button>
          </div>
          <Muted>There is no time to hit. Stop or skip whenever you like; only “I did it” counts as done.</Muted>
        </>
      )}
    </Card>
  );
}

// ── discovery ─────────────────────────────────────────────────────────────

function DiscoverCard({ onPick, feedback }: { onPick: (a: Activity) => void; feedback: Record<string, Feedback> }) {
  const [need, setNeed] = useState<Need[]>([]);
  const [time, setTime] = useState<string[]>([]);
  const [energy, setEnergy] = useState<string[]>([]);
  const [social, setSocial] = useState<string[]>([]);
  const [place, setPlace] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);

  const filters: Filters = {
    need: need[0] ?? null,
    maxMinutes: time[0] ? (DURATIONS.find((d) => d.value === time[0])?.max ?? null) : null,
    energy: (energy[0] as Filters['energy']) ?? null,
    social: (social[0] as Filters['social']) ?? null,
    place: (place[0] as Filters['place']) ?? null,
  };
  const picks = useMemo(
    () => recommend(filters, feedback),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filters is rebuilt each render from these values
    [need, time, energy, social, place, feedback],
  );
  // Three at a time; "Show other ideas" rotates through the rest.
  const shown =
    picks.length <= 3
      ? picks
      : [0, 1, 2].map((i) => picks[(offset + i) % picks.length]).filter((a): a is Activity => a !== undefined);

  return (
    <Card title="Choose your moment" icon="sparkle">
      <Chips legend="I feel" options={NEEDS} value={need} onChange={(v) => { setNeed(v); setOffset(0); }} />
      <div className={styles.twoCols}>
        <Chips legend="Time I have" options={DURATIONS.map(({ value, label }) => ({ value, label }))} value={time} onChange={setTime} />
        <Chips
          legend="Energy"
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
          value={energy}
          onChange={setEnergy}
        />
        <Chips
          legend="With"
          options={[
            { value: 'solo', label: 'On my own' },
            { value: 'social', label: 'With someone' },
          ]}
          value={social}
          onChange={setSocial}
        />
        <Chips
          legend="Where"
          options={[
            { value: 'indoor', label: 'Indoors' },
            { value: 'outdoor', label: 'Outdoors' },
          ]}
          value={place}
          onChange={setPlace}
        />
      </div>
      {shown.length === 0 ? (
        <Muted>Nothing fits all of that. Try loosening one filter.</Muted>
      ) : (
        <div className={styles.tiles}>
          {shown.map((a) => (
            <div key={a.id} className={styles.tile}>
              <p className={styles.tileTitle}>{a.title}</p>
              <Muted>{a.purpose}</Muted>
              <div className={styles.row}>
                <Tag>{minutes(a)}</Tag>
                <Tag>{a.energy} energy</Tag>
                {feedback[a.id] === 'helpful' && <Tag>helped before</Tag>}
              </div>
              <div>
                <Button size="small" variant="primary" onClick={() => onPick(a)}>
                  Try this
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {picks.length > 3 && (
        <div>
          <Button variant="tertiary" onClick={() => setOffset((o) => o + 3)}>
            Show other ideas
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── routines ──────────────────────────────────────────────────────────────

function RoutineEditor({ onSave, onCancel }: { onSave: (r: Routine) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [items, setItems] = useState<{ id: string; text: string }[]>([{ id: id(), text: '' }]);
  const [days, setDays] = useState<string[]>(['1', '2', '3', '4', '5', '6', '0']);
  const [fromCatalog, setFromCatalog] = useState('');

  const move = (i: number, by: number) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    if (x) next.splice(i + by, 0, x);
    setItems(next);
  };

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        const clean = items.map((i) => ({ ...i, text: i.text.trim() })).filter((i) => i.text);
        if (!name.trim() || clean.length === 0) return;
        onSave({ id: id(), name: name.trim(), items: clean, days: days.map(Number), paused: false, archived: false, checks: {} });
      }}
    >
      <Field label="Routine name">
        {(p) => <input {...p} className={inputClass} maxLength={80} value={name} placeholder="Evening wind-down" onChange={(e) => setName(e.target.value)} />}
      </Field>
      <fieldset className={styles.form} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: 6 }}>Steps</legend>
        {items.map((item, i) => (
          <div key={item.id} className={styles.row} style={{ flexWrap: 'nowrap' }}>
            <input
              className={inputClass}
              aria-label={`Step ${i + 1}`}
              maxLength={120}
              value={item.text}
              onChange={(e) => setItems(items.map((x) => (x.id === item.id ? { ...x, text: e.target.value } : x)))}
            />
            <Button size="small" variant="tertiary" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>
              Up
            </Button>
            <Button size="small" variant="tertiary" aria-label={`Remove step ${i + 1}`} onClick={() => setItems(items.filter((x) => x.id !== item.id))}>
              Remove
            </Button>
          </div>
        ))}
        <div className={styles.row}>
          <Button size="small" variant="tertiary" icon="plus" onClick={() => setItems([...items, { id: id(), text: '' }])}>
            Add my own step
          </Button>
          <select
            className={inputClass}
            style={{ width: 'auto' }}
            aria-label="Add a step from the library"
            value={fromCatalog}
            onChange={(e) => {
              const a = activityById(e.target.value);
              if (a) setItems([...items.filter((x) => x.text.trim()), { id: id(), text: a.title }]);
              setFromCatalog('');
            }}
          >
            <option value="">Add from the library…</option>
            {ACTIVITIES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      <Chips legend="Repeat on" options={WEEK} value={days} multiple onChange={setDays} />
      <div className={styles.row}>
        <Button type="submit" variant="primary" disabled={!name.trim() || !items.some((i) => i.text.trim()) || days.length === 0}>
          Save routine
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function RoutinesCard({ state, set }: { state: SelfCareState; set: (u: (s: SelfCareState) => SelfCareState) => void }) {
  const [adding, setAdding] = useState(false);
  const today = localToday();
  const weekday = new Date().getDay();
  const live = state.routines.filter((r) => !r.archived);
  const update = (rid: string, fn: (r: Routine) => Routine) =>
    set((s) => ({ ...s, routines: s.routines.map((r) => (r.id === rid ? fn(r) : r)) }));

  return (
    <Card
      title="Routines"
      icon="calendar"
      action={!adding ? <Button variant="tertiary" icon="plus" onClick={() => setAdding(true)}>New routine</Button> : undefined}
    >
      {adding ? (
        <RoutineEditor
          onCancel={() => setAdding(false)}
          onSave={(r) => {
            set((s) => ({ ...s, routines: [...s.routines, r] }));
            setAdding(false);
          }}
        />
      ) : live.length === 0 ? (
        <Empty action={<Button onClick={() => setAdding(true)}>Build a routine</Button>}>
          A short checklist you return to: a morning start, an evening wind-down. No penalty for missed days.
        </Empty>
      ) : (
        live.map((r) => {
          const due = r.days.includes(weekday) && !r.paused;
          const checked = r.checks[today] ?? [];
          return (
            <article key={r.id} className={styles.entry}>
              <div className={styles.between}>
                <p className={styles.itemTitle}>
                  {r.name} {r.paused && <Tag>paused</Tag>}
                </p>
                <span className={styles.itemMeta}>{due ? `${checked.length} of ${r.items.length} today` : r.paused ? '' : 'not today'}</span>
              </div>
              <ul className={styles.list}>
                {r.items.map((item) => {
                  const on = checked.includes(item.id);
                  return (
                    <li key={item.id} className={styles.item}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={on}
                        aria-label={item.text}
                        disabled={r.paused}
                        className={styles.check}
                        onClick={() =>
                          update(r.id, (x) => ({
                            ...x,
                            checks: { ...x.checks, [today]: on ? checked.filter((c) => c !== item.id) : [...checked, item.id] },
                          }))
                        }
                      >
                        <span>{on && <Icon name="check" size={16} />}</span>
                      </button>
                      <span className={`${styles.itemMain} ${on ? styles.done : ''}`}>{item.text}</span>
                    </li>
                  );
                })}
              </ul>
              <div className={styles.row}>
                <Button size="small" variant="tertiary" onClick={() => update(r.id, (x) => ({ ...x, paused: !x.paused }))}>
                  {r.paused ? 'Resume' : 'Pause'}
                </Button>
                <ArmButton size="small" label="Archive" armedLabel="Press again" onFire={() => update(r.id, (x) => ({ ...x, archived: true }))} />
              </div>
            </article>
          );
        })
      )}
    </Card>
  );
}

// ── library, places, history ──────────────────────────────────────────────

function LibraryCard({ onPick }: { onPick: (a: Activity) => void }) {
  return (
    <Card title="Library" icon="book">
      {CATEGORIES.map((c) => {
        const items = ACTIVITIES.filter((a) => a.category === c.value);
        return (
          <details key={c.value} className={styles.details}>
            <summary>
              {c.label} ({items.length})
            </summary>
            <ul className={styles.list}>
              {items.map((a) => (
                <li key={a.id} className={styles.item}>
                  <div className={styles.itemMain}>
                    <p className={styles.itemTitle}>{a.title}</p>
                    <p className={styles.itemMeta}>
                      {minutes(a)} · {a.social === 'social' ? 'with someone' : 'on your own'} · {a.place}
                    </p>
                  </div>
                  <Button size="small" onClick={() => onPick(a)}>
                    Open
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        );
      })}
    </Card>
  );
}

function PlacesCard() {
  return (
    <Card title="Good places to go" icon="link">
      <ul className={styles.list}>
        {EXTERNAL.map((r) => (
          <li key={r.id} className={styles.item}>
            <div className={styles.itemMain}>
              <a className={styles.itemTitle} href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--v2-interactive-ink)' }}>
                {r.title}
              </a>
              <p className={styles.itemMeta}>
                {r.source} · about {r.minutes} min · {r.description}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <Muted>Opens in a new tab. A short list on purpose.</Muted>
    </Card>
  );
}

function HistoryCard({ sessions }: { sessions: Session[] }) {
  const done = sessions.filter((s) => s.status === 'completed');
  return (
    <Card title="Recently" icon="clock">
      {sessions.length === 0 ? (
        <Muted>Your sessions show up here. Only what you finish counts as done.</Muted>
      ) : (
        <>
          <Muted>
            {done.length} done in the last {Math.min(sessions.length, 30)} sessions.
          </Muted>
          <ul className={styles.list}>
            {sessions.slice(0, 6).map((s) => (
              <li key={s.id} className={styles.item}>
                <div className={styles.itemMain}>
                  <p className={styles.itemTitle}>{activityById(s.activityId)?.title ?? 'Activity'}</p>
                  <p className={styles.itemMeta}>
                    {s.status === 'completed' ? 'done' : s.status === 'skipped' ? 'skipped' : 'stopped'} ·{' '}
                    {new Date(`${s.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {s.note ? ` · ${s.note}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}

export function SelfCareBoard({ signedIn }: BoardProps) {
  void signedIn;
  const [state, set] = useDeviceState<SelfCareState>('selfcare', INITIAL);
  const [open, setOpen] = useState<Activity | null>(null);

  return (
    <div className={styles.grid}>
      <div className={`${styles.stack} ${styles.s7}`}>
        {open ? (
          <SessionCard
            activity={open}
            onClose={() => setOpen(null)}
            onEnd={(s) => {
              set((st) => ({
                ...st,
                sessions: [{ ...s, id: id(), date: localToday() }, ...st.sessions].slice(0, 200),
                feedback: s.feedback ? { ...st.feedback, [s.activityId]: s.feedback } : st.feedback,
              }));
              setOpen(null);
            }}
          />
        ) : (
          <DiscoverCard onPick={setOpen} feedback={state.feedback} />
        )}
        <RoutinesCard state={state} set={set} />
      </div>
      <div className={`${styles.stack} ${styles.s5}`}>
        <HistoryCard sessions={state.sessions} />
        <LibraryCard onPick={setOpen} />
        <PlacesCard />
      </div>
    </div>
  );
}

/** The route's content, with who is signed in. */
export function SelfCareScreen() {
  const { ready, signedIn } = useSurfaceState();
  return <SelfCareBoard signedIn={signedIn} ready={ready} />;
}
