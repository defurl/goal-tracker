'use client';

// The fade a scene change happens behind (design-system/13 §7): BG_VOID over
// everything while `transitioning`, SCENE_FADE_MS each way. It also takes the
// pointer for that time, so nothing is clicked mid-swap. Under reduced motion
// the global escape hatch collapses the transition: a cut, not a fade.

import { SCENE_FADE_MS } from '../../lib/motion/durations';
import { useSceneStore } from '../../lib/stores/scene';
import styles from './SceneFade.module.css';

export function SceneFade() {
  const on = useSceneStore((s) => s.transitioning);
  return (
    <div
      className={styles.fade}
      data-on={on || undefined}
      style={{ transitionDuration: `${SCENE_FADE_MS}ms` }}
      aria-hidden="true"
    />
  );
}
