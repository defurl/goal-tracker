// A route's heading on its cream plate (v2/04: legibility never rests on the
// room behind). The h1 takes focus when the room settles (SpaceShell).

import type { ReactNode } from 'react';

import styles from '@/features/today/today.module.css';

export function ModuleRoute({ title, intro, children }: { title: string; intro: string; children: ReactNode }) {
  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <h1 tabIndex={-1} className={styles.greeting}>
          {title}
        </h1>
        <p className={styles.tagline}>{intro}</p>
      </header>
      {children}
    </div>
  );
}
