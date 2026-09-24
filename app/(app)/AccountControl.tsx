'use client';

// Sign in / sign out — bottom-right, the global-controls corner
// (design-system/08-interaction-grammar.md §5). Owner decision 2026-09-24: a
// corner control, not a menu and not an object.
//
// Signed out, the room is the default room and this is the way in. Signed in,
// it is the way back out. It steps aside while a detail panel is open, the way
// the bottom-left status badge does, so it never sits on top of the panel.

import Link from 'next/link';

import { useInteractionStore } from '@/lib/stores/interaction';
import { useSignedIn } from '@/lib/supabase/useSignedIn';

import styles from './AccountControl.module.css';

export function AccountControl() {
  const signedIn = useSignedIn();
  const panelOpen = useInteractionStore((s) => s.panel !== null);

  // Unknown (still checking) or unconfigured: render nothing, never a guess.
  if (signedIn === null || panelOpen) return null;

  return (
    <div className={styles.corner}>
      {signedIn ? (
        // POST, matching app/auth/signout: a link would let a prefetch sign
        // someone out.
        <form action="/auth/signout" method="post">
          <button className={styles.control} type="submit">
            sign out
          </button>
        </form>
      ) : (
        <Link className={styles.control} href="/login">
          sign in
        </Link>
      )}
    </div>
  );
}
