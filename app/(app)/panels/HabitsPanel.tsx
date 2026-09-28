'use client';

// The wall tracker's panel — habits in the room (build plan 3.5, F2).
//
// The wall is texture at rest; this is where its numbers are legible
// (design-system/12 §3.3). Above /text's habits body, one line of totals.
// Nothing here counts what was missed — only what was kept (D-08, D-09).

import { useAppStore } from '../../../lib/stores/app';
import { supabaseConfigured } from '../../../lib/supabase/env';
import { useSignedIn } from '../../../lib/supabase/useSignedIn';
import { HabitsBody } from '../text/HabitsSection';

import voice from '../text/text.module.css';

export function HabitsPanel() {
  const signedInState = useSignedIn();
  const signedIn = supabaseConfigured && signedInState === true;
  const points = useAppStore((s) => s.points);
  const dayGrid = useAppStore((s) => s.dayGrid);
  const habits = useAppStore((s) => s.habits);

  // The grid marks today as "today" whether or not it is kept yet, so today
  // counts only once a habit is done.
  const kept = dayGrid.filter((d) => d === 1).length + (habits.some((h) => h.completedToday) ? 1 : 0);

  return (
    <>
      {signedIn && (
        <div className={voice.meta}>
          <span className={voice.label}>
            <span className={voice.number}>{kept}</span> {kept === 1 ? 'day' : 'days'} kept this year
          </span>
          <span className={voice.label}>
            <span className={voice.number}>{points.total}</span> glow points
          </span>
        </div>
      )}
      <HabitsBody signedIn={signedIn} />
    </>
  );
}
