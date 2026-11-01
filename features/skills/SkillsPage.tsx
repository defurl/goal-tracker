'use client';

// Skills (functional specification §6): a curated library with search and
// filters (SK01), a detail view that shows where each resource comes from and
// opens it at its source (SK02), saves, self-reported progress and private
// takeaways (SK03), and "turn a takeaway into an action", which asks first
// (SK04). No skill bars: watching is not proof of a skill.

import { useMemo, useState } from 'react';

import { SKILLS, TOPICS, skill as skillById, type SkillResource } from '@/lib/content/skills';
import { approveAction } from '@/lib/data/challenge';
import { useDeviceState } from '@/lib/device/deviceState';
import { Icon } from '@/components/ui/icons';
import { Button, Card, Chips, ErrorText, Field, Muted, Tabs, Tag, inputClass, textareaClass } from '@/components/ui/kit';

import { useSurfaceState } from '@/app/(app)/useSurfaceState';

import styles from '@/features/today/today.module.css';

type BoardProps = { signedIn: boolean; ready: boolean };
type Progress = 'none' | 'in-progress' | 'completed';

interface Learning {
  saved: boolean;
  progress: Progress;
  takeaway: string;
  application: string;
}

interface SkillsState {
  items: Record<string, Learning>;
}

const INITIAL: SkillsState = { items: {} };
const BLANK: Learning = { saved: false, progress: 'none', takeaway: '', application: '' };

const PROGRESS_LABEL: Record<Progress, string> = {
  none: 'Not started',
  'in-progress': 'In progress',
  completed: 'Finished',
};

function Detail({
  resource,
  learning,
  update,
  signedIn,
  onBack,
}: {
  resource: SkillResource;
  learning: Learning;
  update: (patch: Partial<Learning>) => void;
  signedIn: boolean;
  onBack: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [action, setAction] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function saveAction() {
    setFailed(false);
    const ok = await approveAction({
      actionText: action,
      sourceSummary: `From “${resource.title}”: ${learning.takeaway}`.slice(0, 600),
      sourceUrl: resource.url,
      promptVersion: null,
    });
    if (ok) {
      setConfirming(false);
      setMessage('Saved to your actions. It can show up as a daily challenge.');
    } else setFailed(true);
  }

  return (
    <Card title={resource.title} icon="cap" action={<Button variant="tertiary" icon="back" onClick={onBack}>Library</Button>}>
      <div className={styles.row}>
        <Tag>{resource.topic}</Tag>
        <Tag>{resource.level}</Tag>
        <Tag>{resource.language}</Tag>
      </div>
      <p>{resource.summary}</p>
      <Muted>
        From {resource.source}. {resource.duration}. Link checked{' '}
        {new Date(`${resource.checked}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.
      </Muted>
      {resource.status === 'available' ? (
        <div className={styles.row}>
          <a className={`${styles.promptButton}`} style={{ minHeight: 44 }} href={resource.url} target="_blank" rel="noopener noreferrer">
            <Icon name="link" /> Open at {resource.source.split(',')[0]}
          </a>
          <Button aria-pressed={learning.saved} onClick={() => update({ saved: !learning.saved })}>
            {learning.saved ? 'Saved' : 'Save for later'}
          </Button>
        </div>
      ) : (
        <ErrorText>This resource is not available right now. Your notes below are kept.</ErrorText>
      )}

      <Chips
        legend="Your progress (your own call)"
        options={[
          { value: 'none', label: 'Not started' },
          { value: 'in-progress', label: 'In progress' },
          { value: 'completed', label: 'Finished' },
        ]}
        value={[learning.progress]}
        onChange={(v) => update({ progress: (v[0] as Progress) ?? 'none' })}
      />
      <Field label="Your takeaway" hint="Private, on this device.">
        {(p) => (
          <textarea {...p} className={textareaClass} style={{ minHeight: 80 }} maxLength={1000} value={learning.takeaway} onChange={(e) => update({ takeaway: e.target.value })} />
        )}
      </Field>
      <Field label="One way to use it">
        {(p) => <input {...p} className={inputClass} maxLength={300} value={learning.application} onChange={(e) => update({ application: e.target.value })} />}
      </Field>

      {signedIn && learning.takeaway.trim() && !confirming && (
        <div>
          <Button
            icon="sprout"
            onClick={() => {
              setAction(learning.application.trim() || '');
              setConfirming(true);
              setMessage(null);
            }}
          >
            Turn this into an action
          </Button>
        </div>
      )}
      {confirming && (
        <div className={styles.form}>
          <Field label="The action to save" hint="Small enough to start in two minutes. Nothing is saved until you confirm.">
            {(p) => <input {...p} className={inputClass} maxLength={300} value={action} onChange={(e) => setAction(e.target.value)} />}
          </Field>
          <div className={styles.row}>
            <Button variant="primary" disabled={!action.trim()} onClick={() => void saveAction()}>
              Confirm and save
            </Button>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
          {failed && <ErrorText>Not saved: the connection dropped. Try again.</ErrorText>}
        </div>
      )}
      {message && <Muted>{message}</Muted>}
    </Card>
  );
}

export function SkillsBoard({ signedIn }: BoardProps) {
  const [state, set] = useDeviceState<SkillsState>('skills', INITIAL);
  const [view, setView] = useState<'library' | 'mine'>('library');
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<string[]>([]);
  const [level, setLevel] = useState<string[]>([]);
  const [time, setTime] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const learning = (id: string) => state.items[id] ?? BLANK;
  const update = (id: string, patch: Partial<Learning>) =>
    set((s) => ({ items: { ...s.items, [id]: { ...(s.items[id] ?? BLANK), ...patch } } }));

  const list = useMemo(() => {
    const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
    return SKILLS.filter((r) => {
      if (view === 'mine') {
        const l = state.items[r.id];
        if (!l || (!l.saved && l.progress === 'none' && !l.takeaway)) return false;
      }
      if (topic[0] && r.topic !== topic[0]) return false;
      if (level[0] && r.level !== level[0]) return false;
      if (time[0] && r.sitting > Number(time[0])) return false;
      const hay = `${r.title} ${r.topic} ${r.source} ${r.summary}`.toLocaleLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [query, topic, level, time, view, state.items]);

  const open = openId ? skillById(openId) : undefined;

  return (
    <div className={styles.grid}>
      <div className={`${styles.stack} ${styles.s8}`}>
        {open ? (
          <Detail
            resource={open}
            learning={learning(open.id)}
            update={(p) => update(open.id, p)}
            signedIn={signedIn}
            onBack={() => setOpenId(null)}
          />
        ) : (
          <Card title="Library" icon="cap">
            <Tabs
              label="Show"
              tabs={[
                { value: 'library', label: 'Everything' },
                { value: 'mine', label: 'Mine' },
              ]}
              value={view}
              onChange={setView}
            />
            <Field label="Search">
              {(p) => <input {...p} type="search" className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} />}
            </Field>
            <Chips legend="Topic" options={TOPICS.map((t) => ({ value: t, label: t }))} value={topic} onChange={setTopic} />
            <div className={styles.twoCols}>
              <Chips
                legend="Level"
                options={[
                  { value: 'beginner', label: 'Beginner' },
                  { value: 'intermediate', label: 'Intermediate' },
                ]}
                value={level}
                onChange={setLevel}
              />
              <Chips
                legend="One sitting"
                options={[
                  { value: '10', label: 'Up to 10 min' },
                  { value: '30', label: 'Up to 30 min' },
                  { value: '60', label: 'Up to an hour' },
                ]}
                value={time}
                onChange={setTime}
              />
            </div>
            {list.length === 0 ? (
              <Muted>{view === 'mine' ? 'Save a resource or write a takeaway and it shows up here.' : 'Nothing matches. Try fewer filters.'}</Muted>
            ) : (
              <div className={styles.tiles}>
                {list.map((r) => {
                  const l = learning(r.id);
                  return (
                    <article key={r.id} className={styles.tile}>
                      <p className={styles.tileTitle}>{r.title}</p>
                      <p className={styles.itemMeta}>
                        {r.source} · {r.topic}
                      </p>
                      <Muted>{r.summary}</Muted>
                      <div className={styles.row}>
                        {l.saved && <Tag>saved</Tag>}
                        {l.progress !== 'none' && <Tag>{PROGRESS_LABEL[l.progress].toLowerCase()}</Tag>}
                      </div>
                      <div>
                        <Button size="small" onClick={() => setOpenId(r.id)}>
                          Details
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
      <div className={`${styles.stack} ${styles.s4}`}>
        <Card title="Your learning" icon="leaf">
          {Object.values(state.items).some((l) => l.saved || l.progress !== 'none') ? (
            <ul className={styles.list}>
              {SKILLS.filter((r) => {
                const l = state.items[r.id];
                return l && (l.saved || l.progress !== 'none');
              }).map((r) => (
                <li key={r.id} className={styles.item}>
                  <div className={styles.itemMain}>
                    <button type="button" className={styles.itemTitle} onClick={() => setOpenId(r.id)} style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', color: 'inherit', font: 'inherit', fontWeight: 500, cursor: 'pointer' }}>
                      {r.title}
                    </button>
                    <p className={styles.itemMeta}>{PROGRESS_LABEL[learning(r.id).progress]}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>Save something that looks interesting. Progress is yours to mark; nothing is tracked from watching.</Muted>
          )}
        </Card>
      </div>
    </div>
  );
}

/** The route's content, with who is signed in. */
export function SkillsScreen() {
  const { ready, signedIn } = useSurfaceState();
  return <SkillsBoard signedIn={signedIn} ready={ready} />;
}
