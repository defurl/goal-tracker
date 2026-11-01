'use client';

// Journal (functional specification §3): quick check-in (J01), free writing
// with drafts, search, edit and delete (J02), six guided modes (J03) and the
// week in counts with the user's own reflection (J04).
//
// Everything written here stays on this device (FR-3.6 as amended by D-26).
// Drafts too: they sit in this browser's localStorage until saved or cleared.

import { useEffect, useMemo, useRef, useState } from 'react';

import { CHECK_IN_FIELDS, hasContent, type CheckInFields, type DeviceEntry, type EntryType } from '@/lib/journal/deviceStore';
import { currentOwner, localToday, putEntry, removeEntry, useJournalStore } from '@/lib/journal/device';
import { CHECK_IN_QUESTIONS, GUIDED_VERSION, J03_MODES, guidedMode } from '@/lib/journal/guided';
import { MOODS, TOPIC_TAGS } from '@/lib/journal/moods';
import { MIN_TREND_ENTRIES, summariseWeek } from '@/lib/journal/weekly';
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
  SaveStatus,
  Skeleton,
  Tabs,
  Tag,
  inputClass,
  textareaClass,
  type SaveState,
} from '@/components/ui/kit';
import { DeviceJournalCard } from '@/features/settings/DeviceJournalCard';

import { useSurfaceState } from '@/app/(app)/useSurfaceState';

import styles from '@/features/today/today.module.css';

type BoardProps = { signedIn: boolean; ready: boolean };
type Mode = 'check-in' | 'free' | 'guided';
type Energy = 1 | 2 | 3 | 4 | 5;

const MOOD_OPTIONS = MOODS.map((m) => ({ value: m.key, label: `${m.emoji} ${m.label}` }));
const TAG_OPTIONS = TOPIC_TAGS.map((t) => ({ value: t, label: t }));
const ENERGY_OPTIONS = (['1', '2', '3', '4', '5'] as const).map((n) => ({ value: n, label: n }));

// ── drafts on the device ──────────────────────────────────────────────────

interface Draft {
  title: string;
  body: string;
  moods: string[];
  tags: string[];
  energy: Energy | null;
  fields: CheckInFields;
}

const EMPTY: Draft = { title: '', body: '', moods: [], tags: [], energy: null, fields: {} };

function draftKey(mode: Mode, promptId: string | null): string {
  return `bbe-journal-draft:${currentOwner()}:${mode}:${promptId ?? ''}`;
}

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<Draft>) } : null;
  } catch {
    return null;
  }
}

function writeDraft(key: string, draft: Draft | null): void {
  try {
    if (draft) localStorage.setItem(key, JSON.stringify(draft));
    else localStorage.removeItem(key);
  } catch {
    // Storage refused: the text stays in the form, which is what matters.
  }
}

function fromEntry(e: DeviceEntry): Draft {
  return {
    title: e.title ?? '',
    body: e.body,
    moods: e.moods,
    tags: e.tags,
    energy: e.energy,
    fields: e.fields ?? {},
  };
}

// ── the editor: one form for all three kinds ──────────────────────────────

function EntryEditor({
  mode,
  promptId,
  editing,
  onDone,
}: {
  mode: Mode;
  promptId: string | null;
  editing: DeviceEntry | null;
  onDone: () => void;
}) {
  const key = draftKey(mode, promptId);
  const [draft, setDraft] = useState<Draft>(() => (editing ? fromEntry(editing) : (readDraft(key) ?? EMPTY)));
  const [save, setSave] = useState<SaveState>('idle');
  const resumed = useRef(!editing && readDraft(key) !== null);
  const guide = mode === 'guided' ? guidedMode(promptId) : undefined;

  // Keep a draft of new entries as they are typed (F-02: resume a draft).
  useEffect(() => {
    if (editing) return;
    const blank = !hasContent({ ...draft, title: draft.title || null });
    writeDraft(key, blank ? null : draft);
  }, [draft, editing, key]);

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSave('dirty');
  };

  const canSave = hasContent({ ...draft, title: draft.title || null }) && save !== 'saving';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave) return;
    setSave('saving');
    const type: EntryType = mode;
    const saved = await putEntry(
      {
        type,
        title: mode === 'free' ? draft.title.trim() || null : (guide?.title ?? null),
        body: draft.body,
        prompt: guide ? `${guide.id}@v${GUIDED_VERSION}` : null,
        tags: draft.tags,
        moods: draft.moods,
        energy: draft.energy,
        fields: mode === 'check-in' ? draft.fields : undefined,
      },
      editing?.id,
    );
    if (!saved) {
      // F-02: retry without losing typed text.
      setSave('failed');
      return;
    }
    writeDraft(key, null);
    setDraft(EMPTY);
    setSave('saved');
    resumed.current = false;
    if (editing) onDone();
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {resumed.current && save === 'idle' && (
        <div className={styles.between}>
          <Muted>Picked up your unsaved draft.</Muted>
          <Button
            variant="tertiary"
            onClick={() => {
              writeDraft(key, null);
              setDraft(EMPTY);
              resumed.current = false;
              setSave('idle');
            }}
          >
            Start fresh
          </Button>
        </div>
      )}

      {guide && (
        <div>
          <p className={styles.itemTitle}>{guide.title}</p>
          <Muted>{guide.intro}</Muted>
          <ul className={styles.steps}>
            {guide.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {mode === 'check-in' && (
        <>
          <Chips legend="Mood (any you like)" options={MOOD_OPTIONS} value={draft.moods} multiple onChange={(moods) => update({ moods: moods.slice(0, 4) })} />
          <Chips
            legend="Energy, 1 to 5"
            options={ENERGY_OPTIONS}
            value={draft.energy ? [String(draft.energy) as '1'] : []}
            onChange={(v) => update({ energy: v[0] ? (Number(v[0]) as Energy) : null })}
          />
          <div className={styles.twoCols}>
            {CHECK_IN_FIELDS.map((f) => (
              <Field key={f} label={CHECK_IN_QUESTIONS[f]}>
                {(p) => (
                  <textarea
                    {...p}
                    className={textareaClass}
                    style={{ minHeight: 72 }}
                    maxLength={2000}
                    value={draft.fields[f] ?? ''}
                    onChange={(e) => update({ fields: { ...draft.fields, [f]: e.target.value } })}
                  />
                )}
              </Field>
            ))}
          </div>
        </>
      )}

      {mode === 'free' && (
        <Field label="Title (optional)">
          {(p) => (
            <input {...p} className={inputClass} maxLength={200} value={draft.title} onChange={(e) => update({ title: e.target.value })} />
          )}
        </Field>
      )}

      {mode !== 'check-in' && (
        <Field label={mode === 'free' ? 'Write' : 'Your answer'} hint={`${draft.body.length.toLocaleString()} / 20,000`}>
          {(p) => (
            <textarea
              {...p}
              className={textareaClass}
              style={{ minHeight: 220 }}
              maxLength={20000}
              value={draft.body}
              onChange={(e) => update({ body: e.target.value })}
            />
          )}
        </Field>
      )}

      <Chips legend="Tags" options={TAG_OPTIONS} value={draft.tags} multiple onChange={(tags) => update({ tags })} />

      <div className={styles.row}>
        <Button type="submit" variant="primary" disabled={!canSave}>
          {editing ? 'Save changes' : 'Save entry'}
        </Button>
        {editing && <Button onClick={onDone}>Cancel</Button>}
        <SaveStatus state={save === 'saved' ? 'saved' : save} />
      </div>
      {save === 'failed' && <ErrorText>This device would not save it. Your text is still here. Try again.</ErrorText>}
      {!canSave && save !== 'saving' && <Muted>Fill in any one thing to save: a mood, a line, an answer.</Muted>}
    </form>
  );
}

// ── write ─────────────────────────────────────────────────────────────────

function WriteCard({ path }: { path: string[] }) {
  const mode: Mode = path[0] === 'free' ? 'free' : path[0] === 'prompt' || path[0] === 'guided' ? 'guided' : 'check-in';
  const promptId = mode === 'guided' ? (path[1] ?? null) : null;
  return (
    <Card title="Write" icon="pen">
      <Tabs
        label="Kind of entry"
        tabs={[
          { value: 'check-in', label: 'Quick check-in' },
          { value: 'free', label: 'Free writing' },
          { value: 'guided', label: 'Guided' },
        ]}
        value={mode}
        onChange={(m) => setHashPath(m === 'guided' ? 'guided' : m)}
      />
      {mode === 'guided' && !promptId ? (
        <div className={styles.tiles}>
          {J03_MODES.map((id) => {
            const g = guidedMode(id);
            if (!g) return null;
            return (
              <a key={id} href={`#prompt/${id}`} className={styles.tile} style={{ textDecoration: 'none', color: 'inherit' }}>
                <p className={styles.tileTitle}>{g.title}</p>
                <Muted>{g.intro}</Muted>
              </a>
            );
          })}
        </div>
      ) : (
        <EntryEditor key={`${mode}:${promptId ?? ''}`} mode={mode} promptId={promptId} editing={null} onDone={() => undefined} />
      )}
    </Card>
  );
}

// ── history: search, edit, delete ─────────────────────────────────────────

function entryHeading(e: DeviceEntry): string {
  if (e.title) return e.title;
  if (e.type === 'check-in') return 'Check-in';
  return guidedMode(e.prompt?.split('@')[0])?.title ?? 'Entry';
}

function EntryView({ entry, onEdit }: { entry: DeviceEntry; onEdit: () => void }) {
  const date = new Date(`${entry.localDate}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  return (
    <article className={styles.entry}>
      <div className={styles.between}>
        <p className={styles.itemTitle}>{entryHeading(entry)}</p>
        <span className={styles.itemMeta}>{date}</span>
      </div>
      {(entry.moods.length > 0 || entry.energy !== null) && (
        <p className={styles.itemMeta}>
          {entry.moods.map((m) => MOODS.find((x) => x.key === m)?.label ?? m).join(', ')}
          {entry.energy !== null && `${entry.moods.length ? ' · ' : ''}energy ${entry.energy}/5`}
        </p>
      )}
      {entry.fields &&
        CHECK_IN_FIELDS.filter((f) => entry.fields?.[f]?.trim()).map((f) => (
          <p key={f} className={styles.entryBody}>
            <strong>{CHECK_IN_QUESTIONS[f]}:</strong> {entry.fields?.[f]}
          </p>
        ))}
      {entry.body && <p className={styles.entryBody}>{entry.body}</p>}
      {entry.tags.length > 0 && (
        <div className={styles.row}>
          {entry.tags.map((t) => (
            <Tag key={t}>{t}</Tag>
          ))}
        </div>
      )}
      <div className={styles.row}>
        <Button variant="tertiary" onClick={onEdit}>
          Edit
        </Button>
        <ArmButton size="small" label="Delete" armedLabel="Press again to delete" onFire={() => void removeEntry(entry.id)} />
      </div>
    </article>
  );
}

function HistoryCard() {
  const { entries, loaded, unavailable } = useJournalStore();
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tag, setTag] = useState<string[]>([]);
  const [editing, setEditing] = useState<DeviceEntry | null>(null);

  const shown = useMemo(() => {
    const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return entries.filter((e) => {
      if (from && e.localDate < from) return false;
      if (to && e.localDate > to) return false;
      if (tag[0] && !e.tags.includes(tag[0])) return false;
      if (!words.length) return true;
      const hay = `${e.title ?? ''}\n${e.body}\n${Object.values(e.fields ?? {}).join('\n')}\n${e.tags.join(' ')}`.toLocaleLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [entries, query, from, to, tag]);

  if (editing) {
    return (
      <Card title="Edit entry" icon="pen">
        <EntryEditor
          mode={editing.type}
          promptId={editing.prompt?.split('@')[0] ?? null}
          editing={editing}
          onDone={() => setEditing(null)}
        />
      </Card>
    );
  }

  return (
    <Card title="Your entries" icon="search">
      <div className={styles.twoCols}>
        <Field label="Search">
          {(p) => <input {...p} type="search" className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} />}
        </Field>
        <div className={styles.twoCols}>
          <Field label="From">
            {(p) => <input {...p} type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />}
          </Field>
          <Field label="To">
            {(p) => <input {...p} type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />}
          </Field>
        </div>
      </div>
      <Chips legend="Tag" options={TAG_OPTIONS} value={tag} onChange={setTag} />
      {!loaded ? (
        <Skeleton label="Loading your entries" />
      ) : unavailable ? (
        <ErrorText>This browser will not open its storage, so entries cannot be shown. Private windows often do this.</ErrorText>
      ) : entries.length === 0 ? (
        <Empty action={<Button onClick={() => setHashPath('check-in')}>Write the first one</Button>}>
          Nothing written yet. Entries stay on this device.
        </Empty>
      ) : shown.length === 0 ? (
        <Muted>No entries match. Try fewer words or a wider date range.</Muted>
      ) : (
        <div>
          <Muted>
            {shown.length} of {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Muted>
          {shown.slice(0, 50).map((e) => (
            <EntryView key={e.id} entry={e} onEdit={() => setEditing(e)} />
          ))}
          {shown.length > 50 && <Muted>Showing the newest 50. Search or narrow the dates to find older ones.</Muted>}
        </div>
      )}
    </Card>
  );
}

// ── the week ──────────────────────────────────────────────────────────────

function WeekCard() {
  const entries = useJournalStore((s) => s.entries);
  const week = useMemo(() => summariseWeek(entries, localToday()), [entries]);
  const enough = week.entries >= MIN_TREND_ENTRIES;
  return (
    <Card title="This week" icon="bars">
      <Muted>
        {week.entries} {week.entries === 1 ? 'entry' : 'entries'} on {week.days} of 7 days. These are counts of what you
        recorded, not causes.
      </Muted>
      {!enough ? (
        <Muted>Not enough entries to draw a trend yet.</Muted>
      ) : (
        <>
          {week.moods.length > 0 && (
            <div>
              <p className={styles.itemTitle}>Moods you named</p>
              <div className={styles.row}>
                {week.moods.slice(0, 6).map((m) => (
                  <Tag key={m.key}>
                    {MOODS.find((x) => x.key === m.key)?.label ?? m.key} × {m.count}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          {week.energy && (
            <Muted>
              Average energy {week.energy.mean} out of 5, from {week.energy.samples}{' '}
              {week.energy.samples === 1 ? 'entry' : 'entries'}.
            </Muted>
          )}
          {week.tags.length > 0 && (
            <div>
              <p className={styles.itemTitle}>Topics</p>
              <div className={styles.row}>
                {week.tags.slice(0, 6).map((t) => (
                  <Tag key={t.key}>
                    {t.key} × {t.count}
                  </Tag>
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <a href="#prompt/weekly" className={styles.promptButton}>
        <Icon name="pen" />
        Write your weekly reflection
      </a>
    </Card>
  );
}

export function JournalBoard({ signedIn }: BoardProps) {
  const path = useHashPath();
  const tab = path[0] === 'history' ? 'history' : path[0] === 'week' ? 'week' : 'write';
  return (
    <div className={styles.grid}>
      <div className={`${styles.stack} ${styles.s8}`}>
        <Tabs
          label="Journal"
          tabs={[
            { value: 'write', label: 'Write' },
            { value: 'history', label: 'History' },
            { value: 'week', label: 'This week' },
          ]}
          value={tab}
          onChange={(t) => setHashPath(...(t === 'write' ? [] : [t]))}
        />
        {tab === 'write' && <WriteCard path={path} />}
        {tab === 'history' && <HistoryCard />}
        {tab === 'week' && <WeekCard />}
      </div>
      <div className={`${styles.stack} ${styles.s4}`}>
        <DeviceJournalCard signedIn={signedIn} />
        {tab !== 'week' && <WeekCard />}
      </div>
    </div>
  );
}

/** The route's content, with who is signed in. */
export function JournalScreen() {
  const { ready, signedIn } = useSurfaceState();
  return <JournalBoard signedIn={signedIn} ready={ready} />;
}
