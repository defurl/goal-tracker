'use client';

// Settings (handoff P01, first slice): the account and the journal on this
// device. Destructive actions arm, then fire (D-22 §5). Sign-out on a device
// with journal entries says it will delete them and offers an export first
// (D-26 §5).

import Link from 'next/link';
import { useState } from 'react';

import { useSurfaceState } from '@/app/(app)/useSurfaceState';
import { Button, Card, Chips, ErrorText, Muted, buttonClass, useArm } from '@/components/ui/kit';
import { clearSnapshot } from '@/lib/data/snapshot';
import { clearDeviceState, useDeviceState } from '@/lib/device/deviceState';
import { clearDeviceJournal, downloadExport, useJournalStore } from '@/lib/journal/device';

import { CONSENT_INITIAL, type Consent } from './consent';
import { DeviceJournalCard } from './DeviceJournalCard';

import styles from '@/features/today/today.module.css';

async function leaveDevice(): Promise<void> {
  await clearDeviceJournal();
  clearDeviceState();
  clearSnapshot();
}

function SignOut() {
  const count = useJournalStore((s) => s.entries.length);
  const { armed, press } = useArm();
  const [leaving, setLeaving] = useState(false);

  async function signOut() {
    setLeaving(true);
    await leaveDevice();
    // POST, as app/auth/signout expects: a link would let a prefetch sign out.
    const form = document.createElement('form');
    form.method = 'post';
    form.action = '/auth/signout';
    document.body.append(form);
    form.submit();
  }

  return (
    <div className={styles.form}>
      {armed && count > 0 && (
        <>
          <ErrorText>
            Signing out deletes the journal on this device ({count} {count === 1 ? 'entry' : 'entries'}). Export it first?
          </ErrorText>
          <div>
            <Button size="small" onClick={() => void downloadExport()}>
              Export journal
            </Button>
          </div>
        </>
      )}
      <div>
        <Button disabled={leaving} onClick={() => (count > 0 ? press(() => void signOut()) : void signOut())}>
          {armed ? 'Press again to sign out' : 'Sign out'}
        </Button>
      </div>
    </div>
  );
}

function DeleteAccount() {
  const { armed, press } = useArm();
  const [state, setState] = useState<'idle' | 'deleting' | 'failed'>('idle');

  async function remove() {
    setState('deleting');
    const response = await fetch('/api/account', { method: 'DELETE' }).catch(() => null);
    if (response?.status !== 204) {
      setState('failed');
      return;
    }
    await leaveDevice();
    window.location.assign('/login');
  }

  return (
    <div className={styles.form}>
      <Muted>Deletes your account and everything stored with it, on the server and on this device. This cannot be undone.</Muted>
      <div>
        <Button disabled={state === 'deleting'} onClick={() => press(() => void remove())} aria-live="polite">
          {state === 'deleting' ? 'Deleting…' : armed ? 'Press again to delete everything' : 'Delete account'}
        </Button>
      </div>
      {state === 'failed' && <ErrorText>Not deleted. Nothing changed; try again.</ErrorText>}
    </div>
  );
}

function AiConsent() {
  const [consent, setConsent] = useDeviceState<Consent>('consent', CONSENT_INITIAL);
  return (
    <Card title="AI, feature by feature" icon="sparkle">
      <Chips
        legend="Inspiration Inbox drafts"
        options={[
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'Draft with AI' },
        ]}
        value={[consent.inboxAi ? 'on' : 'off']}
        onChange={(v) => setConsent((c) => ({ ...c, inboxAi: v[0] === 'on' }))}
      />
      <Muted>
        When on, a link or text you save to the Inbox is sent to an AI model to draft one small action, which you review
        before anything is saved. Your journal is never sent anywhere.
      </Muted>
    </Card>
  );
}

export function SettingsPage() {
  const { ready, signedIn } = useSurfaceState();
  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <h1 tabIndex={-1} className={styles.greeting}>
          Settings
        </h1>
        <p className={styles.tagline}>Your account, your data, your space.</p>
      </header>
      <div className={styles.grid}>
        <div className={`${styles.stack} ${styles.s7}`}>
          <Card title="Account" icon="gear">
            {!ready ? (
              <Muted>Checking…</Muted>
            ) : signedIn ? (
              <>
                <SignOut />
                <DeleteAccount />
              </>
            ) : (
              <div className={styles.row}>
                <Link className={buttonClass('primary')} href="/login">
                  Sign in
                </Link>
                <Link className={buttonClass('secondary')} href="/signup">
                  Create an account
                </Link>
              </div>
            )}
          </Card>
          <AiConsent />
          <Card title="Privacy" icon="info">
            <Muted>
              Your journal never leaves this device. Motion follows your system’s reduce-motion setting.{' '}
              <Link href="/privacy" className={styles.inlineLink}>How your data is handled</Link>.
            </Muted>
          </Card>
        </div>
        <div className={`${styles.stack} ${styles.s5}`}>
          <DeviceJournalCard signedIn={signedIn} />
        </div>
      </div>
    </div>
  );
}
