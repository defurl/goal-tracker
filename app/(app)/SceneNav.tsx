'use client';

// Bottom-left navigation. design-system/08-interaction-grammar.md §5: overlay
// UI lives in the corners, never centred, never full-bleed.
//
// This is DOM, not 3D, and it is deliberately in the route shell rather than
// the scene: it must work the instant the camera starts moving, and it must not
// pull three.js into the shell chunk (D-10). It reads the same interaction
// store the scene does.
//
// Without it a focus glide is one-way — you can look at an object but not come
// back — so it ships alongside the first wired object rather than with the
// panels it will eventually sit under.

import { useEffect } from 'react';

import { useInteractionStore } from '../../lib/stores/interaction';
import styles from './SceneNav.module.css';

export function SceneNav() {
  const focus = useInteractionStore((s) => s.focus);
  const returnToDesk = useInteractionStore((s) => s.returnToDesk);

  // Escape returns to the desk. A keyboard user who tabbed into an object needs
  // a way out that is not "find the button".
  useEffect(() => {
    if (focus === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') returnToDesk();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focus, returnToDesk]);

  if (focus === null) return null;

  return (
    <nav className={styles.nav}>
      <button type="button" className={styles.back} onClick={returnToDesk}>
        back to the desk
      </button>
    </nav>
  );
}
