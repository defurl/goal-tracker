// Placeholders for the moment before the store and auth are known.
//
// Skeleton — X-2's three breathing lines, never a bare spinner. The panels use
// it; the breathing is removed under reduced motion (text.module.css).
//
// Pending — /text's version. It renders its children, which at that moment are
// the default state, but invisible and out of the accessibility tree. The
// layout is therefore already the right size for a signed-out or new visitor,
// so nothing shifts when the real state arrives, and nothing shows a state
// that is about to change ("sign in" to someone who is signed in).

import type { ReactNode } from 'react';

import styles from './text.module.css';

export function Skeleton() {
  return (
    <div className={styles.skeleton} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export function Pending({ ready, children }: { ready: boolean; children: ReactNode }) {
  // One element either way, so the children are not remounted when ready flips.
  return (
    <div className={ready ? styles.settled : styles.pending} aria-hidden={ready ? undefined : true}>
      {children}
    </div>
  );
}
