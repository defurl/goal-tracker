'use client';

// The hall's history on /text (A5.9, D-07; design-system/13 §8) — the same
// list as the wall's panel, with each habit's last twelve weeks under it.
//
// Last on the page: everything above it is something to do today, and /text
// is the fast path to those. The history is the largest read in the product,
// so it is asked for only when this section comes near the screen — a visit
// that never scrolls this far never pays for it.

import { useEffect, useRef, useState } from 'react';

import { HistoryList } from './HistoryList';
import styles from './text.module.css';

/** Start the read a little before the section is on screen. */
const NEAR = '200px';

export function HistorySection({ signedIn, ready }: { signedIn: boolean; ready: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const section = ref.current;
    if (!section || typeof IntersectionObserver === 'undefined') {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: NEAR },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} className={styles.section} aria-labelledby="history-heading">
      <h2 id="history-heading" className={styles.heading}>History</h2>
      <HistoryList ready={ready && near} signedIn={signedIn} surface="text" />
    </section>
  );
}
