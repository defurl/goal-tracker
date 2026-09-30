'use client';

// Sign in / sign out — bottom-right, the global-controls corner
// (design-system/08-interaction-grammar.md §5). Owner decision 2026-09-24: a
// corner control, not a menu and not an object.
//
// Signed out, the room is the default room and this is the way in. Signed in,
// it is the way back out, and the way to delete the account (B5.2). It steps
// aside while a detail panel is open, the way the bottom-left status badge
// does, so it never sits on top of the panel.

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { clearSnapshot } from '@/lib/data/snapshot';
import { useInteractionStore } from '@/lib/stores/interaction';
import { useSignedIn } from '@/lib/supabase/useSignedIn';

import styles from './AccountControl.module.css';

/** The room's arm window (08-interaction-grammar.md, InteractiveObject). */
const ARM_WINDOW_MS = 3000;

type DeleteState = 'idle' | 'armed' | 'deleting' | 'failed';

const DELETE_LABEL: Record<DeleteState, string> = {
  idle: 'delete account',
  armed: 'press again to delete everything',
  deleting: 'deleting',
  failed: 'not deleted — try again',
};

/**
 * Destructive actions arm, then fire (D-22 §5): the first press says what the
 * second will do, and the arm lapses on its own. No dialog — a dialog is a
 * modal (11-anti-patterns). On success the device copy of the room goes too,
 * and the page leaves for sign-in; nothing of the account is left to show.
 */
function DeleteAccountButton() {
  const [state, setState] = useState<DeleteState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const settle = (next: DeleteState) => {
    if (timer.current) clearTimeout(timer.current);
    setState(next);
    timer.current = next === 'armed' || next === 'failed' ? setTimeout(() => setState('idle'), ARM_WINDOW_MS) : null;
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function press() {
    if (state === 'deleting') return;
    if (state !== 'armed') {
      settle('armed');
      return;
    }
    settle('deleting');
    const response = await fetch('/api/account', { method: 'DELETE' }).catch(() => null);
    if (response?.status !== 204) {
      settle('failed');
      return;
    }
    clearSnapshot();
    window.location.assign('/login');
  }

  return (
    <button className={styles.control} type="button" onClick={press} aria-live="polite">
      {DELETE_LABEL[state]}
    </button>
  );
}

export function AccountControl() {
  const signedIn = useSignedIn();
  const panelOpen = useInteractionStore((s) => s.panel !== null);

  // Unknown (still checking) or unconfigured: render nothing, never a guess.
  if (signedIn === null || panelOpen) return null;

  return (
    <div className={styles.corner}>
      {signedIn ? (
        <>
          <DeleteAccountButton />
          {/* POST, matching app/auth/signout: a link would let a prefetch sign
              someone out. The server clears the session and this page is gone
              before the browser client would hear SIGNED_OUT, so the device
              copy of the room is cleared here, as the form goes. */}
          <form action="/auth/signout" method="post" onSubmit={clearSnapshot}>
            <button className={styles.control} type="submit">
              sign out
            </button>
          </form>
        </>
      ) : (
        <Link className={styles.control} href="/login">
          sign in
        </Link>
      )}
    </div>
  );
}
