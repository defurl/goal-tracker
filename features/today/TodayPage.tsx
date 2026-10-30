'use client';

// The Today route's heading and cards. The greeting sits straight on the
// softened room, which the 40% wash keeps legible (v2/04).

import { useEffect, useState } from 'react';

import { useSurfaceState } from '@/app/(app)/useSurfaceState';

import { TodayCards } from './TodayCards';

import styles from './today.module.css';

function greetingFor(hour: number): string {
  if (hour < 5) return 'Good evening';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export function TodayPage() {
  const { ready, signedIn } = useSurfaceState();
  // The clock is read after mount, so server and client render the same text.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        <h1 tabIndex={-1} className={styles.greeting}>
          {now ? greetingFor(now.getHours()) : 'Today'}
        </h1>
        <p className={styles.date}>
          {now ? now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ' '}
        </p>
        <p className={styles.tagline}>A little progress is still progress.</p>
      </header>
      <TodayCards signedIn={signedIn} ready={ready} />
    </div>
  );
}
