'use client';

// /text — every feature, no WebGL (D-07, X-4). Reads the same store as the
// room (spec/05 §8) and subscribes normally; there is no frame loop here.
//
// Imports nothing from scene/ — not even a type. D-10: this route's bundle
// must never contain three.js, and bundle:check fails the build if it does.

import Link from 'next/link';

import { ChallengeSection } from './ChallengeSection';
import { FocusSection } from './FocusSection';
import { GoalsSection } from './GoalsSection';
import { HabitsSection } from './HabitsSection';
import { JournalSection } from './JournalSection';
import { Pending } from './Skeleton';

import { useSurfaceState } from '../useSurfaceState';

import { useAppStore } from '../../../lib/stores/app';

import styles from './text.module.css';

export function TextSurface() {
  // Headings and fixed copy render at once; what depends on the store or on
  // who is signed in waits for `ready`, so nothing flashes the wrong state.
  const { ready, signedIn } = useSurfaceState();
  const points = useAppStore((s) => s.points);
  const offline = useAppStore((s) => s.offline);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Be Better Everyday</h1>
        <div className={styles.meta}>
          {/* X-1: a new visitor gets no row of zeros. The counters appear with
              the first point; the sections below carry the welcome. Leaves are
              the EARNED ones — the tree starts with its own. */}
          <Pending ready={ready}>
            {points.total > 0 && (
              <>
                <span className={styles.label}>
                  <span className={styles.number}>{points.total}</span> glow points
                </span>
                <span className={styles.label}>
                  <span className={styles.number}>{points.today}</span> today
                </span>
                <span className={styles.label}>
                  <span className={styles.number}>{points.leafCount}</span>{' '}
                  {points.leafCount === 1 ? 'leaf grown' : 'leaves grown'}
                </span>
              </>
            )}
          </Pending>
          {/* A plain link: /?room=1 also tells a phone to stop sending it here (middleware). */}
          <Link className={styles.label} href="/?room=1">
            enter the room
          </Link>
        </div>
        {offline && <p className={styles.faint}>offline — showing what was last loaded</p>}
      </header>

      <ChallengeSection signedIn={signedIn} ready={ready} />
      <HabitsSection signedIn={signedIn} ready={ready} />
      <JournalSection signedIn={signedIn} ready={ready} />
      <GoalsSection signedIn={signedIn} ready={ready} />
      <FocusSection />
    </main>
  );
}
