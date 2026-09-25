'use client';

// /text — every feature, no WebGL (D-07, X-4). Reads the same store as the
// room (spec/05 §8) and subscribes normally; there is no frame loop here.
//
// Imports nothing from scene/ — not even a type. D-10: this route's bundle
// must never contain three.js, and bundle:check fails the build if it does.

import Link from 'next/link';

import { ChallengeSection } from './ChallengeSection';
import { HabitsSection } from './HabitsSection';

import { useAppStore } from '../../../lib/stores/app';
import { supabaseConfigured } from '../../../lib/supabase/env';
import { useSignedIn } from '../../../lib/supabase/useSignedIn';

import styles from './text.module.css';

export function TextSurface() {
  const signedInState = useSignedIn();
  const signedIn = supabaseConfigured && signedInState === true;
  const points = useAppStore((s) => s.points);
  const offline = useAppStore((s) => s.offline);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Be Better Everyday</h1>
        <div className={styles.meta}>
          <span className={styles.label}>
            <span className={styles.number}>{points.total}</span> glow points
          </span>
          <span className={styles.label}>
            <span className={styles.number}>{points.today}</span> today
          </span>
          <span className={styles.label}>
            <span className={styles.number}>{points.leafCount}</span> leaves on the bonsai
          </span>
          {/* A plain link: /?room=1 also tells a phone to stop sending it here (middleware). */}
          <Link className={styles.label} href="/?room=1">
            enter the room
          </Link>
        </div>
        {offline && <p className={styles.faint}>offline — showing what was last loaded</p>}
      </header>

      <ChallengeSection signedIn={signedIn} />
      <HabitsSection signedIn={signedIn} />
    </main>
  );
}
