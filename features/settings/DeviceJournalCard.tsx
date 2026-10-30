'use client';

// "On this device": how many entries this browser holds, whether it promised
// to keep them, and the export and import that make the journal portable.
// No browser granted persistence under test (P0), so export is the backup.

import { useEffect, useRef, useState } from 'react';

import { downloadExport, importFile, requestPersistence, useJournalStore } from '@/lib/journal/device';
import { Button, Card, ErrorText, Muted } from '@/components/ui/kit';

import styles from '@/features/today/today.module.css';

export function DeviceJournalCard({ signedIn }: { signedIn: boolean }) {
  const count = useJournalStore((s) => s.entries.length);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    void navigator.storage?.persisted?.().then((p) => live && setPersisted(p));
    return () => {
      live = false;
    };
  }, []);

  async function keep() {
    const state = await requestPersistence();
    setPersisted(state.persisted || state.granted === true);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setMessage(null);
    setError(null);
    const result = await importFile(f);
    if (typeof result === 'string') setError(`Not imported: ${result}. Nothing was changed.`);
    else
      setMessage(
        `Imported ${result.added} ${result.added === 1 ? 'entry' : 'entries'}${result.skipped ? `; ${result.skipped} already here` : ''}.`,
      );
  }

  return (
    <Card title="On this device" icon="book">
      <Muted>
        {count} {count === 1 ? 'entry' : 'entries'} in this browser. Your writing never leaves it
        {signedIn ? '; only a check-in’s mood and tags are sent, for points.' : '.'}
      </Muted>
      <Muted>
        {persisted
          ? 'This browser has promised to keep them.'
          : 'Browsers can clear site data. Export now and then to keep a copy.'}
      </Muted>
      <div className={styles.row}>
        <Button
          variant="primary"
          size="small"
          disabled={count === 0}
          onClick={async () => setMessage((await downloadExport()) ? 'Export downloaded.' : null)}
        >
          Export
        </Button>
        <Button size="small" onClick={() => file.current?.click()}>
          Import
        </Button>
        {!persisted && (
          <Button size="small" variant="tertiary" onClick={() => void keep()}>
            Ask to keep
          </Button>
        )}
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={onImport} aria-label="Import a journal file" />
      </div>
      {message && <Muted>{message}</Muted>}
      {error && <ErrorText>{error}</ErrorText>}
    </Card>
  );
}
