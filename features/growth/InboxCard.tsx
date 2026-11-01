'use client';

// The Inspiration Inbox (functional specification G05-G06, D-26 §8): a link
// or pasted text becomes a drafted small action. Nothing is saved until the
// user approves it, every field of the draft is editable, and a page that
// could not be read is said plainly, with a request to paste its text. No
// summary is ever made up for a source nobody could read.

import { useState } from 'react';

import { approveAction, draftAction, type ActionDraft, type DraftOutcome } from '@/lib/data/challenge';
import { useDeviceState } from '@/lib/device/deviceState';
import { CONSENT_INITIAL, type Consent } from '@/features/settings/consent';
import { Button, Card, ErrorText, Field, Muted, Tabs, buttonClass, inputClass, textareaClass } from '@/components/ui/kit';

import styles from '@/features/today/today.module.css';

type Source = 'link' | 'text' | 'own';

const OUTCOME_COPY: Partial<Record<DraftOutcome['kind'], string>> = {
  unreadable: 'That page could not be read. Paste the part that inspired you and a draft will come from it.',
  no_draft: 'No action could be drawn from that. Write your own below, or try a different passage.',
  limited: 'Twenty drafts today. The rest can wait for tomorrow.',
  invalid: 'That does not look like a link or any text.',
  unavailable: 'The connection dropped. Nothing was saved; try again in a moment.',
  signed_out: 'Sign in to use the Inspiration Inbox.',
};

export function InboxCard({ signedIn }: { signedIn: boolean }) {
  const [source, setSource] = useState<Source>('link');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<ActionDraft | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [consent, setConsent] = useDeviceState<Consent>('consent', CONSENT_INITIAL);

  if (!signedIn) {
    return (
      <Card title="Inspiration Inbox" icon="inbox">
        <Muted>Save an article, a video or a note, and turn its best idea into a two-minute action.</Muted>
        <a className={buttonClass('primary', true)} href="/login">
          Sign in
        </a>
      </Card>
    );
  }

  async function makeDraft(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setSaved(null);
    const outcome = await draftAction(source === 'link' ? { url: url.trim() } : { text: text.trim() });
    setBusy(false);
    if (outcome.kind === 'draft') {
      setDraft(outcome.draft);
      return;
    }
    setNotice(OUTCOME_COPY[outcome.kind] ?? null);
    if (outcome.kind === 'unreadable') setSource('text');
  }

  async function approve() {
    if (!draft) return;
    setBusy(true);
    const ok = await approveAction(draft);
    setBusy(false);
    if (ok) {
      setSaved(draft.actionText);
      setDraft(null);
      setUrl('');
      setText('');
    } else setNotice('Not saved: the connection dropped. Your draft is still here.');
  }

  return (
    <Card title="Inspiration Inbox" icon="inbox">
      {draft ? (
        <div className={styles.form}>
          <Muted>Here is a draft. Change anything, then save it, or let it go. Nothing is saved yet.</Muted>
          <Field label="Small action" hint="Something you can start in two minutes.">
            {(p) => (
              <textarea
                {...p}
                className={textareaClass}
                style={{ minHeight: 72 }}
                maxLength={300}
                value={draft.actionText}
                onChange={(e) => setDraft({ ...draft, actionText: e.target.value })}
              />
            )}
          </Field>
          <Field label="Key idea" hint={draft.promptVersion ? 'Drafted by AI from the source. Check it says what the source says.' : undefined}>
            {(p) => (
              <textarea
                {...p}
                className={textareaClass}
                style={{ minHeight: 72 }}
                maxLength={600}
                value={draft.sourceSummary}
                onChange={(e) => setDraft({ ...draft, sourceSummary: e.target.value })}
              />
            )}
          </Field>
          {draft.sourceUrl && <p className={styles.source}>Source: {draft.sourceUrl}</p>}
          <div className={styles.row}>
            <Button variant="primary" icon="check" disabled={busy || !draft.actionText.trim()} onClick={() => void approve()}>
              Save to my actions
            </Button>
            <Button disabled={busy} onClick={() => setDraft(null)}>
              Dismiss
            </Button>
          </div>
          {notice && <ErrorText>{notice}</ErrorText>}
        </div>
      ) : (
        <form className={styles.form} onSubmit={makeDraft}>
          <Tabs
            label="What are you saving?"
            tabs={[
              { value: 'link', label: 'A link' },
              { value: 'text', label: 'Pasted text' },
              { value: 'own', label: 'My own idea' },
            ]}
            value={source}
            onChange={(s) => {
              setSource(s);
              setNotice(null);
            }}
          />
          {source === 'link' && (
            <Field label="Link" hint="An article or a page with readable text.">
              {(p) => <input {...p} type="url" className={inputClass} value={url} placeholder="https://" onChange={(e) => setUrl(e.target.value)} />}
            </Field>
          )}
          {source === 'text' && (
            <Field label="Paste the part that inspired you">
              {(p) => <textarea {...p} className={textareaClass} maxLength={20000} value={text} onChange={(e) => setText(e.target.value)} />}
            </Field>
          )}
          {source !== 'own' && !consent.inboxAi ? (
            <div className={styles.form}>
              <Muted>
                Drafting sends this link or text to an AI model, which suggests one small action for you to review. Nothing
                is saved until you approve it. It is off until you turn it on.
              </Muted>
              <div className={styles.row}>
                <Button variant="primary" onClick={() => setConsent((c) => ({ ...c, inboxAi: true }))}>
                  Turn on AI drafts
                </Button>
                <Button onClick={() => setSource('own')}>Write my own instead</Button>
              </div>
            </div>
          ) : source === 'own' ? (
            <div className={styles.form}>
              <Field label="Your action" hint="Small and concrete: something you can start in two minutes.">
                {(p) => <input {...p} className={inputClass} maxLength={300} value={text} onChange={(e) => setText(e.target.value)} />}
              </Field>
              <div>
                <Button
                  variant="primary"
                  disabled={busy || !text.trim()}
                  onClick={() => setDraft({ actionText: text.trim(), sourceSummary: 'Saved by you', sourceUrl: null, promptVersion: null })}
                >
                  Review and save
                </Button>
              </div>
            </div>
          ) : (
            <div className={styles.row}>
              <Button type="submit" variant="primary" disabled={busy || (source === 'link' ? !url.trim() : !text.trim())}>
                {busy ? 'Drafting…' : 'Draft an action'}
              </Button>
              <Muted>The source is sent to an AI model to draft one action. You approve it before anything is saved.</Muted>
            </div>
          )}
          {notice && <ErrorText>{notice}</ErrorText>}
          {saved && <Muted>Saved: “{saved}”. It can show up as a daily challenge.</Muted>}
        </form>
      )}
    </Card>
  );
}
