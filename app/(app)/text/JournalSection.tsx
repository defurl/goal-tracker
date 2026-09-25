'use client';

// Feature 3 on /text — mood, tags, an entry, and an opt-in reflection.
//
// FR-3.6: the entry text lives in this component's state until it is sent,
// and is cleared the moment it has been. It is never saved, never put in the
// store, and after a reflection the user cannot read it again — the form says
// so before they write, not after (02-features.md, FR-3.6 note).
//
// AI Reflect runs only from its own button (D-16, AC-3.6): not on save, not on
// blur, not on any other event.

import { useCallback, useEffect, useState } from 'react';

import { loadJournalDays, reflect, saveEntry, type JournalDay } from '../../../lib/data/journal';
import { MAX_ENTRY_CHARS, MOODS, TOPIC_TAGS } from '../../../lib/journal/moods';
import type { JournalReflection } from '../../../lib/prompts/journalAnalysis';
import { useAppStore } from '../../../lib/stores/app';
import { supportResourcesFor } from '../../../lib/support/resources';

import styles from './text.module.css';

/** The AI Insight block — delineated from the user's own words (FR-3.3, AC-3.3). */
export function Insight({ reflection }: { reflection: Pick<JournalReflection, 'summary' | 'strength' | 'next_action' | 'support_response'> }) {
  if (reflection.support_response) {
    // D-13: no strength heading, no achievement framing, no accent. Summary,
    // then the grounding action, then the resources — from a static list.
    const locale = typeof navigator === 'undefined' ? 'en' : navigator.language;
    return (
      <div className={`${styles.insight} ${styles.support}`} role="note" aria-label="AI Insight">
        <span className={styles.label}>AI Insight</span>
        <p className={styles.prose}>{reflection.summary}</p>
        <p className={styles.quiet}>{reflection.next_action}</p>
        <ul className={styles.list} aria-label="people you can reach">
          {supportResourcesFor(locale).map((r) => (
            <li key={r.name} className={styles.quiet}>
              <a href={r.href} className={styles.quiet}>
                {r.name}
              </a>{' '}
              — {r.reach}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={styles.insight} role="note" aria-label="AI Insight">
      <span className={styles.insightLabel}>AI Insight</span>
      <p className={styles.prose}>{reflection.summary}</p>
      {reflection.strength && (
        <p className={styles.quiet}>
          <span className={styles.label}>a strength you showed · </span>
          {reflection.strength}
        </p>
      )}
      {reflection.next_action && (
        <p className={styles.quiet}>
          <span className={styles.label}>for tomorrow · </span>
          {reflection.next_action}
        </p>
      )}
    </div>
  );
}

function dayClass(score: number | undefined): string {
  if (score === undefined) return styles.day ?? '';
  if (score > 0) return `${styles.day} ${styles.dayWarm}`;
  if (score === 0) return `${styles.day} ${styles.dayMild}`;
  return `${styles.day} ${styles.dayCool}`;
}

/** US-3.5 / FR-3.5 — the last five weeks, oldest first. Warmth present or absent. */
function Calendar({ days }: { days: JournalDay[] }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const cells: string[] = [];
  const now = new Date();
  for (let i = 34; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    cells.push(new Intl.DateTimeFormat('en-CA').format(d));
  }
  return (
    <div className={styles.calendar} role="list" aria-label="the last five weeks">
      {cells.map((date) => {
        const entry = byDate.get(date);
        return (
          <span
            key={date}
            role="listitem"
            className={dayClass(entry?.moodScore)}
            aria-label={entry ? `${date}: ${entry.mood}` : `${date}: no entry`}
            title={entry ? `${date} · ${entry.mood}` : date}
          />
        );
      })}
    </div>
  );
}

export function JournalSection({ signedIn }: { signedIn: boolean }) {
  const journal = useAppStore((s) => s.journal);
  const [mood, setMood] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<'save' | 'reflect' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reflection, setReflection] = useState<JournalReflection | null>(null);
  const [days, setDays] = useState<JournalDay[]>([]);

  const reloadDays = useCallback(() => {
    void loadJournalDays().then(setDays);
  }, []);
  useEffect(() => {
    if (signedIn) reloadDays();
  }, [signedIn, reloadDays]);

  const todayInsight = days.find((d) => d.date === new Intl.DateTimeFormat('en-CA').format(new Date()))?.insight;

  async function onSave() {
    if (!mood) return;
    setBusy('save');
    const ok = await saveEntry({ mood, tags });
    setBusy(null);
    setText('');
    setMessage(ok ? 'Saved — mood and tags. The words were not kept.' : 'Not saved — the connection dropped.');
    reloadDays();
  }

  async function onReflect() {
    if (!mood || !text.trim()) return;
    setBusy('reflect');
    setReflection(null);
    const entryText = text;
    setText(''); // gone from the page the moment it is sent
    const outcome = await reflect({ entryText, mood, tags });
    setBusy(null);
    if (outcome.kind === 'reflected') {
      setReflection(outcome.reflection);
      setMessage(null);
    } else {
      setMessage('Not saved — the connection dropped. Your words were not kept.');
    }
    reloadDays();
  }

  const noReflections = journal.reflectionsRemaining === 0;

  return (
    <section className={styles.section} aria-labelledby="journal-heading">
      <h2 id="journal-heading" className={styles.heading}>Journal</h2>
      <p className={styles.quiet}>
        Your words are not kept. Only the mood, the tags and — if you ask for one — an AI reflection are saved, so you
        will not be able to read this entry again later.
      </p>

      {!signedIn ? (
        <p className={styles.faint}>
          <a href="/login" className={styles.label}>sign in</a> to keep a journal.
        </p>
      ) : (
        <div className={styles.form}>
          <div className={styles.toggles} role="radiogroup" aria-label="mood">
            {MOODS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={mood === m.key}
                aria-label={m.label}
                title={m.label}
                className={`${styles.toggle} ${styles.mood}`}
                onClick={() => setMood(m.key)}
              >
                {m.emoji}
              </button>
            ))}
          </div>

          <div className={styles.toggles} role="group" aria-label="topics">
            {TOPIC_TAGS.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tags.includes(t)}
                className={styles.toggle}
                onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
              >
                {t}
              </button>
            ))}
          </div>

          <label className={styles.field}>
            <span className={styles.label}>what is on your mind</span>
            {/* AC-3.4: prevented at input with a visible counter, never truncated on save. */}
            <textarea
              className={styles.textarea}
              maxLength={MAX_ENTRY_CHARS}
              value={text}
              onChange={(e) => setText(e.target.value)}
              aria-describedby="entry-count"
            />
            <span id="entry-count" className={styles.counter}>
              {text.length} / {MAX_ENTRY_CHARS}
            </span>
          </label>

          <div className={styles.row}>
            <button type="button" className={styles.action} disabled={!mood || busy !== null} onClick={onSave}>
              save
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={!mood || !text.trim() || busy !== null || noReflections}
              aria-describedby="reflect-note"
              onClick={onReflect}
            >
              save &amp; ai reflect
            </button>
          </div>
          <p id="reflect-note" className={styles.faint}>
            {noReflections
              ? 'Three reflections a day — the next one is available tomorrow.'
              : `${journal.reflectionsRemaining} reflection${journal.reflectionsRemaining === 1 ? '' : 's'} left today. Reflect sends this entry to an AI once, to write the insight.`}
          </p>
        </div>
      )}

      {busy === 'reflect' && (
        <div className={styles.skeleton} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
      {reflection && <Insight reflection={reflection} />}
      {!reflection && todayInsight && (
        <Insight
          reflection={{
            summary: todayInsight.summary,
            strength: todayInsight.strength,
            next_action: todayInsight.nextAction,
            support_response: false,
          }}
        />
      )}
      {message && (
        <p className={styles.quiet} role="status">
          {message}
        </p>
      )}

      {signedIn && (
        <>
          <p className={styles.label}>the last five weeks</p>
          <Calendar days={days} />
        </>
      )}
    </section>
  );
}
