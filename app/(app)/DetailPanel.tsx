'use client';

// The detail panel. design-system/08-interaction-grammar.md §5, build plan A2.5.
//
// A right-hand slide-in at ~480 px. Never a centred modal, never full-bleed:
// the 3D scene is the content and the DOM is corner furniture. The focus poses
// in `scene/cameraPoses.ts` are composed around this width — every one of them
// puts its object left of centre so this panel does not occlude it.
//
// It is NOT modal. The room stays live behind it, the camera holds its focus
// pose, and the panel is a complementary region rather than a dialog. Escape
// and the back control both close it (see SceneNav).
//
// This is the shell only. Each feature fills its own panel in the phase that
// builds it — the panel exists now because the camera work depends on its
// width, not because any feature is ready.

import { useEffect, useRef } from 'react';

import { useInteractionStore, type PanelId } from '../../lib/stores/interaction';
import styles from './DetailPanel.module.css';

const TITLES: Record<Exclude<PanelId, null>, string> = {
  challenge: 'Daily challenge',
  goals: 'Goals',
  journal: 'Journal',
  import: 'Article import',
  habits: 'Habits',
};

export function DetailPanel() {
  const panel = useInteractionStore((s) => s.panel);
  const returnToDesk = useInteractionStore((s) => s.returnToDesk);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus into the panel when it opens. Without this a keyboard user who
  // activated an object is left with focus on a button that has just been
  // unmounted, which drops them back to the top of the document.
  useEffect(() => {
    if (panel !== null) headingRef.current?.focus();
  }, [panel]);

  if (panel === null) return null;

  return (
    <aside className={styles.panel} role="region" aria-label={TITLES[panel]}>
      <h2 className={styles.title} tabIndex={-1} ref={headingRef}>
        {TITLES[panel]}
      </h2>
      <button type="button" className={styles.close} onClick={returnToDesk}>
        close
      </button>
    </aside>
  );
}
