'use client';

// A module whose new screens are not built yet: its room view works, and the
// card says plainly where its features live until then. Every destination is
// reachable from the menu (handoff 01 §8); none is a dead end.

import Link from 'next/link';

import { Card, Muted, buttonClass } from '@/components/ui/kit';

import styles from '@/features/today/today.module.css';

export function ModulePending({
  title,
  intro,
  existing,
}: {
  title: string;
  intro: string;
  /** Where the feature lives today, if anywhere. */
  existing: { href: string; label: string } | null;
}) {
  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <h1 tabIndex={-1} className={styles.greeting}>
          {title}
        </h1>
        <p className={styles.tagline}>{intro}</p>
      </header>
      <div className={styles.grid}>
        <div className={styles.s5}>
          <Card title="Being rebuilt" icon="sparkle">
            <Muted>
              This part of your space is being redesigned. Nothing you have saved is lost.
              {existing ? ' Until it is ready, it works in the simple text view.' : ' It arrives with the next update.'}
            </Muted>
            {existing && (
              <div>
                <Link className={buttonClass('primary', true)} href={existing.href}>
                  {existing.label}
                </Link>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
