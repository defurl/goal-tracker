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
//
// In the hall (design-system/13 §7) back is two steps: from the wall or the
// tree to the hall's arrival pose, then through the door to the room.

import { useEffect, useMemo } from 'react';

import { leaveHall } from '../../lib/scene/transition';
import { useInteractionStore } from '../../lib/stores/interaction';
import { useSceneStore } from '../../lib/stores/scene';
import styles from './SceneNav.module.css';

export function SceneNav() {
  const focus = useInteractionStore((s) => s.focus);
  const returnToDesk = useInteractionStore((s) => s.returnToDesk);
  const inHall = useSceneStore((s) => s.current === 'hall');
  const transitioning = useSceneStore((s) => s.transitioning);

  const back = useMemo(
    () => (focus !== null ? returnToDesk : inHall ? () => void leaveHall() : null),
    [focus, inHall, returnToDesk],
  );
  const label = focus !== null ? (inHall ? 'back to the hall' : 'back to the desk') : 'back to the room';

  // Escape does the same. A keyboard user who tabbed into an object needs a
  // way out that is not "find the button".
  useEffect(() => {
    if (!back || transitioning) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [back, transitioning]);

  if (!back || transitioning) return null;

  return (
    <nav className={styles.nav}>
      <button type="button" className={styles.back} onClick={back}>
        {label}
      </button>
    </nav>
  );
}
